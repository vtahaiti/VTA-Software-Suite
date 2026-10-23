// Use PNG output: Safari may silently fall back to PNG when asked to encode
// WebP. The upload API checks the image bytes against its declared MIME type.
export async function optimizeCompanyLogo(file: File) {
  if (!["image/png","image/jpeg","image/webp"].includes(file.type)) throw new Error("Choisissez un logo PNG, JPG ou WebP.");
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Choisissez une image de moins de 20 Mo.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Image illisible.");
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image illisible.");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,"image/png"));
    if (!blob || blob.type !== "image/png" || blob.size > 2 * 1024 * 1024) throw new Error("Le logo n’a pas pu être préparé. Essayez une autre image.");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: blob.type });
  } finally { URL.revokeObjectURL(url); }
}
