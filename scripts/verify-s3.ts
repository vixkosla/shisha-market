import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";
import { preparePhoto, storePhoto, readPhoto, deletePhoto } from "../src/server/storage";

if (process.env.STORAGE_DRIVER !== "s3") throw new Error("Use a real private S3 endpoint");
const bytes = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#234e42" } }).png().toBuffer();
const photo = await preparePhoto(new File([new Uint8Array(bytes)], "synthetic.png"));
const key = `${randomUUID()}.webp`;
let stored = false;
try {
  await storePhoto(key, photo.data);
  stored = true;
  assert.deepEqual(Buffer.from(await readPhoto(key)), photo.data);
  const anonymous = await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`);
  assert.equal(anonymous.status, 403, "Private objects must reject anonymous reads");
  console.info("Real S3 upload, exact readback and anonymous access denial passed.");
} finally {
  if (stored) await deletePhoto(key);
}
await assert.rejects(() => readPhoto(key));
console.info("Synthetic test object removed; missing-object read correctly fails.");
