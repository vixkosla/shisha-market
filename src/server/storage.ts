import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { DomainError } from "@/lib/listings";

const localRoot = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_PATH ?? ".data/uploads",
  );
const keyPattern = /^[0-9a-f-]{36}\.webp$/;
function s3() {
  if (
    !process.env.S3_BUCKET ||
    !process.env.S3_ENDPOINT ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY
  )
    throw new Error("S3 configuration is incomplete.");
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "ru-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}
function isS3Storage() {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local" && driver !== "s3")
    throw new Error("Invalid STORAGE_DRIVER.");
  if (driver === "local" && process.env.NODE_ENV === "production")
    throw new Error("Configure private S3 storage in production.");
  return driver === "s3";
}
export async function preparePhoto(file: {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}) {
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw new DomainError("Фото должно быть не больше 8 МБ.");
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(bytes, {
      limitInputPixels: 36_000_000,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1
    )
      throw new Error("Unsupported image");
    const { data, info } = await image
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      storageKey: `${randomUUID()}.webp`,
    };
  } catch {
    throw new DomainError(
      "Не удалось прочитать фото. Поддерживаются JPG, PNG и WebP до 36 мегапикселей.",
    );
  }
}
export async function storePhoto(key: string, data: Buffer) {
  if (!keyPattern.test(key)) throw new Error("Invalid storage key");
  if (isS3Storage())
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: data,
        ContentType: "image/webp",
      }),
    );
  else {
    await mkdir(localRoot(), { recursive: true });
    await writeFile(path.join(localRoot(), key), data, {
      flag: "wx",
      mode: 0o600,
    });
  }
}
export async function readPhoto(key: string) {
  if (!keyPattern.test(key)) throw new Error("Invalid storage key");
  if (!isS3Storage())
    return new Uint8Array(await readFile(path.join(localRoot(), key)));
  const result = await s3().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
  );
  if (!result.Body) throw new Error("Missing object");
  return result.Body.transformToByteArray();
}
export async function deletePhoto(key: string) {
  if (!keyPattern.test(key)) throw new Error("Invalid storage key");
  if (isS3Storage())
    await s3().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
    );
  else await unlink(path.join(localRoot(), key));
}
