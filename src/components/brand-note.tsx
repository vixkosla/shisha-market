/* Atlas logos are small static files; the shared image pipeline is not needed. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { SmartBrand } from "@/lib/listing-smart";
import styles from "./brand-note.module.css";

/** The atlas card of the brand a listing names: about the make, not about this particular item. */
export function BrandNote({ brand, model }: { brand: SmartBrand; model?: string | null }) {
  const out = { target: "_blank", rel: "nofollow noopener noreferrer" } as const;
  return (
    <section className={styles.note} aria-label={`${brand.atlas ? "Из атласа брендов" : "Из справочника марок"}: ${brand.name}`}>
      <p className={styles.label}>{brand.atlas ? "Из атласа брендов" : "Из справочника марок"}</p>
      <div className={styles.head}>
        <span className={styles.plate} data-plate={brand.logo?.plate ?? "type"}>
          {brand.logo ? <img src={brand.logo.src} alt={`Логотип ${brand.name}`} width={brand.logo.width} height={brand.logo.height} /> : <b>{brand.name}</b>}
        </span>
        <div>
          <strong>{brand.name}{model ? ` ${model}` : ""}</strong>
          <span>{brand.kind}</span>
        </div>
      </div>
      {brand.rows.length > 0 && (
        <dl>
          {brand.rows.map(row => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value} <a href={row.href} {...out}>{row.source}</a></dd>
            </div>
          ))}
        </dl>
      )}
      {brand.models && brand.models.length > 0 && (
        <p className={styles.models}><span>Модели в каталогах:</span> {brand.models.slice(0, 8).join(", ")}</p>
      )}
      {brand.sources && brand.sources.length > 0 && (
        <p className={styles.small}>
          Встречается в каталогах:{" "}
          {[...new Map(brand.sources.map(url => [new URL(url).hostname.replace(/^www\./, ""), url])).entries()].map(([name, url], index) => (
            <span key={url}>{index > 0 && ", "}<a href={url} {...out}>{name}</a></span>
          ))}
        </p>
      )}
      <p className={styles.links}>
        {brand.wiki && <Link className="text-link" href={brand.wiki}>Статья в вики</Link>}
        <Link className="text-link" href={`/?ask=${encodeURIComponent(brand.name)}`}>Всё о марке на сайте</Link>
      </p>
      <p className={styles.small}>Сведения о марке, а не о конкретной вещи. Модель указана продавцом или определена по названию.</p>
    </section>
  );
}
