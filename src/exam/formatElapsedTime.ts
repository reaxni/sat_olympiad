export function formatElapsedTime(seconds: number) {
  const elapsed = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, '0')} s`;
}
