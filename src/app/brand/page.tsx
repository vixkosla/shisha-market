import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight, ArrowUp } from "lucide-react";
import { BrandAnchor, BrandPalette, MotionSpecimen, SignSpecimen } from "@/components/brandbook/brand-tools";
import styles from "./brandbook.module.css";

export const metadata: Metadata = {
  title: "Брендбук",
  description:
    "Визуальная система Shisha Market: знак, палитра, шрифты, движение и фотографии. Интерактивные образцы и файлы для скачивания.",
};

const sections = [
  { number: "01", id: "sign", name: "Знак" },
  { number: "02", id: "palette", name: "Цвет" },
  { number: "03", id: "type", name: "Шрифт" },
  { number: "04", id: "motion", name: "Движение" },
  { number: "05", id: "photo", name: "Фото" },
  { number: "06", id: "files", name: "Файлы" },
] as const;

const downloads = [
  { name: "Фургон-лавка", kind: "SVG", detail: "Вектор · фон логотипа", href: "/brand/market-van.svg", filename: "shisha-market-van.svg" },
  { name: "Символ шамсы", kind: "SVG", detail: "Вектор · только символ", href: "/brand-mark.svg", filename: "shisha-market-shamsa.svg" },
  { name: "Иконка сайта", kind: "PNG", detail: "32 × 32 px · прозрачный фон", href: "/favicon.png", filename: "shisha-market-icon-32.png" },
  { name: "Фотография чаши", kind: "JPG", detail: "712 × 690 px", href: "/brand/bowl.jpg", filename: "shisha-market-bowl.jpg" },
  { name: "Фотография жара", kind: "JPG", detail: "1024 × 1024 px", href: "/brand/ember.jpg", filename: "shisha-market-ember.jpg" },
] as const;

