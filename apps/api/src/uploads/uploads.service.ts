import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { extname, join } from "path";
import { mkdirSync, writeFileSync } from "fs";

@Injectable()
export class UploadsService {
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