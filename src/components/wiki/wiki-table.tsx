"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight } from "lucide-react";

export function WikiTable({ label, children }: { label: string; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollWidth > element.clientWidth + 1);
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const table = element.querySelector("table");
    if (table) observer.observe(table);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [children]);

  return (
    <div className="wiki-table-block">
      <div ref={viewport} className="wiki-table-wrapper" role="region" tabIndex={0} aria-label={`Таблица: ${label}${overflows ? ". Прокручивается по горизонтали" : ""}`} aria-describedby={overflows ? hintId : undefined}>
        {children}
      </div>
      {overflows && <p className="wiki-table-hint" id={hintId}><ArrowLeftRight size={15} aria-hidden="true" />Прокрутите таблицу вбок</p>}
    </div>
  );
}
