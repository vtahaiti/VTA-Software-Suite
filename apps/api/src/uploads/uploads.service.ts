import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { extname, join } from "path";
import { mkdirSync, writeFileSync } from "fs";

type UploadedImage = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

@Injectable()
export class UploadsService {
  saveImageFile(folder: "tenants" | "users", file?: UploadedImage) {
    if (!file?.buffer?.length) throw new BadRequestException("Aucun fichier reçu.");
    if ((file.size ?? file.buffer.length) > MAX_IMAGE_SIZE_BYTES) throw new BadRequestException("Le fichier est trop grand. Taille maximale : 2 Mo.");
    const extension = ALLOWED_IMAGE_MIME_TYPES.get(file.mimetype ?? "");
    if (!extension) throw new BadRequestException("Format non accepté. Utilisez PNG, JPG, JPEG ou WebP.");
    const fileName = `${randomUUID()}${extension}`;
    const targetDir = join(process.cwd(), "uploads", folder);
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, fileName), file.buffer);
    return `/uploads/${folder}/${fileName}`;
  }

  saveDataUrl(folder: "tenants" | "users", dataUrl?: string, fallbackExtension = ".png") {
    if (!dataUrl?.startsWith("data:")) return null;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const extension = this.extensionFromMime(mime) ?? fallbackExtension;
    const fileName = `${randomUUID()}${extension}`;
    const targetDir = join(process.cwd(), "uploads", folder);
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, fileName), Buffer.from(match[2], "base64"));
    return `/uploads/${folder}/${fileName}`;
  }

  normalizeUploadedName(folder: "tenants" | "users", fileName?: string) {
    if (!fileName) return null;
    const safeName = `${randomUUID()}${extname(fileName) || ".png"}`;
    return `/uploads/${folder}/${safeName}`;
  }

  private extensionFromMime(mime: string) {
    if (mime === "image/jpeg") return ".jpg";
    if (mime === "image/png") return ".png";
    if (mime === "image/webp") return ".webp";
    return null;
  }
}
