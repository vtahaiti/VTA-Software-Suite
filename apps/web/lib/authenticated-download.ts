"use client";

import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { getAccessToken } from "@/lib/auth";

export async function downloadAuthenticatedFile(url: string, fallbackName: string) {
  const token = getAccessToken();
  if (!token) throw new Error("Session expirée. Reconnectez-vous pour télécharger ce fichier.");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include"
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Session expirée. Reconnectez-vous.");
    if (response.status === 403) throw new Error("Accès non autorisé.");
    if (response.status === 404) throw new Error("Fichier introuvable.");
    if (response.status === 413) throw new Error("Fichier trop volumineux.");
    throw new Error("Téléchargement impossible.");
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (contentType.includes("application/json")) throw new Error("Le serveur a retourné une erreur au lieu du fichier.");

  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) throw new Error("Le fichier téléchargé est vide.");

  const fileName = safeFileName(readFileName(response) ?? fallbackName, contentType);

  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: arrayBufferToBase64(buffer),
      directory: Directory.Cache
    });
    await Share.share({ title: fileName, url: result.uri, dialogTitle: "Partager le fichier" });
    return;
  }

  const blob = new Blob([buffer], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function readFileName(response: Response) {
  const disposition = response.headers.get("content-disposition");
  if (!disposition) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  return match ? decodeURIComponent(match[1].replace(/"/g, "")) : null;
}

function safeFileName(value: string, contentType: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "-") || "vta-export";
  if (/\.[a-z0-9]+$/i.test(cleaned)) return cleaned;
  if (contentType.includes("spreadsheet")) return `${cleaned}.xlsx`;
  if (contentType.includes("pdf")) return `${cleaned}.pdf`;
  if (contentType.includes("csv")) return `${cleaned}.csv`;
  return `${cleaned}.bin`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
