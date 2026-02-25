// Content script: runs in MAIN world at document_start on x.com
// Hooks fetch/XHR to detect bookmark mutations and discovers query IDs
(() => {
  if (window.__totemBookmarkMutationHookInstalled) return;
  window.__totemBookmarkMutationHookInstalled = true;

  const SOURCE = "totem-bookmark-mutation";

  const parseTweetIdFromObject = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    const variables =
      obj.variables && typeof obj.variables === "object" ? obj.variables : null;
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
    if (/\/CreateBookmark(?:\?|$)/.test(url)) return "CreateBookmark";
    if (/\/DeleteBookmark(?:\?|$)/.test(url)) return "DeleteBookmark";
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
      this.__totemUrl = typeof args[1] === "string" ? args[1] : "";
    } catch {}
    return originalOpen.apply(this, args);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      const operation = operationFromUrl(this.__totemUrl || "");
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

  function discoverQueryIds() {
    if (window.__totemQidsScanned) return;
    window.__totemQidsScanned = true;

    var targets = ["DeleteBookmark", "CreateBookmark", "TweetDetail"];
    var found = {};
    var scripts = document.querySelectorAll("script[src]");
    var queue = [];
    for (var i = 0; i < scripts.length && i < 20; i++) {
      if (scripts[i].src) queue.push(scripts[i].src);
    }

    var idx = 0;
    function extractPairedQueryId(text, operationName) {
      // Match queryId immediately paired with the operationName (same object literal).
      // Pattern: queryId:"<id>",operationName:"<name>"
      var re = new RegExp(
        'queryId\\s*:\\s*["\']([A-Za-z0-9_\\-]{10,50})["\']\\s*,\\s*operationName\\s*:\\s*["\']' +
          operationName +
          '["\']'
      );
      var m = text.match(re);
      if (m) return m[1];
      // Also try reversed order: operationName:"<name>",operationId/queryId:"<id>"
      var re2 = new RegExp(
        'operationName\\s*:\\s*["\']' +
          operationName +
          '["\']\\s*,\\s*(?:queryId|operationId)\\s*:\\s*["\']([A-Za-z0-9_\\-]{10,50})["\']'
      );
      var m2 = text.match(re2);
      return m2 ? m2[1] : null;
    }
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
            var qid = extractPairedQueryId(text, name);
            if (qid) found[name] = qid;
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
})();
