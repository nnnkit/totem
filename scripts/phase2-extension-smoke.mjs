import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const EXPECTED_EXTENSION_NAME =
  "Twitter Saver: Bookmarks on New Tab, Search & Export";
const EXPECTED_HOST_PERMISSION = "https://x.com/*";
const EXPECTED_NEW_TAB = "newtab.html";
const EXPECTED_STARTUP_TEXT = [
  "LOG IN TO START READING",
  "Sign in to your X account",
  "Log in to X",
];

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  static async connect(url) {
    const client = new CdpClient(url);
    await client.open();
    return client;
  }

  open() {
    return new Promise((resolveOpen, rejectOpen) => {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener("open", () => resolveOpen());
      this.ws.addEventListener("error", (event) => {
        rejectOpen(new Error(`WebSocket error for ${this.url}: ${event.message ?? "unknown"}`));
      });
      this.ws.addEventListener("message", (event) => this.handleMessage(event));
      this.ws.addEventListener("close", () => {
        for (const { reject } of this.pending.values()) {
          reject(new Error(`WebSocket closed for ${this.url}`));
        }
        this.pending.clear();
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolveSend, rejectSend) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectSend(new Error(`CDP command timed out: ${method}`));
      }, 10_000);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolveSend(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          rejectSend(error);
        },
      });

      this.ws.send(payload);
    });
  }

  handleMessage(event) {
    const data = typeof event.data === "string" ? event.data : "";
    if (!data) return;

    const message = JSON.parse(data);
    if (!message.id) return;

    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(
        new Error(`${message.error.message}: ${message.error.data ?? ""}`.trim()),
      );
      return;
    }

    pending.resolve(message.result ?? {});
  }

  close() {
    this.ws?.close();
  }
}

