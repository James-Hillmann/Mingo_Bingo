const KEY = "mingo-song-count";

export function loadCount(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(KEY);
  const parsed = parseInt(stored ?? "0", 10);
  return isNaN(parsed) ? 0 : Math.max(0, Math.min(75, parsed));
}

export function saveCount(n: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, String(n));
}

export function resetCount(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
