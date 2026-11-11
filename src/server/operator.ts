import { createHash, timingSafeEqual } from "node:crypto";

export function operatorTokenConfigured() {
  return (process.env.OPERATOR_TOKEN ?? "").length >= 32;
}

export function operatorAuthorized(request: Request) {
  const token = process.env.OPERATOR_TOKEN ?? "";
  if (token.length < 32) return false;
  const header = request.headers.get("authorization") ?? "";
  const got = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = createHash("sha256").update(got).digest();
  const right = createHash("sha256").update(token).digest();
  return timingSafeEqual(left, right) && got.length === token.length;
}
