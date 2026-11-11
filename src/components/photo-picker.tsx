"use client";
/* Local previews must never enter the shared image cache. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui/button";
import styles from "./listing-form.module.css";

type Selection = { file: File; url: string };
export function PhotoPicker({ keptCount, editing, onItems }: { keptCount: number; editing: boolean; onItems?: (urls: string[]) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const selected = useRef<Selection[]>([]);
  const [items, setItems] = useState<Selection[]>([]);
  const [error, setError] = useState("");
  useEffect(() => () => selected.current.forEach(item => URL.revokeObjectURL(item.url)), []);
  function sync(next: Selection[]) {
    const transfer = new DataTransfer();
    next.forEach(item => transfer.items.add(item.file));
    if (input.current) input.current.files = transfer.files;
    selected.current = next;
    setItems(next);
    onItems?.(next.map(item => item.url));
  }
  function change(files: File[]) {
    setError("");
    if (!files.length) {
      items.forEach(item => URL.revokeObjectURL(item.url));
      sync([]);
      return;
    }
    const added = files.filter(file => !items.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified));
    const all = [...items.map(item => item.file), ...added];
    const message = all.length + keptCount > 6 ? "Можно оставить не больше 6 фотографий вместе с текущими. Уберите лишние."
      : all.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type)) ? "Нужны JPG, PNG или WebP. HEIC и другие форматы сначала сохраните как JPG."
      : all.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024 ? "Общий размер новых фотографий — до 8 МБ. Уменьшите файлы или выберите меньше фото." : "";
    if (message) { sync(items); setError(message); return; }
    sync([...items, ...added.map(file => ({file, url: URL.createObjectURL(file)}))]);
  }
  return <fieldset className={styles.photos}>
    <legend>{editing ? "Добавить фотографии" : "Фотографии вещи"}</legend>
    <label htmlFor={id}>{editing ? "Новые фотографии" : "Фотографии"}</label>
    <input id={id} ref={input} type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp" required={keptCount === 0 && items.length === 0}
      aria-describedby={`${id}-help`} onChange={event => change(Array.from(event.currentTarget.files ?? []))} />
    <p id={`${id}-help`} className="muted small">От 1 до 6 фото вместе с оставленными, до 8 МБ новых файлов суммарно. JPG, PNG или WebP. Можно добавлять по одному. Геометки удаляются перед сохранением.</p>
    <p className="muted small">Покажите вещь целиком, комплект и дефекты. Первое фото — обложка.</p>
    {items.length > 0 && <div className={styles.photoGrid}>
      {items.map((item, index) => <div key={item.url} className={styles.photo}>
        <img src={item.url} alt={`Новое фото ${index + 1}`} width={400} height={300} />
        <span>{index === 0 && keptCount === 0 ? "Обложка" : `Фото ${keptCount + index + 1}`} · {(item.file.size / 1048576).toFixed(1)} МБ</span>
        <div className={styles.photoActions}>
          {index > 0 && keptCount === 0 && <Button type="button" variant="outline" onClick={() => sync([item, ...items.filter(other => other !== item)])}>Сделать обложкой</Button>}
          <Button type="button" variant="ghost" aria-label={`Удалить новое фото ${index + 1}`} onClick={() => {URL.revokeObjectURL(item.url); sync(items.filter(other => other !== item)); setError("");}}>Удалить</Button>
        </div>
      </div>)}
    </div>}
    <p className="muted small" role="status">Выбрано фотографий: {keptCount + items.length} из 6.</p>
    {error && <p role="alert" className="notice error">{error}</p>}
  </fieldset>;
}
