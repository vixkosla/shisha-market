import { developmentOnly, legalLaunchReady } from "./legal-policy";
// Local synthetic tests stay usable; public collection fails closed.
export const authenticationEnabled = () =>
  process.env.AUTH_ENABLED !== "false" &&
  (developmentOnly() || legalLaunchReady());

export const authUnavailable = () =>
  Response.json(
    { error: "Вход пока недоступен: площадка готовится к запуску." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
