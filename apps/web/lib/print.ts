import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function openPrintPreview(path: string) {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!response.ok) throw new Error("Aperçu impression impossible");
  const html = await response.text();
  const printableHtml = html.replace("</body>", "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script></body>");
  const previewUrl = window.URL.createObjectURL(new Blob([printableHtml], { type: "text/html;charset=utf-8" }));
  window.location.href = previewUrl;
  window.setTimeout(() => window.URL.revokeObjectURL(previewUrl), 60_000);
}

export async function printHtml(path: string) {
  await openPrintPreview(path);
}

export async function downloadPdf(path: string, filename: string) {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!response.ok) throw new Error("Telechargement PDF impossible");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
