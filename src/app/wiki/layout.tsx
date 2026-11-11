import "./wiki.css";

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return <div className="wiki-atlas">{children}</div>;
}
