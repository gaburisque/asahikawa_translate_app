// Local storage management for history, bookmarks, and settings


export interface TranslationItem {
  id: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  originalLang: 'ja' | 'en';
  targetLang: 'ja' | 'en';
  isBookmarked: boolean;
}

export interface AppSettings {
  autoTTS: boolean;
  ttsSpeed: 0.75 | 1.0 | 1.25;
  languageOverride: 'auto' | 'ja' | 'en';
}

const HISTORY_KEY = 'avt_history';
const BOOKMARKS_KEY = 'avt_bookmarks';
const SETTINGS_KEY = 'avt_settings';
const MAX_HISTORY = 100;

// History management
export function getHistory(): TranslationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item: Omit<TranslationItem, 'id' | 'timestamp' | 'isBookmarked'>): TranslationItem {
  const history = getHistory();
  const newItem: TranslationItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    isBookmarked: false,
  };
  
  // Check for duplicates
  const existingIndex = history.findIndex(
    h => h.originalText === item.originalText && h.translatedText === item.translatedText
  );
  
  if (existingIndex >= 0) {
    // Update timestamp of existing item
    history[existingIndex].timestamp = Date.now();
  } else {
    history.unshift(newItem);
    // Keep only MAX_HISTORY items
    if (history.length > MAX_HISTORY) {
      history.pop();
    }
  }
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return newItem;
}

export function toggleBookmark(id: string): boolean {
  const history = getHistory();
  const item = history.find(h => h.id === id);
  if (item) {
    item.isBookmarked = !item.isBookmarked;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return item.isBookmarked;
  }
  return false;
}

export function getBookmarks(): TranslationItem[] {
  return getHistory().filter(item => item.isBookmarked);
}

export function deleteHistoryItem(id: string): void {
  const history = getHistory().filter(h => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
}

// Settings management
export function getSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return { autoTTS: true, ttsSpeed: 1.0, languageOverride: 'auto' };
  }
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { autoTTS: true, ttsSpeed: 1.0, languageOverride: 'auto' };
  } catch {
    return { autoTTS: true, ttsSpeed: 1.0, languageOverride: 'auto' };
  }
}

export function updateSettings(settings: Partial<AppSettings>): void {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
}

