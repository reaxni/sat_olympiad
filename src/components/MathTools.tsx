import { useEffect, useRef, useState } from 'react';
import { Button, LoadingState, Notice } from './ui';
export { ReferenceSheet } from './ReferenceSheet';

interface Calculator { destroy: () => void; resize: () => void }
export type CalculatorMode = 'graphing' | 'scientific';
interface DesmosApi {
  enabledFeatures?: { GraphingCalculator?: boolean; ScientificCalculator?: boolean };
  GraphingCalculator?: (element: HTMLElement, options?: Record<string, unknown>) => Calculator;
  ScientificCalculator?: (element: HTMLElement, options?: Record<string, unknown>) => Calculator;
}
declare global { interface Window { Desmos?: DesmosApi } }
export function calculatorEnabled(api: DesmosApi | undefined, mode: CalculatorMode) {
  const feature = mode === 'scientific' ? 'ScientificCalculator' : 'GraphingCalculator';
  return api?.enabledFeatures?.[feature] === true && typeof api[feature] === 'function';
}
let scriptPromise: Promise<void> | null = null;
function loadDesmos(key: string): Promise<void> {
  if (window.Desmos) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => fail(), 15_000);
    const fail = () => { clearTimeout(timer); script.remove(); scriptPromise = null; reject(new Error('Calculator could not load.')); };
    script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => { clearTimeout(timer); if (window.Desmos) resolve(); else fail(); };
    script.onerror = fail; document.head.append(script);
  });
  return scriptPromise;
}
export function CalculatorPanel({ mode, active }: { mode: CalculatorMode; active: boolean }) {
  const container = useRef<HTMLDivElement>(null); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'); const [retry, setRetry] = useState(0);
  const [error, setError] = useState(''); const instance = useRef<Calculator | null>(null);
  const key = import.meta.env.VITE_DESMOS_API_KEY;
  useEffect(() => {
    if (!key) return;
    let cancelled = false; let calculator: Calculator | undefined; let observer: ResizeObserver | undefined;
    setState('loading');
    void loadDesmos(key).then(() => {
      if (cancelled || !container.current || !window.Desmos) return;
      if (!calculatorEnabled(window.Desmos, mode)) {
        setError(mode === 'scientific'
          ? 'Scientific calculator is not enabled for the configured Desmos API key.'
          : 'Graphing calculator is not enabled for the configured Desmos API key.');
        setState('error'); return;
      }
      const construct = mode === 'scientific' ? window.Desmos.ScientificCalculator! : window.Desmos.GraphingCalculator!;
      calculator = construct(container.current, { autosize: false }); instance.current = calculator;
      observer = new ResizeObserver(() => calculator?.resize()); observer.observe(container.current); setState('ready');
    }).catch(() => { if (!cancelled) { setError('The Desmos script could not load. Check the network connection.'); setState('error'); } });
    return () => { cancelled = true; observer?.disconnect(); calculator?.destroy(); instance.current = null; };
  }, [key, mode, retry]);
  useEffect(() => { if (active && state === 'ready') requestAnimationFrame(() => instance.current?.resize()); }, [active, state]);
  if (!key) return <Notice title="Calculator unavailable">The Desmos API key has not been configured. Contact the exam organizer.</Notice>;
  return <>{state === 'loading' && <LoadingState label={`Loading Desmos ${mode} calculator…`} />}{state === 'error' && <><Notice tone="error" title={`${mode === 'scientific' ? 'Scientific' : 'Graphing'} calculator unavailable`}>{error}</Notice>{!error.includes('not enabled') && <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>Retry calculator</Button>}</>}<div ref={container} className="calculator" aria-label={`Desmos ${mode} calculator`} hidden={state === 'error'} /></>;
}
