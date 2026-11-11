"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Check, Copy, Pause, Play, Scan } from "lucide-react";
import { BrandMark, Shamsa } from "@/components/brand-mark";
import styles from "@/app/brand/brandbook.module.css";

const sizes = [
  { id: "compact", name: "Компактный", value: 21 },
  { id: "standard", name: "Обычный", value: 34 },
  { id: "large", name: "Крупный", value: 44 },
] as const;

export function SignSpecimen() {
  const [size, setSize] = useState<(typeof sizes)[number]>(sizes[2]);
  const [showGuides, setShowGuides] = useState(false);

  return (
    <div>
      <figure className={styles.specimen} aria-labelledby="sign-specimen-caption">
        <div className={styles.specimenTop} aria-hidden="true">
          <span className={styles.specimenLabel}>Основная композиция</span>
          <span>Светлое поле</span>
        </div>
        <div className={styles.signStage}>
          <div
            className={styles.logoSpace}
            data-guides={showGuides}
            data-size={size.id}
            style={{ "--sample-size": `${size.value}px` } as CSSProperties}
          >
            {showGuides && <span className={styles.measureLabel} aria-hidden="true">x/2</span>}
            <div
              className={styles.signMark}
              role="img"
              aria-label="Логотип Shisha Market: фургон-лавка с полосатым навесом, надписью, шамсой и печатью BACK"
            >
              <BrandMark size="book" />
            </div>
          </div>
        </div>
        <figcaption id="sign-specimen-caption" className={styles.specimenCaption}>
          {showGuides
            ? "Поле x/2 вокруг композиции; x — модуль знака."
            : "Меняйте размер и рассмотрите свободное поле вокруг знака."}
        </figcaption>
        <div className={styles.controls}>
          <div className={styles.sizeGroup} role="group" aria-label="Размер образца знака">
            {sizes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.sizeButton}
                aria-pressed={size.id === item.id}
                onClick={() => setSize(item)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.guideButton}
            data-active={showGuides}
            aria-describedby="clear-space-note"
            onClick={() => setShowGuides((value) => !value)}
          >
            <Scan size={16} aria-hidden="true" />
            {showGuides ? "Скрыть поля" : "Показать поля"}
          </button>
        </div>
      </figure>
      <dl className={styles.anatomy}>
        <div>
          <dt>Надпись</dt>
          <dd>Две строки Zilla Slab 700. Шамса справа, на высоту надписи.</dd>
        </div>
        <div>
          <dt>Фургон-лавка</dt>
          <dd>Простой силуэт минивэна и полосатый навес. Название — вывеска на борту.</dd>
        </div>
        <div>
          <dt>Печать</dt>
          <dd>BACK под названием. Сохранён наклон −22°.</dd>
        </div>
      </dl>
    </div>
  );
}

const colors = [
  { name: "Terracotta", hex: "#bf4726", use: "Печать BACK, ядро шамсы и основные кнопки." },
  { name: "Ember", hex: "#f0b090", use: "Поддерживающий тёплый оттенок. Здесь — подсветка полей." },
  { name: "Clay", hex: "#7a2c18", use: "Поддерживающий глубокий оттенок. Здесь — текст подсветки." },
  { name: "Olive", hex: "#29362d", use: "Звезда шамсы и верхняя полоса сайта. Здесь — основной текст." },
  { name: "Cream", hex: "#f6f5f1", use: "Фон сайта и светлая точка в центре шамсы." },
] as const;

type CopyState =
  | { state: "idle" }
  | { state: "copying" | "success" | "error"; hex: string; name: string };

