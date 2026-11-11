/** Legacy pages whose claimed manufacturer could not be established from primary sources.
 * Keep their URLs and notebook keys, but do not promote unverified stubs to search engines.
 * Remove an entry only after replacing the stub with sourced, substantive information.
 */
export const WIKI_PENDING_REVIEW = new Set([
  "brands/bull-brand",
  "brands/frost",
  "brands/lemon-mustache",
  "brands/lfs",
  "brands/nuke",
]);

export function wikiReviewPending(slug: string) {
  return WIKI_PENDING_REVIEW.has(slug);
}
