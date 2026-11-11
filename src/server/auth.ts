import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDatabase, type Database } from "./db";
import * as schema from "./db/schema";
import { authenticationEnabled, authUnavailable } from "./auth-policy";
import { hasLoginAcceptance, LEGAL_VERSION } from "@/lib/legal";
import { legalConfiguration } from "./legal-policy";
import { legalDocuments } from "./legal-documents";

export const appUrl = () => process.env.APP_URL ?? "http://127.0.0.1:4387";
// Keep credentials/configuration, but do not open OAuth before a consent flow
// surviving the provider redirect is implemented and verified.
export const vkEnabled = () => false;
type OtpSender = (data: {
  email: string;
  otp: string;
  type: string;
}) => Promise<void>;
const sendOtp: OtpSender = async ({ email, otp }) => {
  if ((process.env.MAIL_MODE ?? "console") === "console") {
    if (process.env.NODE_ENV === "production")
      throw new Error("Configure SMTP before production sign-in.");
    console.info(`[LOCAL EMAIL ONLY] ${email}: ${otp}`);
    return;
  }
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
    throw new Error("SMTP_HOST and MAIL_FROM are required.");
  // Port 465 to Resend does not open from this VPS. The HTTPS API does.
  if (process.env.SMTP_HOST === "smtp.resend.com") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMTP_PASSWORD}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [email],
        subject: "Код входа в Shisha Market",
        text: `Ваш код: ${otp}. Действует 5 минут. Если вы не запрашивали вход, проигнорируйте письмо.`,
      }),
    });
    if (!response.ok) throw new Error("Не удалось отправить код входа.");
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    requireTLS: true,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Код входа в Shisha Market",
    text: `Ваш код: ${otp}. Действует 5 минут. Если вы не запрашивали вход, проигнорируйте письмо.`,
  });
};
const globalAuth = globalThis as unknown as {
  shishaAuth?: Promise<ReturnType<typeof createAuth>>;
  shishaDevSecret?: string;
  shishaAuthDatabases?: WeakMap<object, Database>;
};
// Next's page/route bundles and HMR share the cached auth object. Its database
// mapping must have the same lifetime rather than being local to one bundle.
const authDatabases = (globalAuth.shishaAuthDatabases ??= new WeakMap<
  object,
  Database
>());
export function createAuth(db: Database, sender: OtpSender = sendOtp) {
  let secret = process.env.BETTER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV !== "production")
    secret = globalAuth.shishaDevSecret ??= randomBytes(32).toString("hex");
  if (!secret || secret.length < 32)
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  const auth = betterAuth({
    appName: "Shisha Market",
    baseURL: appUrl(),
    secret,
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    trustedOrigins: [appUrl()],
    session: { expiresIn: 7 * 86400 },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ![
            "/get-session",
            "/sign-out",
            "/email-otp/send-verification-otp",
            "/sign-in/email-otp",
          ].includes(ctx.path)
        )
          throw new APIError("FORBIDDEN", {
            message: "Этот сценарий авторизации пока не открыт в пилоте.",
          });
        if (
          ctx.path === "/email-otp/send-verification-otp" &&
          ctx.body?.type !== "sign-in"
        )
          throw new APIError("FORBIDDEN", {
            message: "Доступны только коды входа.",
          });
        if (
          ["/email-otp/send-verification-otp", "/sign-in/email-otp"].includes(
            ctx.path,
          )
        ) {
          if (!authenticationEnabled())
            throw new APIError("FORBIDDEN", {
              message: "Вход пока недоступен.",
            });
          if (!hasLoginAcceptance(ctx.headers))
            throw new APIError("BAD_REQUEST", {
              message:
                "Отдельно примите актуальные условия, согласие на обработку и подтвердите возраст.",
            });
        }
      }),
    },
    user: {
      additionalFields: {
        role: {
          type: ["member", "moderator", "admin"],
          defaultValue: "member",
          input: false,
        },
      },
    },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    socialProviders: vkEnabled()
      ? {
          vk: {
            clientId: process.env.VK_CLIENT_ID!,
            clientSecret: process.env.VK_CLIENT_SECRET!,
            disableDefaultScope: true,
            scope: ["email"],
          },
        }
      : {},
    rateLimit: { enabled: true, window: 60, max: 30 },
    plugins: [
      emailOTP({
        sendVerificationOTP: sender,
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: "hashed",
      }),
    ],
  });
  authDatabases.set(auth, db);
  return auth;
}
export async function getAuth() {
  return (globalAuth.shishaAuth ??= getDatabase()
    .then((db) => createAuth(db))
    .catch((error) => {
      globalAuth.shishaAuth = undefined;
      throw error;
    }));
}
export async function handleAuthRequest(
  auth: ReturnType<typeof createAuth>,
  request: Request,
) {
  if (!authenticationEnabled()) return Promise.resolve(authUnavailable());
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== new URL(appUrl()).origin
  ) {
    return Promise.resolve(
      Response.json({ error: "Forbidden origin" }, { status: 403 }),
    );
  }
  const response = await auth.handler(request);
  if (
    response.ok &&
    request.method === "POST" &&
    new URL(request.url).pathname.endsWith("/sign-in/email-otp")
  ) {
    const result = await response.clone().json();
    const db = authDatabases.get(auth);
    if (!db || !result.user?.id || !hasLoginAcceptance(request.headers))
      return Response.json(
        { error: "Не удалось зафиксировать согласие." },
        { status: 503 },
      );
    const documents = legalDocuments();
    try {
      await db.insert(schema.legalAcceptances).values(
        ["terms", "processing"].map((kind) => ({
          id: randomUUID(),
          userId: result.user.id,
          kind,
          version: LEGAL_VERSION,
          evidence: {
            adult: true,
            method: "verified-email-otp",
            configuration: legalConfiguration(),
            document: kind === "terms" ? documents.terms : documents.consent,
            rules: kind === "terms" ? documents.rules : undefined,
            privacy: kind === "processing" ? documents.privacy : undefined,
          },
        })),
      );
      const email = result.user.email?.toLowerCase();
      const operators = [
        process.env.LEGAL_CONTACT_EMAIL,
        process.env.MAIL_FROM,
      ]
        .map((value) => value?.match(/[^\s<>]+@[^\s<>]+/)?.[0].toLowerCase())
        .filter(Boolean);
      if (email && operators.includes(email))
        await db
          .update(schema.user)
          .set({ role: "admin" })
          .where(eq(schema.user.id, result.user.id));
    } catch {
      // Do not deliver a new session cookie if its acceptance could not be recorded.
      return Response.json(
        { error: "Не удалось сохранить согласие. Повторите вход." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return response;
}
