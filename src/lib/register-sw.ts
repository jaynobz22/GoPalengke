// Registers /sw.js for offline support — only on the real published site.
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const host = window.location.hostname;
  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "localhost" ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(host) ||
    /(^|\.)beta\.lovable\.dev$/.test(host) ||
    new URLSearchParams(window.location.search).has("sw");
  if (refused) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") {
      navigator.serviceWorker.getRegistrations().then((regs) =>
        regs.forEach((r) => r.active?.scriptURL.endsWith("/sw.js") && r.unregister()),
      );
    }
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
