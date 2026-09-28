type IconProps = { size?: number };

export function BookmarkIcon({ size = 22, filled = false }: IconProps & { filled?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#bb2948' : 'none'} stroke={filled ? '#7d1731' : 'currentColor'} strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z" /></svg>;
}

export function CurrentPinIcon({ size = 20 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

export function TimerIcon({ size = 24 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="7" /><path d="M12 13V9m0 4 3 2M9 2h6m-3 0v4m6 1 1.5-1.5" /></svg>;
}
export function CalculatorIcon({ size = 24 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><rect x="8" y="5" width="8" height="4" rx=".5" /><path d="M8 13h1m3 0h1m3 0h1M8 17h1m3 0h1m3 0h1" /></svg>;
}
export function ReferenceIcon({ size = 24 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h12M4 17h10M8 4l5 13M16 4l5 6m0-6-5 6" /><path d="M17 16h4m-4 4h4m-2-4v4" /></svg>;
}
export function EliminationIcon({ size = 26 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="5" fill="#315bd2" stroke="#183487" strokeWidth="1.5" /><text x="16" y="20" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Arial,sans-serif">ABC</text><path d="M5 26 27 5" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>;
}
export function MoreIcon({ size = 24 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>;
}