export function BrandPalette() {
  const [copyState, setCopyState] = useState<CopyState>({ state: "idle" });
  const fallbackRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (copyState.state === "error") {
      fallbackRef.current?.focus({ preventScroll: true });
      fallbackRef.current?.select();
    }
  }, [copyState]);

  async function copyColor(color: (typeof colors)[number]) {
    const request = ++requestRef.current;
    setCopyState({ state: "copying", hex: color.hex, name: color.name });
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(color.hex);
      if (request === requestRef.current) {
        setCopyState({ state: "success", hex: color.hex, name: color.name });
      }
    } catch {
      if (request === requestRef.current) {
        setCopyState({ state: "error", hex: color.hex, name: color.name });
      }
    }
  }

  const feedback = copyState.state === "success"
    ? `${copyState.name}: ${copyState.hex} скопирован.`
    : copyState.state === "error"
      ? "Не удалось скопировать. HEX выделен в поле ниже — скопируйте его вручную."
      : copyState.state === "copying"
        ? `Копирование ${copyState.name}…`
        : "Нажмите на HEX, чтобы скопировать цвет.";

  return (
    <div>
      <ul className={styles.palette} aria-label="Фирменная палитра">
        {colors.map((color) => (
          <li key={color.name}>
            <div className={styles.colorSwatch} style={{ backgroundColor: color.hex }} aria-hidden="true" />
            <div className={styles.colorDetail}>
              <h3 className={styles.colorHeading}>{color.name}</h3>
              <button
                type="button"
                className={styles.copyButton}
                aria-label={`Скопировать ${color.name} ${color.hex}`}
                disabled={copyState.state === "copying" && copyState.hex === color.hex}
                onClick={() => void copyColor(color)}
              >
                <code>{color.hex}</code>
                {copyState.state === "success" && copyState.hex === color.hex
                  ? <Check size={16} aria-hidden="true" />
                  : <Copy size={16} aria-hidden="true" />}
              </button>
              <p className={styles.colorUse}>{color.use}</p>
            </div>
          </li>
        ))}
      </ul>
      <p id="palette-status" className={styles.copyFeedback} role="status" aria-atomic="true">{feedback}</p>
      {copyState.state === "error" && (
        <label className={styles.copyFallback}>
          HEX для ручного копирования
          <input
            ref={fallbackRef}
            value={copyState.hex}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
            spellCheck={false}
          />
        </label>
      )}
    </div>
  );
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches;
}

export function MotionSpecimen() {
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, () => false);
  const [requestedPlayback, setRequestedPlayback] = useState(false);
  const isPlaying = requestedPlayback && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia(reducedMotionQuery);
    const stopForPreference = () => {
      if (media.matches) setRequestedPlayback(false);
    };
    media.addEventListener("change", stopForPreference);
    return () => media.removeEventListener("change", stopForPreference);
  }, []);

  return (
    <div className={styles.motionLayout}>
      <div
        className={styles.motionStage}
        data-playing={isPlaying}
        role="img"
        aria-label="Шамса: оливковая звезда, терракотовое ядро и светлая точка"
      >
        <Shamsa className={styles.motionSymbol} />
      </div>
      <div className={styles.motionCopy}>
        <h3>Один знак, два движения</h3>
        <p id="motion-note">
          Звезда медленно вращается, ядро переворачивается. Демонстрация
          запускается по нажатию; пауза позволяет рассмотреть текущий момент.
        </p>
        <button
          type="button"
          className={styles.motionButton}
          aria-label={reducedMotion ? "Движение отключено" : isPlaying ? "Пауза" : "Воспроизвести движение"}
          aria-describedby="motion-status"
          disabled={reducedMotion}
          onClick={() => setRequestedPlayback((value) => !value)}
        >
          {isPlaying ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          {reducedMotion ? "Движение отключено" : isPlaying ? "Пауза" : "Воспроизвести"}
        </button>
        <p id="motion-status" className={styles.motionStatus} role="status" aria-atomic="true">
          {reducedMotion
            ? "В системе включено уменьшение движения. Образец остаётся статичным."
            : isPlaying ? "Движение включено." : "Демонстрация на паузе."}
        </p>
      </div>
    </div>
  );
}

export function BrandAnchor({ href, className, children }: { href: `#${string}`; className?: string; children: ReactNode }) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    event.preventDefault();
    if (window.location.hash !== href) window.history.pushState(null, "", href);
    // Explicit instant scrolling also overrides the site's global smooth scroll.
    target.scrollIntoView({ behavior: "instant", block: "start" });
    const heading = target.matches("h1, h2") ? target : target.querySelector<HTMLElement>("h1, h2");
    heading?.focus({ preventScroll: true });
  }

  return <a href={href} className={className} onClick={navigate}>{children}</a>;
}
