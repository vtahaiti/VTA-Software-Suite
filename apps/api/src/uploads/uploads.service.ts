import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

function detectedImageType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: ".jpg" };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: ".png" };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", extension: ".webp" };
  }
  return null;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly r2Client: S3Client | null;
  private readonly r2Bucket = process.env.R2_BUCKET_NAME;
  private readonly r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.r2Client = accountId && accessKeyId && secretAccessKey && this.r2Bucket && this.r2PublicUrl
      ? new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } })
      : null;
    // Sans R2 configure (ex. dev local), on retombe sur le disque local comme avant - mais en
    // production, sans ces variables, tout fichier uploade (logo, photo) est perdu au prochain
    // redeploiement du conteneur : voir apps/api/Dockerfile, le dossier uploads/ n'est pas un
    // volume persistant.
    if (!this.r2Client) this.logger.warn("R2 non configuré : les fichiers uploadés seront stockés sur disque local (non persistant en production).");
  }

  async saveImageFile(folder: "tenants" | "users", file?: UploadedImage) {
    if (!file?.buffer?.length) throw new BadRequestException("Aucun fichier reçu.");
    if ((file.size ?? file.buffer.length) > MAX_IMAGE_SIZE_BYTES) throw new BadRequestException("Le fichier est trop grand. Taille maximale : 2 Mo.");
    const declaredExtension = ALLOWED_IMAGE_MIME_TYPES.get(file.mimetype ?? "");
    const detected = detectedImageType(file.buffer);
    if (!declaredExtension || !detected || detected.extension !== declaredExtension) {
      throw new BadRequestException("Le contenu du fichier ne correspond pas à une image PNG, JPG, JPEG ou WebP valide.");
    }
    const fileName = `${randomUUID()}${detected.extension}`;
    return this.store(folder, fileName, file.buffer, detected.mime);
  }

  async saveDataUrl(folder: "tenants" | "users", dataUrl?: string) {
    if (!dataUrl?.startsWith("data:")) return null;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) throw new BadRequestException("Le fichier est trop grand. Taille maximale : 2 Mo.");
    const detected = detectedImageType(buffer);
    const extension = this.extensionFromMime(mime);
    if (!extension) throw new BadRequestException("Format d'image non accepté.");
    if (!detected || detected.extension !== extension) throw new BadRequestException("Image invalide.");
    const fileName = `${randomUUID()}${extension}`;
    return this.store(folder, fileName, buffer, detected.mime);
  }

  normalizeUploadedName(folder: "tenants" | "users", fileName?: string) {
    if (!fileName) return null;
    const safeName = `${randomUUID()}${extname(fileName) || ".png"}`;
    return this.r2Client && this.r2PublicUrl ? `${this.r2PublicUrl}/${folder}/${safeName}` : `/uploads/${folder}/${safeName}`;
  }

  private async store(folder: "tenants" | "users", fileName: string, buffer: Buffer, contentType: string) {
    if (this.r2Client && this.r2Bucket && this.r2PublicUrl) {
      await this.r2Client.send(new PutObjectCommand({ Bucket: this.r2Bucket, Key: `${folder}/${fileName}`, Body: buffer, ContentType: contentType }));
      return `${this.r2PublicUrl}/${folder}/${fileName}`;
    }
    const targetDir = join(process.cwd(), "uploads", folder);
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, fileName), buffer);
    return `/uploads/${folder}/${fileName}`;
  }

  private extensionFromMime(mime: string) {
    if (mime === "image/jpeg") return ".jpg";
    if (mime === "image/png") return ".png";
    if (mime === "image/webp") return ".webp";
    return null;
  }
}
