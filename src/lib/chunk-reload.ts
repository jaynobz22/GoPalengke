// Auto-recovers the app when a new deploy replaced old JS chunks
// (installed phone app / cached tab still asking for removed files).
const KEY = "gp_chunk_reload_at";

function isChunkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i.test(
    msg,
  );
}

export function reloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 10000) return false; // avoid loops (e.g. offline)
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
  return true;
}

export function lazyWithReload<T>(factory: () => Promise<T>): () => Promise<T> {
  return () =>
    factory().catch((err) => {
      if (isChunkError(err) && reloadOnce()) {
        return new Promise<T>(() => {}); // wait for reload
      }
      throw err;
    });
}

let installed = false;
export function installChunkReloadGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("vite:preloadError", (e) => {
    if (reloadOnce()) e.preventDefault();
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (isChunkError(e.reason)) reloadOnce();
  });
}
