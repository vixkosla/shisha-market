import Link from "next/link";
import type {AnchorHTMLAttributes} from "react";
import {wikiReviewPending} from "@/lib/wiki-review";

/** Crossing into a withheld reference starts a fresh document. This avoids
 * retaining the previous route's robots metadata during streamed navigation.
 * Published article/task links retain normal client navigation and prefetch.
 */
export function WikiLink({href, ...props}: AnchorHTMLAttributes<HTMLAnchorElement> & {href: string}) {
  const slug = href.startsWith("/wiki/") ? href.slice(6).split(/[?#]/, 1)[0] : "";
  return wikiReviewPending(slug) ? <a href={href} {...props} /> : <Link href={href} {...props} />;
}
