import {LEGAL_VERSION} from "@/lib/legal";
import {legalDocuments} from "@/server/legal-documents";
import {appUrl} from "@/server/auth";
import {allowedMarkets} from "@/server/legal-policy";
export async function GET() {
  const docs = legalDocuments();
  return Response.json({version: LEGAL_VERSION, allowedMarkets: allowedMarkets(), rules: docs.rules, publication: docs.publication,
    rulesUrl: `${appUrl()}/legal/rules`, publicationUrl: `${appUrl()}/legal/publication`,
    requiredConsent: {version: LEGAL_VERSION, fullName: "User-provided full name, kept private", personalItem: "Explicit confirmation this is their personal used item", adult: "Explicit age 18+ confirmation", contact: "Separate permission to publish this exact profile link", city: "Separate permission to publish this exact country/city", conditions: "User-specified additional conditions, or empty string"},
    instructions: "Show the user the final listing, photos, contact and city before asking for the separate confirmations. Account connection is not publication consent. Do not invent a name, consent, ownership or permission to use photos. No publish or moderation tools are available to personal agents."}, {headers: {"Cache-Control": "no-store"}});
}
