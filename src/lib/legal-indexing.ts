// These documents remain public, but their operator details should not be
// promoted in search results. Keep crawlers able to read the noindex directive.
const operatorLegalSlugs = new Set([
  "privacy",
  "consent",
  "publication",
  "contact",
]);

export function hasOperatorLegalDetails(slug: string) {
  return operatorLegalSlugs.has(slug);
}

export const operatorLegalRobots = {
  index: false,
  follow: true,
  nosnippet: true,
} as const;

export function isOperatorLegalPath(pathname: string) {
  const match = pathname.match(/^\/(?:en\/)?legal\/([^/]+)\/?$/);
  return Boolean(match && hasOperatorLegalDetails(match[1]));
}
