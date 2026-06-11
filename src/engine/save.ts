/** Progress persistence via localStorage (works inside the Capacitor WebView). */
export interface SaveData {
  /** Highest chapter unlocked (1-based). */
  chapterUnlocked: number;
  /** Chapters fully completed. */
  completedChapters: number[];
  /** Furthest screen reached per chapter, e.g. { 1: '1-4' }. */
  reached: Record<number, string>;
  deaths: number;
  /** Collected light mote ids, e.g. '2-3:12,8'. */
  motes: string[];
  /** Whether the ending has been seen. */
  finished: boolean;
}

const KEY = 'lumen-save-v1';

export function defaultSave(): SaveData {
  return {
    chapterUnlocked: 1,
    completedChapters: [],
    reached: {},
    deaths: 0,
    motes: [],
    finished: false,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode etc.) — play without persistence.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
