import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasOperatorLegalDetails,
  isOperatorLegalPath,
  operatorLegalRobots,
} from "@/lib/legal-indexing";
import { legalDocuments } from "@/server/legal-documents";
import { legalDocumentsEn } from "@/server/legal-documents-en";

afterEach(() => vi.unstubAllEnvs());

describe("operator details and search indexing", () => {
  it("excludes every document containing the operator identity in both languages", () => {
    const operator = "Synthetic indexing test operator";
    const address = "Synthetic indexing test address";
    vi.stubEnv("LEGAL_OPERATOR_NAME", operator);
    vi.stubEnv("LEGAL_OPERATOR_ADDRESS", address);
    for (const documents of [legalDocuments(), legalDocumentsEn()]) {
      for (const [slug, sections] of Object.entries(documents)) {
        const text = sections.flatMap((section) => section.paragraphs).join("\n");
        expect(hasOperatorLegalDetails(slug), slug).toBe(
          text.includes(operator) || text.includes(address),
        );
      }
    }
    expect(operatorLegalRobots).toEqual({
      index: false,
      follow: true,
      nosnippet: true,
    });
  });

  it("targets only individual operator documents, not the catalog or legal index", () => {
    for (const prefix of ["", "/en"]) {
      for (const slug of ["privacy", "consent", "publication", "contact"]) {
        expect(isOperatorLegalPath(`${prefix}/legal/${slug}`)).toBe(true);
        expect(isOperatorLegalPath(`${prefix}/legal/${slug}/`)).toBe(true);
      }
      for (const path of ["", "/legal", "/legal/rules", "/legal/terms", "/legal/cookies", "/legal/contact/extra"]) {
        expect(isOperatorLegalPath(`${prefix}${path}`), path).toBe(false);
      }
    }
    expect(isOperatorLegalPath("/listings/contact")).toBe(false);
    expect(isOperatorLegalPath("/api/legal/privacy")).toBe(false);
  });
});
