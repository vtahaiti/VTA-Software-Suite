import { fetchWithAuth } from "./api-client";
import { getCurrentUser } from "./auth";

// Leave room for JSON keys below the API’s existing 100 KiB body limit.
const maxPhotoDataLength = 90 * 1024;
const maxSourceBytes = 20 * 1024 * 1024;

export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!file.size) throw new Error("L’image sélectionnée est vide.");
  if (file.size > maxSourceBytes) throw new Error("Choisissez une photo de moins de 20 Mo.");
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type) && !(file.type === "" && /\.(heic|heif)$/i.test(file.name))) {
    throw new Error("Choisissez une photo JPG, PNG, WebP ou HEIC.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error();
    for (const target of [512, 384, 256]) {
      const size = Math.min(side, target);
      canvas.width = size; canvas.height = size;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      for (const quality of [0.86, 0.72, 0.58, 0.44]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= maxPhotoDataLength) {
          validatePhotoData(dataUrl);
          return dataUrl;
        }
      }
    }
    throw new Error("La photo est trop volumineuse. Choisissez une autre image.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("La photo")) throw error;
    throw new Error("Impossible de lire cette photo. Essayez une image JPG ou PNG.");
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function validatePhotoData(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw new Error("La photo n’a pas pu être préparée.");
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!encoded || dataUrl.length > maxPhotoDataLength) throw new Error("La photo est trop volumineuse. Choisissez une autre image.");
}

export async function saveProfilePhoto(dataUrl: string): Promise<string> {
  validatePhotoData(dataUrl);
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("Connectez-vous à Internet pour enregistrer votre photo.");
  const owner = getCurrentUser();
  if (!owner) throw new Error("Reconnectez-vous pour modifier votre photo.");
  const sameAccount = () => {
    const current = getCurrentUser();
    if (current?.id !== owner.id || current?.tenantId !== owner.tenantId) throw new Error("La session a changé. Rouvrez votre profil.");
  };
  // JSON is supported by the existing upload endpoint and the iOS native
  // transport; avoid multipart boundary differences in WKWebView.
  const upload = await fetchWithAuth("/uploads/user-photo", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl })
  });
  if (!upload.ok) throw new Error(await photoError(upload, "Envoi de la photo impossible. Réessayez."));
  const uploaded = await upload.json() as { url?: string };
  if (!uploaded.url || /^(data|blob):/i.test(uploaded.url)) throw new Error("Le serveur n’a pas confirmé le fichier photo.");
  sameAccount();
  const response = await fetchWithAuth("/profile/photo", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoUrl: uploaded.url })
  });
  if (!response.ok) throw new Error(await photoError(response, "La photo n’a pas pu être enregistrée dans votre profil. Réessayez."));
  const profile = await response.json() as { profile?: { photoUrl?: string | null } };
  sameAccount();
  if (!profile.profile?.photoUrl) throw new Error("La photo n’a pas été confirmée par le serveur. Réessayez.");
  return profile.profile.photoUrl;
}

async function photoError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  return typeof message === "string" && message ? message : fallback;
}
