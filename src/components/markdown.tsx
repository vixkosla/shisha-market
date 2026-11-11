import React from "react";
import { WikiLink as Link } from "@/components/wiki/wiki-link";
import { Link2 } from "lucide-react";
import { WikiTable } from "@/components/wiki/wiki-table";
import { closesWikiFence, getWikiHeadings, openingWikiFence, resolveWikiLink } from "@/lib/wiki-markdown";

interface MarkdownRendererProps {
  content: string;
  articleSlug: string;
  skipTitle?: boolean;
}

function parseInline(text: string, articleSlug: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex for bold, italic, links, inline code
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\)|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const linkText = match[2];
      const href = resolveWikiLink(match[3], articleSlug);
      if (href.startsWith("http")) {
        nodes.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
            {linkText}
            <span className="wiki-sr-only"> (откроется в новой вкладке)</span>
          </a>
        );
      } else {
        nodes.push(
          <Link key={key++} href={href}>
            {linkText}
          </Link>
        );
      }
    } else if (token.startsWith("`")) {
      const code = token.slice(1, -1);
      const scrollable = code.length > 32 || /^git\s/.test(code);
      nodes.push(<code key={key++} className={scrollable ? "wiki-code-scroll" : undefined} tabIndex={scrollable ? 0 : undefined} role={scrollable ? "region" : undefined} aria-label={scrollable ? "Строка кода, прокручивается по горизонтали" : undefined}>{code}</code>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderTable(lines: string[], startIdx: number, articleSlug: string, section: string): { table: React.ReactNode; endIdx: number } {
  const headerCells = lines[startIdx]
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "");
  const alignCells = lines[startIdx + 1]
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "");
  const rows: string[][] = [];
  let idx = startIdx + 2;
  while (idx < lines.length && lines[idx].includes("|") && lines[idx].trim() !== "") {
    const cells = lines[idx]
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c !== "");
    rows.push(cells);
    idx++;
  }
  return {
    table: (
      <WikiTable label={section}>
        <table className={headerCells.length >= 3 ? "wiki-table-wide" : undefined}>
          <thead>
            <tr>
              {headerCells.map((cell, i) => (
                <th key={i} scope="col" style={{ textAlign: alignCells[i]?.endsWith(":") ? (alignCells[i].startsWith(":") ? "center" : "right") : "left" }}>
                  {parseInline(cell, articleSlug)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{parseInline(cell, articleSlug)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </WikiTable>
    ),
    endIdx: idx,
  };
}

export function MarkdownRenderer({ content, articleSlug, skipTitle = false }: MarkdownRendererProps) {
  const lines = content.split("\n");
  const headings = new Map(getWikiHeadings(content).map((heading) => [heading.line, heading]));
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let skippedTitle = false;
  let section = "Данные статьи";

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Keep Markdown examples as code rather than interpreting their links or headings.
    const fence = openingWikiFence(line);
    if (fence) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !closesWikiFence(lines[i], fence)) {
        codeLines.push(lines[i++]);
      }
      if (i < lines.length) i++;
      elements.push(<pre key={key++} tabIndex={0} role="region" aria-label="Пример кода, прокручивается по горизонтали"><code>{codeLines.join("\n")}</code></pre>);
      continue;
    }

    // Headings
    const heading = headings.get(i);
    if (heading) {
      section = heading.title;
      const Tag = heading.level === 2 ? "h2" : "h3";
      const text = line.replace(/^#{2,3}\s+/, "").replace(/\s+#+\s*$/, "");
      elements.push(<Tag key={key++} id={heading.id} tabIndex={-1} aria-label={heading.title}>{parseInline(text, articleSlug)}<a className="wiki-heading-link" href={`#${heading.id}`} aria-label={`Ссылка на раздел «${heading.title}»`}><Link2 size={16} aria-hidden="true" /></a></Tag>);
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      if (skipTitle && !skippedTitle) { skippedTitle = true; i++; continue; }
      elements.push(<h1 key={key++}>{parseInline(line.slice(2), articleSlug)}</h1>);
      i++;
      continue;
    }

    // Tables
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].includes("---")) {
      const { table, endIdx } = renderTable(lines, i, articleSlug, section);
      elements.push(<React.Fragment key={key++}>{table}</React.Fragment>);
      i = endIdx;
      continue;
    }

    // Unordered list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className={section === "См. также" ? "wiki-related-links" : undefined}>
          {items.map((item, j) => (
            <li key={j}>{parseInline(item, articleSlug)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={key++}>
          {items.map((item, j) => (
            <li key={j}>{parseInline(item, articleSlug)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={key++}>
          {quoteLines.map((ql, j) => (
            <p key={j}>{parseInline(ql, articleSlug)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Regular paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3} /.test(lines[i]) &&
      !openingWikiFence(lines[i]) &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("> ") &&
      !/^\d+\.\s/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && lines[i + 1].includes("---"))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++}>
          {paraLines.map((pl, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {parseInline(pl, articleSlug)}
            </React.Fragment>
          ))}
        </p>
      );
    } else {
      // Malformed/empty block markers must still advance the parser.
      elements.push(<p key={key++}>{parseInline(lines[i], articleSlug)}</p>);
      i++;
    }
  }

  return <div className="wiki-content">{elements}</div>;
}
