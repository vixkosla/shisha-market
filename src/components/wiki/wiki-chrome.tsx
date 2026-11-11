import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Compass, PencilLine } from "lucide-react";

export function WikiMasthead({ article = false }: { article?: boolean }) {
  return (
    <div className="wiki-masthead">
      <Link href="/wiki" className="wiki-masthead-name">
        {article ? <ArrowLeft size={17} aria-hidden="true" /> : <Compass size={20} aria-hidden="true" />}
        <span>Shisha Market <strong>Wiki</strong></span>
      </Link>
      <span className="wiki-masthead-caption">Электронная энциклопедия</span>
      <Link href="/wiki/guide/contributing" className="wiki-masthead-edit"><PencilLine size={15} aria-hidden="true" /><span>Как редактировать</span></Link>
    </div>
  );
}

export function WikiLicense() {
  return (
    <footer className="wiki-license">
      <span>Контент вики распространяется по лицензии <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0<ArrowUpRight size={13} aria-hidden="true" /><span className="wiki-sr-only"> (откроется в новой вкладке)</span></a></span>
      <span>Shisha Market Wiki</span>
    </footer>
  );
}
