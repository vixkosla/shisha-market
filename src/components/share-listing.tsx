"use client";
import { useState } from "react";
import { Button } from "./ui/button";

export function ShareListing({ path }: {path: string}) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState("");
  return <div className="form-stack">
    <Button type="button" variant="outline" onClick={async () => {
      const url = new URL(path, window.location.origin).href;
      try { await navigator.clipboard.writeText(url); setMessage("Ссылка скопирована — можно отправить её знакомым."); setFallback(""); }
      catch { setMessage("Скопируйте ссылку из поля ниже."); setFallback(url); }
    }}>Скопировать ссылку на объявление</Button>
    {message && <p className="muted small" role="status">{message}</p>}
    {fallback && <label>Ссылка на объявление<input readOnly value={fallback} onFocus={event => event.target.select()} /></label>}
  </div>;
}
