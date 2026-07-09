import { getAccessToken } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function openPrintPreview(path: string) {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!response.ok) throw new Error("Apercu impression impossible");
  const html = await response.text();
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) throw new Error("Le navigateur a bloque la fenetre d impression");
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
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