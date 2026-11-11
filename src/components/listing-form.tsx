"use client";
/* Authenticated photos must not enter the shared image cache. */
/* eslint-disable @next/next/no-img-element */
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { publishAction } from "@/app/actions";
import { updateListingAction } from "@/app/listings/edit-actions";
import { categories } from "@/lib/listings";
import { Button } from "./ui/button";
import Link from "next/link";
import { countries, LEGAL_VERSION } from "@/lib/legal";
import styles from "./listing-form.module.css";
import { PhotoPicker } from "./photo-picker";
import { decodeListingDraft, encodeListingDraft, hasDraftContent } from "@/lib/listing-draft";
import { brandGoods, readListing, splitPasted, type ListingCategory, type SmartBrand } from "@/lib/listing-smart";
import { detectSubcategory, SUBCATEGORIES, subcategoryLabel } from "@/lib/listing-taxonomy";

function subscribeDraft(notify: () => void) {
  window.addEventListener("shisha-draft", notify);
  return () => window.removeEventListener("shisha-draft", notify);
}

/** What the live preview next to the form shows; photos are local object URLs. */
export type ListingPreviewData = {
  title: string; description: string; category: string; country: string; city: string; price: string; photos: string[];
  /** Second level and the make as the seller set them; `atlas` is the atlas card of that make, if any. */
  subcategory: string | null; brandName: string; model: string | null;
  brand: SmartBrand | null;
};

/** The atlas card for a make typed by hand: by name or any spelling. */
function atlasBrand(atlas: readonly SmartBrand[] | undefined, name: string) {
  const key = name.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
  return key ? atlas?.find(brand => brand.name.toLocaleLowerCase("ru") === key || brand.aliases.includes(key)) ?? null : null;
}

