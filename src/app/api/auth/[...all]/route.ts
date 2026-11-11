import { getAuth, handleAuthRequest } from "@/server/auth";
import { authenticationEnabled, authUnavailable } from "@/server/auth-policy";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!authenticationEnabled()) return authUnavailable();
  return handleAuthRequest(await getAuth(), request);
}
export async function POST(request: Request) {
  if (!authenticationEnabled()) return authUnavailable();
  return handleAuthRequest(await getAuth(), request);
}
