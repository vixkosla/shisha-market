"use client";

import { useSyncExternalStore } from "react";
import { readWikiNotebook, writeWikiPersonalEntry, WIKI_NOTEBOOK_KEY, type WikiNotebook, type WikiPersonalEntry } from "@/lib/wiki-notebook";

interface Snapshot { entries: WikiNotebook; ready: boolean; error: string | null }
const initial: Snapshot = { entries: {}, ready: false, error: null };
let snapshot = initial;
const listeners = new Set<() => void>();

function emit() { for (const listener of listeners) listener(); }

function refresh() {
  try {
    snapshot = { entries: readWikiNotebook(window.localStorage), ready: true, error: null };
  } catch {
    snapshot = { ...snapshot, ready: true, error: "Хранилище браузера недоступно. Закладки и заметки не сохранены; введённый текст можно скопировать." };
  }
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key === WIKI_NOTEBOOK_KEY || event.key === null) refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) { refresh(); window.addEventListener("storage", onStorage); }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function updateWikiPersonalEntry(slug: string, patch: WikiPersonalEntry): boolean {
  try {
    const entries = writeWikiPersonalEntry(window.localStorage, slug, patch);
    snapshot = { entries, ready: true, error: null };
    emit();
    return true;
  } catch {
    snapshot = { ...snapshot, ready: true, error: "Не удалось сохранить в этом браузере. Ваши изменения не записаны; скопируйте текст заметки перед уходом." };
    emit();
    return false;
  }
}

const subscribeDisabled = () => () => {};
const getSnapshot = () => snapshot;
const getInitialSnapshot = () => initial;

export function useWikiNotebook(enabled = true) {
  return useSyncExternalStore(enabled ? subscribe : subscribeDisabled, enabled ? getSnapshot : getInitialSnapshot, getInitialSnapshot);
}
