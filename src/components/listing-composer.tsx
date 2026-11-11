"use client";
/* Local photo previews are object URLs and must not enter the shared image cache. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { categories, formatPrice } from "@/lib/listings";
import { countries } from "@/lib/legal";
import { ListingForm, type ListingPreviewData } from "./listing-form";
import { BrandNote } from "./brand-note";
import type { SmartBrand } from "@/lib/listing-smart";
import styles from "./listing-composer.module.css";

export const GUEST_DRAFT_KEY = "shisha:listing-draft:guest";

/** «2 500», «2500,50» → kopecks; anything the form would reject shows no price. */
function previewKopecks(price: string) {
  const match = price.replace(/\s/g, "").match(/^(\d{1,7})(?:[.,](\d{1,2}))?$/);
  return match ? Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0")) : null;
}

function ListingPreview({ data }: { data: ListingPreviewData }) {
  const kopecks = previewKopecks(data.price);
  const [cover, ...rest] = data.photos;
  const category = categories[data.category as keyof typeof categories];
  const country = countries[data.country as keyof typeof countries];
  return (
    <aside className={styles.preview} aria-label="Так объявление увидят посетители">
      <p className={styles.previewLabel}>Так увидят посетители</p>
      <article className={`listing-card ${styles.card}`}>
        <div className="card-image">
          {cover ? <img src={cover} alt="" width={600} height={480} /> : <span className={styles.noPhoto}>Здесь будет обложка — первое фото</span>}
          <span className="image-label">Б/у · на проверке</span>
        </div>
        <div className="card-body">
          {category && <span className="eyebrow">{[category, data.subcategory].filter(Boolean).join(" · ")}</span>}
          <h3 className={data.title.trim() ? undefined : styles.placeholder}>{data.title.trim() || "Марка, модель и важная особенность"}</h3>
          {data.brandName && <span className={styles.make}>{data.brandName}{data.model ? ` · ${data.model}` : ""}</span>}
          <strong className={`price${kopecks === null ? ` ${styles.placeholder}` : ""}`}>{kopecks === null ? "Цена" : formatPrice(kopecks)}</strong>
          <p className="muted city">
            <MapPin size={14} aria-hidden />
            {data.city.trim() || "Город"}{country ? `, ${country}` : ""}
          </p>
        </div>
      </article>
      {rest.length > 0 && (
        <div className={styles.thumbs}>
          {rest.slice(0, 5).map(url => <img key={url} src={url} alt="" width={120} height={96} />)}
        </div>
      )}
      <div className={styles.text}>
        <h4>Описание</h4>
        <p className={data.description.trim() ? undefined : styles.placeholder}>
          {data.description.trim() || "Состояние, комплектация, особенности и дефекты — то, что покупатель хочет знать до встречи."}
        </p>
        <p className={styles.note}>Ссылка для связи появится на карточке после одобрения модератором.</p>
      </div>
      {data.brand && <BrandNote brand={data.brand} model={data.model} />}
    </aside>
  );
}

const EMPTY: ListingPreviewData = { title: "", description: "", category: "", country: "", city: "", price: "", photos: [], subcategory: null, brandName: "", model: null, brand: null };

/**
 * The listing as blocks: the form fills on the left, the card it becomes renders on the right.
 * A guest fills the text first; after login the guest draft moves to the account's own draft.
 */
export function ListingComposer({
  markets,
  draftKey,
  guestLogin,
  seed,
  atlas,
}: {
  markets: { country: string; categories: string[] }[];
  draftKey?: string;
  guestLogin?: string;
  seed?: { title?: string };
  atlas?: SmartBrand[];
}) {
  const [preview, setPreview] = useState<ListingPreviewData>(EMPTY);
  const onPreview = useCallback((next: ListingPreviewData) => setPreview(next), []);
  useEffect(() => {
    if (guestLogin || !draftKey) return;
    try {
      const guest = sessionStorage.getItem(GUEST_DRAFT_KEY);
      if (guest && !sessionStorage.getItem(draftKey)) sessionStorage.setItem(draftKey, guest);
      if (guest) {
        sessionStorage.removeItem(GUEST_DRAFT_KEY);
        window.dispatchEvent(new Event("shisha-draft"));
      }
    } catch { /* Without storage the visitor simply types again. */ }
  }, [draftKey, guestLogin]);
  return (
    <div className={styles.composer}>
      <div className={styles.fill}>
        <ListingForm markets={markets} draftKey={guestLogin ? GUEST_DRAFT_KEY : draftKey} guestLogin={guestLogin} seed={seed} onPreview={onPreview} atlas={atlas} />
      </div>
      <ListingPreview data={preview} />
    </div>
  );
}
