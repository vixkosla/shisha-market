import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import type { Actor } from "@/lib/listings";
import { authenticationEnabled } from "./auth-policy";
import { loginHref } from "@/lib/login-return";
export async function currentUser() {
  if (!authenticationEnabled()) return null;
  const session = await (
    await getAuth()
  ).api.getSession({ headers: await headers() });
  if (!session) return null;
  return { ...session.user, role: session.user.role as Actor["role"] };
}
export async function requireUser(returnTo = "/account") {
  const user = await currentUser();
  if (!user) redirect(loginHref(returnTo));
  return user;
}
