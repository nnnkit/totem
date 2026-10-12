export const OPENPANEL_ORIGIN = "https://stats.holdon.site";

const openPanelBootstrap = (clientId: string) => `
  var openPanelEnabled = (location.hostname === 'usetotem.xyz' || location.hostname === 'www.usetotem.xyz')
    && window.top === window.self && !new URLSearchParams(location.search).has('embed');
  if (openPanelEnabled) {
    window.op = window.op || function () {
      var queue = [];
      return new Proxy(function () {
        if (arguments.length) queue.push(Array.from(arguments));
      }, {
        get: function (_, method) {
          return method === 'q' ? queue : function () {
            queue.push([method].concat(Array.from(arguments)));
          };
        },
        has: function (_, method) { return method === 'q'; }
      });
    }();
    window.op('init', {
      clientId: ${JSON.stringify(clientId)},
      apiUrl: '${OPENPANEL_ORIGIN}/api',
      trackScreenViews: true,
      trackOutgoingLinks: true,
      trackAttributes: false,
      filter: function (event) {
        var properties = event.payload && event.payload.properties;
        if (!properties) return true;
        ['__path', '__referrer'].forEach(function (key) {
          if (!properties[key]) return;
          try {
            var url = new URL(properties[key]);
            var campaign = new URLSearchParams();
            if (key === '__path') {
              ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (name) {
                var value = url.searchParams.get(name);
                if (value) campaign.set(name, value);
              });
            }
            url.search = campaign.toString();
            url.hash = '';
            properties[key] = url.href;
          } catch (_) {
            delete properties[key];
          }
        });
        return true;
      }
    });
    var openPanelScript = document.createElement('script');
    openPanelScript.src = '${OPENPANEL_ORIGIN}/op1.js';
    openPanelScript.defer = true;
    document.head.appendChild(openPanelScript);
  }`;

export function analyticsScript(openPanelClientId?: string): string {
  const clientId = openPanelClientId?.trim();
  return `(function () {
  window.totemBeforeSend = function (type, payload) {
    if (window.top !== window.self || new URLSearchParams(location.search).has('embed')) return null;
    return payload;
  };${clientId ? openPanelBootstrap(clientId) : ""}
  function track(name, properties) {
    window.umami?.track(name, properties);${clientId ? "\n    if (openPanelEnabled) window.op('track', name, properties);" : ""}
  }
  document.addEventListener('click', function (event) {
    var link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    var name = link.hostname === 'chromewebstore.google.com' ? 'install_click'
      : link.pathname.endsWith('.zip') ? 'download_click' : null;
    if (name) track(name, { destination: link.hostname });
  }, true);
})();`;
}
