import nodemailer from "nodemailer";

export async function sendServiceEmail(to: string, subject: string, text: string, key: string) {
  if ((process.env.MAIL_MODE ?? "console") === "console") {
    if (process.env.NODE_ENV === "production") throw new Error("Service email transport is not configured");
    return;
  }
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM) throw new Error("Service email transport is not configured");
  if (process.env.SMTP_HOST === "smtp.resend.com") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: {Authorization: `Bearer ${process.env.SMTP_PASSWORD}`, "Content-Type": "application/json", "Idempotency-Key": key},
      body: JSON.stringify({from: process.env.MAIL_FROM, to: [to], subject, text}),
    });
    if (!response.ok) throw new Error(`Service email failed: HTTP ${response.status}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_PORT === "465",
    requireTLS: true, disableFileAccess: true, disableUrlAccess: true, connectionTimeout: 8000, socketTimeout: 10000,
    auth: process.env.SMTP_USER ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD} : undefined,
  });
  await transport.sendMail({from: process.env.MAIL_FROM, to, subject, text});
}
