// Content script: runs at document_start on x.com
// Reads the twid cookie to detect the logged-in user ID
(function () {
  const MESSAGE_SOURCE = "xbt-bookmark-mutation";

  function parseTwidUserId(rawValue) {
    if (typeof rawValue !== "string" || !rawValue) return null;

    const candidates = [rawValue];
    try {
      const decoded = decodeURIComponent(rawValue);
      if (decoded && decoded !== rawValue) {
        candidates.push(decoded);
      }
    } catch {}

    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (!trimmed) continue;

      const userMatch = trimmed.match(/u=(\d+)/);
      if (userMatch?.[1]) return userMatch[1];

      const encodedMatch = trimmed.match(/u%3[Dd](\d+)/);
      if (encodedMatch?.[1]) return encodedMatch[1];

      if (/^\d+$/.test(trimmed)) return trimmed;
    }

    return null;
  }

  const twidPair = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("twid="));
  const twidRawValue = twidPair ? twidPair.slice("twid=".length) : "";
  const currentUserId = parseTwidUserId(twidRawValue);

  if (currentUserId) {
    chrome.storage.local.set({ xbt_user_id: currentUserId });
  } else {
    // Keep IndexedDB bookmarks, but drop stale auth identity on logout.
    chrome.storage.local.remove(["xbt_user_id"]);
  }

  function handleBookmarkMutationMessage(event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.__source !== MESSAGE_SOURCE) return;

    if (data.type === "query_ids" && data.ids && typeof data.ids === "object") {
      chrome.runtime.sendMessage({
        type: "STORE_QUERY_IDS",
        ids: data.ids,
      });
      return;
    }

    const operation =
      data.operation === "CreateBookmark" || data.operation === "DeleteBookmark"
        ? data.operation
        : null;
    if (!operation) return;

    const tweetId = typeof data.tweetId === "string" ? data.tweetId : "";
    chrome.runtime.sendMessage({
      type: "BOOKMARK_MUTATION",
      operation,
      tweetId,
      source: "injected-script",
    });
  }

  window.addEventListener("message", handleBookmarkMutationMessage);

  function injectMutationHook() {
    const script = document.createElement("script");
    script.textContent = `(() => {
      if (window.__xbtBookmarkMutationHookInstalled) return;
      window.__xbtBookmarkMutationHookInstalled = true;

      const SOURCE = "${MESSAGE_SOURCE}";

      const parseTweetIdFromObject = (obj) => {
        if (!obj || typeof obj !== "object") return "";
        const variables = obj.variables && typeof obj.variables === "object" ? obj.variables : null;
        return (
          (variables && (variables.tweet_id || variables.tweetId || "")) ||
          obj.tweet_id ||
          obj.tweetId ||
          ""
        ) || "";
      };

      const parseTweetId = (body) => {
        if (!body) return "";

        if (typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            const fromJson = parseTweetIdFromObject(parsed);
            if (fromJson) return String(fromJson);
          } catch {}

          try {
            const search = new URLSearchParams(body);
            const vars = search.get("variables");
            if (vars) {
              try {
                const parsedVars = JSON.parse(vars);
                const fromVars = parseTweetIdFromObject({ variables: parsedVars });
                if (fromVars) return String(fromVars);
              } catch {}
            }
            const direct = search.get("tweet_id") || search.get("tweetId");
            if (direct) return String(direct);
          } catch {}

          return "";
        }

        if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
          const vars = body.get("variables");
          if (vars) {
            try {
              const parsedVars = JSON.parse(vars);
              const fromVars = parseTweetIdFromObject({ variables: parsedVars });
              if (fromVars) return String(fromVars);
            } catch {}
          }
          const direct = body.get("tweet_id") || body.get("tweetId");
          if (direct) return String(direct);
          return "";
        }

        if (typeof FormData !== "undefined" && body instanceof FormData) {
          const direct = body.get("tweet_id") || body.get("tweetId");
          if (typeof direct === "string" && direct) return direct;
          const vars = body.get("variables");
          if (typeof vars === "string" && vars) {
            try {
              const parsedVars = JSON.parse(vars);
              const fromVars = parseTweetIdFromObject({ variables: parsedVars });
              if (fromVars) return String(fromVars);
            } catch {}
          }
          return "";
        }

        const fromObject = parseTweetIdFromObject(body);
        return fromObject ? String(fromObject) : "";
      };

      const operationFromUrl = (url) => {
        if (!url) return "";
        if (/\\/CreateBookmark(?:\\?|$)/.test(url)) return "CreateBookmark";
        if (/\\/DeleteBookmark(?:\\?|$)/.test(url)) return "DeleteBookmark";
        return "";
      };

      const emit = (operation, tweetId) => {
        window.postMessage(
          {
            __source: SOURCE,
            operation,
            tweetId: tweetId || "",
          },
          "*",
        );
      };

      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (...args) {
        try {
          this.__xbtUrl = typeof args[1] === "string" ? args[1] : "";
        } catch {}
        return originalOpen.apply(this, args);
      };

      XMLHttpRequest.prototype.send = function (body) {
        try {
          const operation = operationFromUrl(this.__xbtUrl || "");
          if (operation) {
            emit(operation, parseTweetId(body));
          }
        } catch {}
        return originalSend.apply(this, arguments);
      };

      const originalFetch = window.fetch;
      window.fetch = function (input, init) {
        try {
          const url =
            typeof input === "string"
              ? input
              : input && typeof input.url === "string"
                ? input.url
                : "";
          const operation = operationFromUrl(url);
          if (operation) {
            emit(operation, parseTweetId(init && init.body));
          }
        } catch {}
        return originalFetch.apply(this, arguments);
      };

      // Discover GraphQL query IDs from loaded JS bundles
      function discoverQueryIds() {
        if (window.__xbtQidsScanned) return;
        window.__xbtQidsScanned = true;

        var targets = ["DeleteBookmark", "CreateBookmark"];
        var found = {};
        var scripts = document.querySelectorAll("script[src]");
        var queue = [];
        for (var i = 0; i < scripts.length && i < 20; i++) {
          if (scripts[i].src) queue.push(scripts[i].src);
        }

        var idx = 0;
        function next() {
          if (idx >= queue.length) {
            if (Object.keys(found).length > 0) {
              window.postMessage({ __source: SOURCE, type: "query_ids", ids: found }, "*");
            }
            return;
          }
          var src = queue[idx++];
          fetch(src)
            .then(function (r) { return r.text(); })
            .then(function (text) {
              for (var t = 0; t < targets.length; t++) {
                var name = targets[t];
                if (found[name]) continue;
                var pos = text.indexOf('"' + name + '"');
                if (pos === -1) pos = text.indexOf("'" + name + "'");
                if (pos === -1) continue;
                var region = text.substring(Math.max(0, pos - 300), pos + 300);
                var m = region.match(/queryId\\s*:\\s*["']([A-Za-z0-9_\\-]{10,50})["']/);
                if (m) found[name] = m[1];
              }
              var allFound = targets.every(function (n) { return !!found[n]; });
              if (allFound) {
                window.postMessage({ __source: SOURCE, type: "query_ids", ids: found }, "*");
              } else {
                next();
              }
            })
            .catch(function () { next(); });
        }
        next();
      }

      if (document.readyState === "complete") {
        setTimeout(discoverQueryIds, 2000);
      } else {
        window.addEventListener("load", function () {
          setTimeout(discoverQueryIds, 2000);
        });
      }
    })();`;
    (document.documentElement || document.head || document.body).appendChild(
      script,
    );
    script.remove();
  }

  injectMutationHook();
})();