const rootDir = process.cwd();
const distDir = resolve(process.env.TOTEM_EXTENSION_DIST ?? "dist");
const manifestPath = resolve(distDir, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error(
    `Missing ${manifestPath}. Run \`pnpm package:extension\` before this smoke check.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const serviceWorkerFile = manifest.background?.service_worker;

if (!serviceWorkerFile) {
  console.error("dist/manifest.json does not declare background.service_worker.");
  process.exit(1);
}

const chromeBin = findChromeBinary();

if (!chromeBin) {
  console.error(
    [
      "Could not find Chrome for Testing or Chromium.",
      "Install Chrome for Testing with `pnpm dlx @puppeteer/browsers install chrome@stable`,",
      "then rerun from the repo root, or set CHROME_BIN to a compatible browser executable.",
      "Set TOTEM_ALLOW_BRANDED_CHROME=1 only if your branded Chrome still supports --load-extension.",
    ].join(" "),
  );
  process.exit(1);
}

const profileDir = await mkdtemp(join(tmpdir(), "totem-extension-smoke-"));
const port = Number(process.env.TOTEM_CHROME_PORT) || await findFreePort();
const chromeArgs = [
  `--user-data-dir=${profileDir}`,
  "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${port}`,
  `--load-extension=${distDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-sync",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--window-size=1280,900",
  "about:blank",
];

if (process.env.TOTEM_CHROME_HEADLESS === "1") {
  chromeArgs.splice(chromeArgs.length - 1, 0, "--headless=new");
}

const chrome = spawn(chromeBin, chromeArgs, {
  cwd: rootDir,
  stdio: ["ignore", "ignore", "pipe"],
});

let chromeStderr = "";
chrome.stderr.on("data", (chunk) => {
  chromeStderr = `${chromeStderr}${chunk.toString()}`.slice(-6000);
});

let browserClient;
let pageClient;

try {
  const versionInfo = await waitForJson(
    `http://127.0.0.1:${port}/json/version`,
    "Chrome DevTools endpoint",
  );
  browserClient = await CdpClient.connect(versionInfo.webSocketDebuggerUrl);

  const extensionTarget = await waitForTarget(
    port,
    (target) => isTotemExtensionTarget(target, serviceWorkerFile),
    "Totem extension target",
  );
  const extensionId = new URL(extensionTarget.url).host;
  console.log(`Loaded Totem extension id: ${extensionId}`);

  await waitForTarget(
    port,
    (target) =>
      target.type === "service_worker" &&
      target.url === `chrome-extension://${extensionId}/${serviceWorkerFile}`,
    `Totem service worker ${serviceWorkerFile}`,
  );
  console.log(`Verified Totem service worker: ${serviceWorkerFile}`);

  const { targetId } = await browserClient.send("Target.createTarget", {
    url: "about:blank",
  });
  const pageTarget = await waitForTarget(
    port,
    (target) => target.id === targetId,
    "extension page target",
  );
  pageClient = await CdpClient.connect(pageTarget.webSocketDebuggerUrl);
  await pageClient.send("Page.enable");
  await pageClient.send("Runtime.enable");

  const newTabUrl = `chrome-extension://${extensionId}/newtab.html`;
  await pageClient.send("Page.navigate", { url: newTabUrl });
  await waitForEval(
    pageClient,
    "location.href",
    (value) => value === newTabUrl,
    "new tab navigation",
  );
  await waitForEval(
    pageClient,
    "document.readyState",
    (value) => value === "interactive" || value === "complete",
    "new tab document readiness",
  );

  const pageManifest = await evaluate(
    pageClient,
    "chrome.runtime.getManifest()",
  );
  assertEqual(
    pageManifest.name,
    EXPECTED_EXTENSION_NAME,
    "extension manifest name",
  );
  assertEqual(pageManifest.version, manifest.version, "extension version");
  assertEqual(
    pageManifest.chrome_url_overrides?.newtab,
    EXPECTED_NEW_TAB,
    "new tab override",
  );
  assertIncludes(
    pageManifest.host_permissions ?? [],
    EXPECTED_HOST_PERMISSION,
    "host permissions",
  );
  assertIncludes(pageManifest.permissions ?? [], "cookies", "permissions");
  assertIncludes(pageManifest.permissions ?? [], "webRequest", "permissions");
  assertIncludes(pageManifest.permissions ?? [], "storage", "permissions");
  console.log("Verified manifest name, version, permissions, and new tab override.");

  const bodyText = await waitForEval(
    pageClient,
    "document.body ? document.body.innerText : ''",
    (value) =>
      EXPECTED_STARTUP_TEXT.every((fragment) => value.includes(fragment)) &&
      !value.includes("Set up Totem"),
    "startup login copy",
  );
  assertTextIncludes(bodyText, EXPECTED_STARTUP_TEXT, "startup text");
  assertTextExcludes(bodyText, ["Set up Totem"], "startup text");
  console.log("Verified startup login copy without onboarding modal.");

  const storageWorks = await evaluate(
    pageClient,
    `(async () => {
      const key = "totem_smoke_probe";
      await chrome.storage.local.set({ [key]: { ok: true, at: Date.now() } });
      const result = await chrome.storage.local.get(key);
      await chrome.storage.local.remove(key);
      return result[key]?.ok === true;
    })()`,
  );
  assertEqual(storageWorks, true, "chrome.storage.local write/read/remove");
  console.log("Verified chrome.storage.local access from extension page.");

  console.log("Phase 2 extension smoke passed.");
} catch (error) {
  console.error("\nPhase 2 extension smoke failed.");
  console.error(error?.stack || error?.message || String(error));
  if (chromeStderr.trim()) {
    console.error("\nRecent Chrome stderr:");
    console.error(chromeStderr.trim());
  }
  process.exitCode = 1;
} finally {
  pageClient?.close();
  browserClient?.close();
  await stopChrome(chrome);
  await rm(profileDir, { recursive: true, force: true });
}

