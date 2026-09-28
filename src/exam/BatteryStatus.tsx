import { useEffect, useState } from 'react';

interface BatteryManagerLike extends EventTarget { level: number; charging: boolean }
type BatteryNavigator = Navigator & { getBattery?: () => Promise<BatteryManagerLike> };

export function BatteryStatus() {
  const [battery, setBattery] = useState<{ percent: number; charging: boolean } | null>(null);
  useEffect(() => {
    const getBattery = (navigator as BatteryNavigator).getBattery;
    if (typeof getBattery !== 'function') return;
    let current: BatteryManagerLike | null = null; let alive = true;
    const update = () => { if (alive && current) setBattery({ percent: Math.round(Math.max(0, Math.min(1, current.level)) * 100), charging: current.charging }); };
    void getBattery.call(navigator).then((value) => {
      if (!alive) return;
      current = value; update(); current.addEventListener('levelchange', update); current.addEventListener('chargingchange', update);
    }).catch(() => { if (alive) setBattery(null); });
    return () => { alive = false; current?.removeEventListener('levelchange', update); current?.removeEventListener('chargingchange', update); };
  }, []);
  return <div className="battery-status" role="status" aria-label={battery ? `Battery ${battery.percent} percent${battery.charging ? ', charging' : ', not charging'}` : 'Battery status unavailable'}>
    {battery ? <><span className="battery-icon" aria-hidden="true"><i style={{ width: `${battery.percent}%` }} /></span><span>{battery.percent}% {battery.charging ? '· Charging' : ''}</span></> : <span>Battery status unavailable</span>}
  </div>;
}
