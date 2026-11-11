import { z } from "zod";
import { DomainError } from "@/lib/listings";

export const operatorPhotoInput = z.object({
  dataBase64: z.string().min(1, "Фотография пустая.").max(Math.ceil(8 * 1024 * 1024 / 3) * 4, "Фото должно быть не больше 8 МБ."),
});
export class OperatorRequestError extends DomainError {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readOperatorJson(request: Request, limit = 12 * 1024 * 1024): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit) throw new OperatorRequestError("Слишком большой запрос. Общий размер фотографий — до 8 МБ.", 413);
  if (!request.body) throw new OperatorRequestError("Нужен JSON.");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new OperatorRequestError("Слишком большой запрос. Общий размер фотографий — до 8 МБ.", 413); }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch (error) {
    if (error instanceof OperatorRequestError) throw error;
    throw new OperatorRequestError("Нужен корректный JSON.");
  } finally { reader.releaseLock(); }
}

export function decodeOperatorPhotos(files: {dataBase64: string}[]) {
  const decoded = files.map(file => {
    const raw = Buffer.from(file.dataBase64, "base64");
    if (!raw.length || raw.toString("base64") !== file.dataBase64) throw new DomainError("Нужна фотография в обычном base64, без префикса data:.");
    return raw;
  });
  if (decoded.reduce((sum, raw) => sum + raw.length, 0) > 8 * 1024 * 1024) throw new DomainError("Общий размер новых фотографий — до 8 МБ.");
  return decoded;
}
