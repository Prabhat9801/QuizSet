const prefix = 'quizset:';
export const storage = {
  get<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(prefix + key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } },
  set<T>(key: string, value: T) { localStorage.setItem(prefix + key, JSON.stringify(value)); },
  remove(key: string) { localStorage.removeItem(prefix + key); },
  clear() { Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k)); },
};