type EditableListing = {
  id: string; revision: number; title: string; description: string;
  category: string; condition: string; country: string; city: string;
  subcategory?: string | null; brand?: string | null; model?: string | null;
  price: string; contactUrl: string; contactConditions: string;
  photos: { id: string; width: number; height: number }[];
};
export function ListingForm({
  markets,
  initial,
  draftKey,
  seed,
  guestLogin,
  onPreview,
  atlas,
}: {
  markets: { country: string; categories: string[] }[];
  initial?: EditableListing;
  draftKey?: string;
  /** Text the visitor already typed elsewhere, e.g. «продаю HOOB Atom» in the search bar. */
  seed?: { title?: string };
  /** Not signed in (or terms to renew): text is filled here, photos, contact and consents come after login. */
  guestLogin?: string;
  onPreview?: (preview: ListingPreviewData) => void;
  /** Atlas brands: with them the form reads the text and suggests brand, rubric, price and city. */
  atlas?: SmartBrand[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(initial ? updateListingAction : publishAction, {});
  const [fields, setFields] = useState({
    title: initial?.title ?? seed?.title ?? "", description: initial?.description ?? "",
    category: initial?.category ?? markets[0]?.categories[0] ?? "",
    subcategory: initial?.subcategory ?? "", brand: initial?.brand ?? "", model: initial?.model ?? "",
    country: initial?.country ?? markets[0]?.country ?? "", condition: initial?.condition ?? "used",
    city: initial?.city ?? "", price: initial?.price ?? "", contactUrl: initial?.contactUrl ?? "",
    contactConditions: initial?.contactConditions ?? "", consentName: "",
  });
  const [kept, setKept] = useState(initial?.photos.map((photo) => photo.id) ?? []);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  // Category, subcategory, make and model follow the text until the seller sets them by hand.
  const [touched, setTouched] = useState<Partial<Record<"category" | "subcategory" | "brand" | "model", boolean>>>(initial ? { category: true, subcategory: true, brand: true, model: true } : {});
  const categoryTouched = Boolean(touched.category);
  const [pasted, setPasted] = useState("");
  const reading = useMemo(() => (atlas ? readListing(fields, atlas) : null), [fields, atlas]);
  const available = markets.find(market => market.country === fields.country)?.categories ?? [];
  if (reading) {
    const auto: Partial<typeof fields> = {};
    if (!touched.category && reading.category && available.includes(reading.category) && fields.category !== reading.category) auto.category = reading.category;
    const category = auto.category ?? fields.category;
    const subcategory = (category === reading.category ? reading.subcategory : detectSubcategory(category, fields.title)) ?? "";
    if (!touched.subcategory && subcategory !== fields.subcategory) auto.subcategory = subcategory;
    if (!touched.brand && (reading.brand?.name ?? "") !== fields.brand) auto.brand = reading.brand?.name ?? "";
    if (!touched.model && (reading.model ?? "") !== fields.model) auto.model = reading.model ?? "";
    if (Object.keys(auto).length) setFields(previous => ({ ...previous, ...auto }));
  }
  const subcategories = SUBCATEGORIES[fields.category as keyof typeof SUBCATEGORIES] ?? [];
  // Suggestions follow the category: bowl makers for a bowl; models are those of the chosen make.
  const makes = useMemo(() => (atlas ?? []).filter(brand => brandGoods(brand).includes(fields.category as ListingCategory)).sort((a, b) => Number(/^[а-яё]/i.test(a.name)) - Number(/^[а-яё]/i.test(b.name)) || a.name.localeCompare(b.name, "en")), [atlas, fields.category]);
  const chosen = atlasBrand(atlas, fields.brand);
  const typed = (name: "subcategory" | "brand" | "model") => ({
    value: fields[name],
    onChange: (event: { target: { value: string } }) => {
      setTouched(previous => ({ ...previous, [name]: true }));
      setFields(previous => ({ ...previous, [name]: event.target.value }));
    },
  });
  const [draftDecided, setDraftDecided] = useState(false);
  const [draftError, setDraftError] = useState("");
  const errorSummary = useRef<HTMLParagraphElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const rawDraft = useSyncExternalStore(subscribeDraft, () => {
    try { return draftKey ? sessionStorage.getItem(draftKey) ?? "" : ""; } catch { return ""; }
  }, () => "");
  const draft = decodeListingDraft(rawDraft);
  const offerDraft = Boolean(draft && !draftDecided && !initial);
  useEffect(() => {
    if (state.error) errorSummary.current?.focus();
  }, [state]);
  useEffect(() => {
    if (!state.createdId) return;
    if (draftKey) {
      try { sessionStorage.removeItem(draftKey); window.dispatchEvent(new Event("shisha-draft")); } catch { /* Navigation must still work without storage. */ }
    }
    router.replace(`/listings/${state.createdId}`);
    router.refresh();
  }, [state.createdId, draftKey, router]);
  useEffect(() => {
    if (!draftKey || initial || offerDraft || state.createdId || !hasDraftContent(fields)) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, encodeListingDraft(fields));
        window.dispatchEvent(new Event("shisha-draft"));
        setDraftDecided(true);
        setDraftError("");
      } catch { setDraftError("Браузер не разрешил сохранить черновик. Перед уходом скопируйте свой текст; заполненная форма остаётся на месте."); }
    }, 500);
    return () => clearTimeout(timer);
  }, [fields, draftKey, initial, offerDraft, state.createdId]);
  useEffect(() => {
    if (!onPreview) return;
    const current = initial?.photos.filter(photo => kept.includes(photo.id)).map(photo => `/media/${photo.id}`) ?? [];
    onPreview({
      title: fields.title, description: fields.description, category: fields.category, country: fields.country, city: fields.city, price: fields.price,
      photos: [...current, ...photoUrls],
      subcategory: subcategoryLabel(fields.category, fields.subcategory), brandName: fields.brand.trim(), model: fields.model.trim() || null,
      brand: atlasBrand(atlas, fields.brand),
    });
  }, [fields, kept, photoUrls, initial, onPreview, atlas]);
  const unfold = () => {
    if (!atlas) return;
    const parts = splitPasted(pasted, atlas);
    if (!parts) return;
    setFields(previous => ({
      ...previous,
      title: parts.title || previous.title,
      description: parts.description || previous.description,
      price: parts.price ?? previous.price,
      city: parts.city ?? previous.city,
    }));
    setTouched({});
    setPasted("");
  };
  const toLogin = () => {
    if (!guestLogin) return;
    try {
      if (draftKey && hasDraftContent(fields)) sessionStorage.setItem(draftKey, encodeListingDraft(fields));
    } catch { /* The text stays on screen; login still proceeds. */ }
    window.location.assign(guestLogin);
  };
  const field = (name: keyof typeof fields) => ({
    value: fields[name],
    onChange: (event: { target: { value: string } }) => setFields((previous) => ({ ...previous, [name]: event.target.value })),
  });
  return (
    <form
      action={action}
      ref={form}
      className={`form-stack ${styles.form}`}
      aria-busy={pending}
      // A returned validation error still triggers React's native form reset.
      // Preserve all input, including file/checkbox DOM state; success redirects.
      onReset={(event) => event.preventDefault()}
      onSubmit={guestLogin ? (event) => { event.preventDefault(); toLogin(); } : undefined}
    >
      <input type="hidden" name="legalVersion" value={LEGAL_VERSION} />
      {!initial && draftKey && <div className={styles.draft}>
        {offerDraft ? <>
          <p>В этой вкладке есть незавершённое объявление. Восстановить текст?</p>
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={() => {
              if (!draft) return;
              const country = markets.some(market => market.country === draft.country) ? draft.country : fields.country;
              const available = markets.find(market => market.country === country)?.categories ?? [];
              setFields(previous => ({...previous, ...draft, country, category: available.includes(draft.category) ? draft.category : available[0] ?? "", contactUrl: "", consentName: "", contactConditions: ""}));
              form.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {input.checked = false;});
              setDraftDecided(true);
            }}>Восстановить черновик</Button>
            <Button type="button" variant="ghost" onClick={() => {try {sessionStorage.removeItem(draftKey);window.dispatchEvent(new Event("shisha-draft"));} catch {} setDraftDecided(true);}}>Удалить старый черновик</Button>
          </div>
        </> : <p className="muted small">Текст, город и цена сохраняются в этой вкладке на случай перезагрузки. Фотографии, контакт и согласия нужно выбрать заново; ФИО в черновик не сохраняется.</p>}
        {draftError && <p role="status" className="notice error">{draftError}</p>}
      </div>}
      {initial && <>
        <input type="hidden" name="id" value={initial.id} />
        <input type="hidden" name="revision" value={initial.revision} />
        <p className="notice">После сохранения объявление и фотографии будут скрыты от посетителей до повторного одобрения. Отмена оставляет текущую версию без изменений.</p>
      </>}
      <p className="notice">
        Только личные вещи в открытых странах и категориях. Табак, никотин,
        вейпы и коммерческие предложения не принимаются.{" "}
        <Link href="/legal/rules">Правила публикации →</Link>
      </p>
      {atlas && !initial && (
        <section className={`${styles.block} ${styles.smart}`} aria-label="Вставить готовый текст">
          <h2 className={styles.blockTitle}>Уже есть текст объявления?</h2>
          <label>
            Вставьте его целиком, например с другой площадки или из чата
            <textarea value={pasted} onChange={(event) => setPasted(event.target.value)} rows={3} maxLength={6000} placeholder={"Кальян HOOB Atom — 9 000 ₽\nПользовался полгода, без сколов, в комплекте коробка. Москва."} />
          </label>
          <div className={styles.actions}>
            <Button type="button" variant="outline" disabled={!pasted.trim()} onClick={unfold}>Разложить по полям</Button>
          </div>
          <p className="muted small">Текст разбирается здесь, в браузере, и никуда не отправляется. Проверьте поля после разбора.</p>
        </section>
      )}
      <section className={styles.block}>
      <h2 className={styles.blockTitle}>Что продаёте</h2>
      <label>
        Название
        <input
          name="title"
          {...field("title")}
          required
          minLength={5}
          maxLength={100}
          placeholder="Марка, модель и важная особенность"
        />
      </label>
      <div className="form-row">
        <label>
          Категория
          <select name="category" value={fields.category} onChange={(event) => {
            const category = event.target.value;
            setTouched(previous => ({ ...previous, category: true }));
            // A subcategory of another category no longer fits; the smart reading may pick a new one.
            setFields((previous) => SUBCATEGORIES[category as keyof typeof SUBCATEGORIES]?.some(item => item.slug === previous.subcategory) ? { ...previous, category } : { ...previous, category, subcategory: "" });
            setTouched(previous => ({ ...previous, category: true, subcategory: false }));
          }}>
            {Object.entries(categories)
              .filter(([key]) =>
                markets.some((market) => market.country === fields.country && market.categories.includes(key)),
              )
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Состояние
          <select name="condition" {...field("condition")}>
            <option value="used">Бывшее в использовании</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Подкатегория
          <select name="subcategory" {...typed("subcategory")}>
            <option value="">— не выбрана —</option>
            {subcategories.map(item => <option key={item.slug} value={item.slug}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Марка
          <input name="brand" {...typed("brand")} maxLength={60} list="atlas-brands" autoComplete="off" placeholder="Например, HOOB" />
        </label>
        <label>
          Модель
          <input name="model" {...typed("model")} maxLength={60} autoComplete="off" list="brand-models" placeholder={chosen?.models?.[0] ? `Например, ${chosen.models[0]}` : "Например, Atom"} />
        </label>
      </div>
      {atlas && <datalist id="atlas-brands">{makes.map(brand => <option key={brand.slug} value={brand.name} />)}</datalist>}
      {chosen?.models?.length ? <datalist id="brand-models">{chosen.models.map(model => <option key={model} value={model} />)}</datalist> : null}
      {atlas && <p className="muted small">В подсказках {makes.length} марок этой категории из каталогов магазинов. Нет вашей — впишите как есть.</p>}
      {atlas && !touched.brand && fields.brand && <p className="muted small">Категория, подкатегория, марка и модель заполнены по названию. Поправьте, если что-то не так.</p>}
      </section>
      <section className={styles.block}>
      <h2 className={styles.blockTitle}>Где и за сколько</h2>
      <div className="form-row">
        <label>
          Страна нахождения вещи
          <select name="country" required value={fields.country} onChange={(event) => {
            const country = event.target.value;
            const available = markets.find((market) => market.country === country)?.categories ?? [];
            setFields((previous) => ({ ...previous, country, category: available.includes(previous.category) ? previous.category : available[0] ?? "" }));
          }}>
            {markets.map(({ country }) => (
              <option key={country} value={country}>
                {countries[country as keyof typeof countries]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Город
          <input
            name="city"
            {...field("city")}
            required
            minLength={2}
            maxLength={80}
            placeholder="Например, Москва"
          />
        </label>
        <label>
          Цена, ₽
          <input
            name="price"
            {...field("price")}
            required
            inputMode="decimal"
            pattern="[0-9]{1,7}([.,][0-9]{1,2})?"
            placeholder="2500"
          />
        </label>
      </div>
      </section>
      <section className={styles.block}>
      <h2 className={styles.blockTitle}>Состояние и комплект</h2>
      <label>
        Описание
        <textarea
          name="description"
          {...field("description")}
          rows={6}
          required
          minLength={30}
          maxLength={5000}
          placeholder="Состояние, комплектация, особенности. Укажите имеющиеся дефекты."
        />
      </label>
      </section>
      {reading && (fields.title.trim() || fields.description.trim()) && (
        <section className={`${styles.block} ${styles.smart}`} aria-label="Что поняли из текста">
          <h2 className={styles.blockTitle}>Что поняли из текста</h2>
          {reading.tobacco && <p role="alert" className="notice error">Похоже на табак или никотиновый товар. Такие объявления на сайте не принимаются.</p>}
          <ul className={styles.facts}>
            <li><span>Марка</span>{reading.brand ? <strong>{reading.brand.name}{reading.model ? ` · модель ${reading.model}` : ""}</strong> : <em>не узнали — напишите марку в названии</em>}</li>
            <li><span>Рубрика</span>{reading.category ? <strong>{categories[reading.category]}{!categoryTouched ? " — выбрана сама" : ""}</strong> : <em>выберите сами</em>}</li>
            {reading.price && reading.price !== fields.price.replace(/\s/g, "") && (
              <li><span>Цена в тексте</span><strong>{Number(reading.price).toLocaleString("ru-RU")} ₽</strong><button type="button" className={styles.apply} onClick={() => setFields(previous => ({ ...previous, price: reading.price ?? previous.price }))}>Подставить</button></li>
            )}
            {reading.city && reading.city !== fields.city.trim() && (
              <li><span>Город в тексте</span><strong>{reading.city}</strong><button type="button" className={styles.apply} onClick={() => setFields(previous => ({ ...previous, city: reading.city ?? previous.city }))}>Подставить</button></li>
            )}
            {reading.suggestedTitle && (
              <li><span>Название</span><strong>{reading.suggestedTitle}</strong><button type="button" className={styles.apply} onClick={() => setFields(previous => ({ ...previous, title: reading.suggestedTitle ?? previous.title }))}>Взять</button></li>
            )}
          </ul>
          <div>
            <p className="small">Что ещё полезно покупателю в описании:</p>
            <ul className={styles.checklist}>
              {reading.checklist.map(item => <li key={item.key} data-done={item.done}>{item.label}</li>)}
            </ul>
          </div>
        </section>
      )}
      {guestLogin ? (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>Фото, связь и согласия</h2>
          <p className="small">Их добавите после входа по коду на почту: фотографии и согласия нельзя переносить между страницами. Текст сохранится в этой вкладке.</p>
          <div className={styles.actions}>
            <Button type="button" onClick={toLogin}>Войти и продолжить</Button>
          </div>
        </section>
      ) : <>
      <section className={styles.block}>
      <h2 className={styles.blockTitle}>Фото и связь</h2>
      <label>
        Ссылка для связи
        <input
          type="url"
          name="contactUrl"
          {...field("contactUrl")}
          required
          maxLength={200}
          placeholder="https://vk.ru/username или https://t.me/username"
        />
        <span className="muted small">
          Будет видна посетителям после одобрения объявления.
        </span>
      </label>
      {initial && <fieldset className={styles.photos}>
        <legend>Текущие фотографии</legend>
        <p className="muted small">Снимите отметку с ненужных фото. Удаление произойдёт только после успешного сохранения.</p>
        <div className={styles.photoGrid}>
          {initial.photos.map((photo, index) => <label key={photo.id} className={styles.photo} data-kept={kept.includes(photo.id)}>
            <img src={`/media/${photo.id}`} alt={`Текущая фотография ${index + 1}`} width={photo.width} height={photo.height} />
            <span><input type="checkbox" name="keepPhoto" value={photo.id} checked={kept.includes(photo.id)} onChange={(event) => setKept((previous) => event.target.checked ? [...previous, photo.id] : previous.filter((id) => id !== photo.id))} /> Оставить фото {index + 1}</span>
          </label>)}
        </div>
        <p className="muted small" role="status">Оставлено: {kept.length} из {initial.photos.length}. Первое оставленное фото станет обложкой.</p>
      </fieldset>}
      <PhotoPicker keptCount={kept.length} editing={Boolean(initial)} onItems={setPhotoUrls} />
      </section>
      <section className={styles.block}>
      <h2 className={styles.blockTitle}>Согласия и отправка</h2>
      <p className="muted small">
        После отправки объявление проверит модератор. До одобрения оно доступно
        только вам и модераторам.
      </p>
      <fieldset className="consent-block">
        <legend>Отдельное согласие на публикацию данных</legend>
        <p className="small">
          Публикуются только выбранные ниже данные. Email входа и ФИО из
          согласия закрыты. Не добавляйте персональные данные в описание и фото.{" "}
          <Link href="/legal/publication" target="_blank" rel="noopener">
            Полный текст согласия
          </Link>
          .
        </p>
        <label>
          ФИО для согласия
          <input
            name="consentName"
            {...field("consentName")}
            required
            minLength={3}
            maxLength={160}
            autoComplete="name"
          />
          <span className="muted small">Не показывается посетителям.</span>
        </label>
        <label className="check-label">
          <input type="checkbox" name="publishContact" required />
          <span>
            Разрешаю публикацию указанной ссылки для связи в этом объявлении.
          </span>
        </label>
        <label className="check-label">
          <input type="checkbox" name="publishCity" required />
          <span>
            Разрешаю публикацию страны и города в этом объявлении и каталоге.
          </span>
        </label>
        <label>
          Дополнительные условия распространения
          <textarea
            name="contactConditions"
            {...field("contactConditions")}
            maxLength={1000}
            rows={2}
            placeholder="При необходимости укажите запреты и условия, без персональных данных"
          />
          <span className="muted small">
            Будут видны рядом с контактом. По умолчанию запрещены массовый сбор
            контактов и рекламные рассылки.
          </span>
        </label>
      </fieldset>
      <label className="check-label">
        <input type="checkbox" name="personalItem" required />
        <span>
          Это моя личная вещь; я не размещаю коммерческое предложение и принимаю
          правила публикации.
        </span>
      </label>
      <label className="check-label">
        <input type="checkbox" name="adult" required />
        <span>Мне исполнилось 18 лет.</span>
      </label>
      {state.error && (
        <p ref={errorSummary} tabIndex={-1} role="alert" className="notice error">
          {state.error}
        </p>
      )}
      <div className={styles.actions}>
        <Button disabled={pending || Boolean(state.createdId)}>
          {pending ? "Сохраняем…" : initial ? "Сохранить и отправить на проверку" : "Отправить на проверку"}
        </Button>
        {initial && !pending && <Link className="button button-ghost" href={`/listings/${initial.id}`}>Отмена</Link>}
      </div>
      {pending && <p role="status" className="notice">Загружаем и проверяем фотографии, затем сохраним объявление. Не закрывайте вкладку.</p>}
      {state.createdId && <p role="status">Объявление сохранено. <Link href={`/listings/${state.createdId}`}>Открыть карточку на проверке →</Link></p>}
      </section>
      </>}
    </form>
  );
}
