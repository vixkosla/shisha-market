import { BookOpen, Compass, Factory, Flame, Layers3, Leaf, NotebookPen, Shapes, Wrench } from "lucide-react";

export function WikiSymbol({ name, size = 20 }: { name: string; size?: number }) {
  const icons = { brands: Factory, categories: Shapes, guide: NotebookPen, hookahs: Compass, bowls: Layers3, tobacco: Leaf, charcoal: Flame, accessories: Wrench };
  const Icon = icons[name as keyof typeof icons] ?? BookOpen;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

export function AtlasCompass({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="31" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="36" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 5" />
      <path d="M50 5V95M5 50H95M19 19L81 81M81 19L19 81" stroke="currentColor" strokeWidth="0.5" />
      <path d="M50 16L58 43L84 50L57 58L50 84L42 57L16 50L43 42Z" fill="var(--wiki-paper)" stroke="currentColor" />
      <path d="M50 16L50 50L43 42Z M84 50L50 50L57 58Z M50 84L50 50L42 57Z M16 50L50 50L43 42Z" fill="currentColor" />
      <circle cx="50" cy="50" r="3" fill="var(--wiki-accent)" />
    </svg>
  );
}
