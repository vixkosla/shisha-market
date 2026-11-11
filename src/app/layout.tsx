import type { Metadata } from "next";
import { headers } from "next/headers";
import { currentUser } from "@/server/session";
import { isModerator } from "@/lib/listings";
import type { Locale } from "@/lib/i18n";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import "@fontsource/zilla-slab/700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://127.0.0.1:4387"),
  title: {
    default: "Shisha Market — кальянная барахолка",
    template: "%s · Shisha Market",
  },
  description:
    "Информационная площадка частных объявлений. Правила размещения, модерация и прямое общение участников.",
  robots: { index: true, follow: true },
  icons: { icon: "/brand-mark.svg", apple: "/favicon.png" },
  openGraph: { images: ["/og.jpg"] },
};
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale: Locale =
    requestHeaders.get("x-shisha-locale") === "en" ? "en" : "ru";
  const user = await currentUser();
  const gaId = process.env.GA_MEASUREMENT_ID?.match(/^G-[A-Z0-9]{4,24}$/)?.[0];
  const origin = (process.env.APP_URL ?? "http://127.0.0.1:4387").replace(
    /\/$/,
    "",
  );
  const email =
    process.env.LEGAL_CONTACT_EMAIL?.trim() || "hello@shisha-market.com";
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Shisha Market",
      url: origin,
      logo: `${origin}/brand-mark.svg`,
      email,
      sameAs: ["https://vk.ru/shishamarket"],
    },
  ];
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        {process.env.METRIKA_COUNTER_ID ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${Number(process.env.METRIKA_COUNTER_ID)}","ym");ym(${Number(process.env.METRIKA_COUNTER_ID)},"init",{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});`,
            }}
          />
        ) : null}
        {gaId ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${gaId}");`,
              }}
            />
          </>
        ) : null}
        <SiteHeader
          signedIn={Boolean(user)}
          moderator={Boolean(user && isModerator(user))}
          origin={origin}
        />
        <main id="main" className="shell">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
