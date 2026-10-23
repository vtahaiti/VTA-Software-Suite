import { printHtmlNative, shareFileNative } from "@/lib/native-print";

// Install only in the embedded iOS runtime. Existing desktop actions keep their
// browser behavior; iOS exports use the system share sheet and print dialog.
export function installIosDocumentActions() {
  const blobs = new Map<string, Blob>();
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const print = window.print;
  let printing = false;
  URL.createObjectURL = blob => {
    const url = create.call(URL, blob);
    if (blob instanceof Blob) blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = url => { blobs.delete(url); revoke.call(URL, url); };
  const fail = (error: unknown) => window.alert(error instanceof Error ? error.message : "Action indisponible. Réessayez.");
  const download = (event: MouseEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[download]") : null;
    const blob = anchor && blobs.get(anchor.href);
    if (!anchor || !blob) return;
    event.preventDefault();
    void shareFileNative(blob, anchor.download || "export.csv").catch(fail);
  };
  window.print = () => {
    if (printing) return;
    printing = true;
    const content = (document.querySelector(".printable-document") ?? document.querySelector("main") ?? document.body).cloneNode(true) as HTMLElement;
    content.querySelectorAll("script,button,nav,input,select,textarea,[aria-hidden=true]").forEach(el => el.remove());
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font:12px -apple-system,Arial;color:#111;padding:18px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:left}h1{font-size:22px}h2{font-size:17px}img{max-width:150px}.hidden{display:none}</style></head><body>${content.innerHTML}</body></html>`;
    void printHtmlNative({ html, title: document.title, format: "A4" }).catch(fail).finally(() => { printing = false; });
  };
  document.addEventListener("click", download, true);
  return () => {
    document.removeEventListener("click", download, true);
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    window.print = print;
    blobs.clear();
  };
}