function findChromeBinary() {
  const localChromeForTesting = findLocalChromeForTestingCandidates();
  const candidates = [
    process.env.CHROME_BIN,
    ...localChromeForTesting,
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  if (process.env.TOTEM_ALLOW_BRANDED_CHROME === "1") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
    );
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function findLocalChromeForTestingCandidates() {
  const installRoot = resolve(rootDir, "chrome");
  if (!existsSync(installRoot)) return [];

  const candidates = [];
  for (const versionDir of safeReadDir(installRoot)) {
    const versionPath = join(installRoot, versionDir);
    for (const bundleDir of safeReadDir(versionPath)) {
      const bundlePath = join(versionPath, bundleDir);
      candidates.push(
        join(
          bundlePath,
          "Google Chrome for Testing.app",
          "Contents",
          "MacOS",
          "Google Chrome for Testing",
        ),
        join(bundlePath, "chrome"),
      );
    }
  }

  return candidates.reverse();
}

function safeReadDir(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function isTotemExtensionTarget(target, expectedServiceWorkerFile) {
  if (!target.url?.startsWith("chrome-extension://")) return false;
  const url = new URL(target.url);
  return (
    url.pathname === `/${expectedServiceWorkerFile}` ||
    url.pathname === "/newtab.html"
  );
}

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const portNumber = typeof address === "object" ? address?.port : null;
      server.close(() => {
        if (typeof portNumber === "number") {
          resolvePort(portNumber);
        } else {
          reject(new Error("Could not allocate a local DevTools port."));
        }
      });
    });
  });
}

async function waitForJson(url, label, timeoutMs = 15_000) {
  return waitForValue(
    async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${url} returned ${response.status}`);
      }
      return response.json();
    },
    () => true,
    label,
    timeoutMs,
  );
}

async function waitForTarget(port, predicate, label, timeoutMs = 15_000) {
  return waitForValue(
    async () => {
      const targets = await waitForJson(
        `http://127.0.0.1:${port}/json/list`,
        "Chrome targets",
        2_000,
      );
      return targets.find(predicate) ?? null;
    },
    Boolean,
    label,
    timeoutMs,
  );
}

async function waitForEval(client, expression, predicate, label, timeoutMs = 15_000) {
  return waitForValue(
    () => evaluate(client, expression),
    predicate,
    label,
    timeoutMs,
  );
}

async function waitForValue(readValue, predicate, label, timeoutMs) {
  const start = Date.now();
  let lastError = null;
  let lastValue = null;

  while (Date.now() - start < timeoutMs) {
    if (chrome.exitCode !== null) {
      throw new Error(
        `Chrome exited before ${label} was ready. exitCode=${chrome.exitCode}`,
      );
    }

    try {
      lastValue = await readValue();
      if (predicate(lastValue)) return lastValue;
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  const last = lastError?.message ?? JSON.stringify(lastValue)?.slice(0, 600);
  throw new Error(`${label} was not ready after ${timeoutMs}ms. Last: ${last}`);
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (response.exceptionDetails) {
    const details = response.exceptionDetails;
    throw new Error(
      details.exception?.description ||
        details.text ||
        `Runtime.evaluate failed for ${expression}`,
    );
  }

  return response.result?.value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(values, expected, label) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${label}: missing ${JSON.stringify(expected)} in ${JSON.stringify(values)}`);
  }
}

function assertTextIncludes(text, fragments, label = "text") {
  const missing = fragments.filter((fragment) => !text.includes(fragment));
  if (missing.length > 0) {
    throw new Error(`${label} missing: ${missing.join(", ")}`);
  }
}

function assertTextExcludes(text, fragments, label = "text") {
  const present = fragments.filter((fragment) => text.includes(fragment));
  if (present.length > 0) {
    throw new Error(`${label} unexpectedly included: ${present.join(", ")}`);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function stopChrome(child) {
  if (child.exitCode !== null) return;

  const exited = new Promise((resolveExit) => {
    child.once("exit", resolveExit);
  });

  child.kill("SIGTERM");
  await Promise.race([
    exited,
    delay(2_000).then(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }),
  ]);
}