export default function BrandPage() {
  return (
    <article className={styles.book} aria-labelledby="brand-title">
      <header id="brand-top" className={styles.cover}>
        <div>
          <p className={styles.eyebrow}>Shisha Market / Визуальная система</p>
          <h1 id="brand-title" className={styles.title} tabIndex={-1}>Брендбук</h1>
        </div>
        <div className={styles.coverCopy}>
          <p>Передвижная лавка под полосатым навесом: знакомое место, которое всегда рядом. Надпись, шамса и печать BACK — на её борту.</p>
          <p>Руководство по знаку и его окружению: рассмотрите пропорции, скопируйте цвет, возьмите нужный файл.</p>
        </div>
      </header>

      <nav className={styles.sectionNav} aria-label="Разделы брендбука">
        <ol>
          {sections.map((section) => (
            <li key={section.id}>
              <BrandAnchor href={`#${section.id}`}>
                <span className={styles.navNumber} aria-hidden="true">{section.number}</span>
                {section.name}
              </BrandAnchor>
            </li>
          ))}
        </ol>
      </nav>

      <section id="sign" className={styles.section} aria-labelledby="sign-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.index}>01 / Основа</p>
            <h2 id="sign-title" className={styles.heading} tabIndex={-1}>Знакомое сочетание</h2>
          </div>
          <p className={styles.sectionIntro}>
            Фургон-лавка связывает знак с ярмаркой и передвижным маркетом.
            На борту — две строки SHISHA MARKET и шамса. Полосатый навес
            добавляет терракотовый акцент, печать BACK остаётся внизу.
          </p>
        </div>
        <div className={styles.signLayout}>
          <div className={styles.signNotes}>
            <ul className={styles.rules}>
              <li>Масштабируйте композицию целиком, сохраняя пропорции.</li>
              <li>Оставляйте фургон простым: силуэт, два колеса и торговый навес.</li>
              <li>Сохраняйте наклон печати BACK. Не набирайте её другим шрифтом.</li>
              <li>Сохраняйте положение шамсы. Не заменяйте её латинской S.</li>
              <li>Оставляйте вокруг знака светлое, спокойное поле.</li>
            </ul>
            <p id="clear-space-note" className={styles.smallNote}>
              Для этого руководства предлагаем свободное поле x/2,
              где x — модуль композиции, а кегль надписи — 0,9x.
              Крупный образец вписывается в ширину экрана.
            </p>
          </div>
          <SignSpecimen />
        </div>
        <div className={styles.iconsRow}>
          <div className={styles.iconsCopy}>
            <h3>Когда остаётся только символ</h3>
            <p className={styles.smallNote}>
              На маленьком носителе фургон, слова и печать теряют читаемость.
              Шамса может использоваться отдельно. Здесь она показана
              в реальных экранных размерах.
            </p>
          </div>
          <div className={styles.iconSamples}>
            {[16, 32, 64].map((size) => (
              <figure key={size}>
                <div className={styles.iconSample}>
                  <Image src="/brand-mark.svg" width={size} height={size} alt={`Шамса размером ${size} на ${size} пикселей`} unoptimized />
                </div>
                <figcaption>{size} px</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="palette" className={styles.section} aria-labelledby="palette-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.index}>02 / Палитра</p>
            <h2 id="palette-title" className={styles.heading} tabIndex={-1}>Тепло и равновесие</h2>
          </div>
          <p className={styles.sectionIntro}>
            Терракота даёт акцент, оливковый собирает композицию,
            светлый фон оставляет воздух. Ember и Clay поддерживают основные цвета.
          </p>
        </div>
        <BrandPalette />
      </section>

      <section id="type" className={styles.section} aria-labelledby="type-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.index}>03 / Типографика</p>
            <h2 id="type-title" className={styles.heading} tabIndex={-1}>У каждого шрифта своя роль</h2>
          </div>
          <p className={styles.sectionIntro}>
            Выразительная латиница в знаке, мягкий ритм кириллических
            заголовков и простой набор для чтения и действий.
          </p>
        </div>
        <div className={styles.typeList}>
          <div className={styles.typeRow}>
            <div className={styles.typeMeta}>
              <span className={styles.typeRole}>Латиница / знак</span>
              <h3>Zilla Slab · 700</h3>
              <p>Брусковая антиква с выразительными засечками. Для названия и печати используется жирное начертание.</p>
            </div>
            <div lang="en">
              <p className={styles.latinSample}>Shisha Market</p>
              <p className={styles.latinAlphabet}>Aa Bb Cc &amp; 0123456789</p>
            </div>
          </div>
          <div className={styles.typeRow}>
            <div className={styles.typeMeta}>
              <span className={styles.typeRole}>Кириллица / заголовки</span>
              <h3>Georgia</h3>
              <p>Редакционные заголовки и вводные фразы. Кириллица в этом образце набрана Georgia.</p>
            </div>
            <p className={styles.cyrillicSample}>Знакомое место.<br />Новая глава.</p>
          </div>
          <div className={styles.typeRow}>
            <div className={styles.typeMeta}>
              <span className={styles.typeRole}>Интерфейс / текст</span>
              <h3>Arial</h3>
              <p>Навигация, кнопки и основной текст. Если Arial недоступен, используются Helvetica и системный шрифт без засечек.</p>
            </div>
            <p className={styles.interfaceSample}>
              <strong>Найти свою вещь</strong>
              Кальян, чаша или небольшой аксессуар. Чёткие названия,
              понятные действия и достаточно места, чтобы прочитать детали.
            </p>
          </div>
        </div>
      </section>

      <section id="motion" className={styles.section} aria-labelledby="motion-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.index}>04 / Движение</p>
            <h2 id="motion-title" className={styles.heading} tabIndex={-1}>Немного живого характера</h2>
          </div>
          <p className={styles.sectionIntro}>
            Форма остаётся узнаваемой и в покое. Движение можно рассмотреть
            отдельно, когда оно нужно.
          </p>
        </div>
        <MotionSpecimen />
      </section>

      <section id="photo" className={styles.section} aria-labelledby="photo-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.index}>05 / Фотография</p>
            <h2 id="photo-title" className={styles.heading} tabIndex={-1}>Предмет, фактура, свет</h2>
          </div>
          <p className={styles.sectionIntro}>
            Два изображения из визуальных материалов площадки.
            Крупный предмет и спокойное окружение связывают их с палитрой.
          </p>
        </div>
        <div className={styles.photoGrid}>
          <figure>
            <div className={styles.photoFrame}>
              <Image src="/brand/bowl.jpg" alt="Терракотовая чаша на светлой поверхности, длинная тень и тонкая струя дыма" width={712} height={690} sizes="(max-width: 540px) calc(100vw - 40px), (max-width: 900px) calc(50vw - 30px), 606px" />
            </div>
            <figcaption className={styles.photoCaption}>
              <span aria-hidden="true">01</span>
              <div>
                <strong>Свет раскрывает материал</strong>
                <p>Тёплая глина, заметная фактура и направленная тень. Светлое поле оставляет предмету пространство.</p>
              </div>
            </figcaption>
          </figure>
          <figure>
            <div className={styles.photoFrame}>
              <Image src="/brand/ember.jpg" alt="Чаша с раскалённым углём и дымом на тёмном оливковом фоне" width={1024} height={1024} sizes="(max-width: 540px) calc(100vw - 40px), (max-width: 900px) calc(50vw - 30px), 606px" />
            </div>
            <figcaption className={styles.photoCaption}>
              <span aria-hidden="true">02</span>
              <div>
                <strong>Жар собирает внимание</strong>
                <p>Глубокий оливковый фон и небольшой яркий центр. Дым добавляет объём, сохраняя ясный силуэт чаши.</p>
              </div>
            </figcaption>
          </figure>
        </div>
        <p className={styles.photoNote}>При кадрировании сохраняйте предмет целиком. Для подписей оставляйте отдельное поле, как в этих примерах.</p>
      </section>

      <section id="files" className={styles.section} aria-labelledby="files-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.index}>06 / Материалы</p>
            <h2 id="files-title" className={styles.heading} tabIndex={-1}>Нужный файл под рукой</h2>
          </div>
          <p className={styles.sectionIntro}>Символ для масштабирования, маленькая иконка и две фотографии. Каждый файл скачивается отдельно.</p>
        </div>
        <ul className={styles.downloads} aria-label="Файлы бренда">
          {downloads.map((file) => (
            <li key={file.href}>
              <a href={file.href} download={file.filename}>
                <span className={styles.downloadKind}>{file.kind}</span>
                <span className={styles.downloadName}>
                  <strong>{file.name}</strong>
                  <small>{file.detail}</small>
                </span>
                <ArrowDownToLine size={19} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className={styles.assetNote}>Фургон и шамса доступны как отдельные SVG. Полная композиция с надписью SHISHA MARKET и печатью BACK показана в разделе «Знак».</p>
      </section>

      <div className={styles.endNote}>
        <p>Автор знака — SonicXBoy.</p>
        <nav className={styles.endNav} aria-label="Продолжить знакомство">
          <Link href="/wiki">Открыть вики <ArrowRight size={15} aria-hidden="true" /></Link>
          <Link href="/">На главную</Link>
          <BrandAnchor href="#brand-top">К началу <ArrowUp size={15} aria-hidden="true" /></BrandAnchor>
        </nav>
      </div>
    </article>
  );
}
