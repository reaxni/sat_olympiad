import { useEffect, useRef, useState } from 'react';
import { Button, LoadingState, Notice } from './ui';
import { Content } from './Content';

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
export function ReferenceSheet() {
  return <div className="reference-sheet"><p>General mathematical formulas. Figures are illustrative.</p><div className="reference-grid">
      <div className="reference-diagram"><svg viewBox="0 0 200 130" role="img" aria-label="Circle with radius r"><circle cx="90" cy="65" r="45"/><path d="M90 65H135"/><text x="105" y="57">r</text></svg><Content blocks={[{ kind: 'math', latex: 'A=\\pi r^2,\\quad C=2\\pi r', accessibleText: 'Circle: area equals pi r squared, circumference equals 2 pi r' }]} /></div>
      <div className="reference-diagram"><svg viewBox="0 0 200 130" role="img" aria-label="Rectangle with length l and width w"><rect x="35" y="35" width="125" height="65"/><text x="95" y="25">l</text><text x="170" y="75">w</text></svg><Content blocks={[{ kind: 'math', latex: 'A=lw', accessibleText: 'Rectangle area equals length times width' }]} /></div>
      <div className="reference-diagram"><svg viewBox="0 0 200 130" role="img" aria-label="Triangle with base b and height h"><path d="M30 105L95 20L170 105Z"/><path d="M95 20V105" strokeDasharray="4"/><text x="95" y="123">b</text><text x="101" y="70">h</text></svg><Content blocks={[{ kind: 'math', latex: 'A=\\tfrac12 bh', accessibleText: 'Triangle area equals one half base times height' }]} /></div>
      <div className="reference-diagram"><svg viewBox="0 0 200 130" role="img" aria-label="Right triangle with legs a and b and hypotenuse c"><path d="M35 20V105H170Z"/><path d="M35 91H49V105"/><text x="95" y="123">a</text><text x="18" y="70">b</text><text x="112" y="56">c</text></svg><Content blocks={[{ kind: 'math', latex: 'a^2+b^2=c^2', accessibleText: 'Right triangle: a squared plus b squared equals c squared' }]} /></div>
      <div><h3>Geometry</h3><Content blocks={[{ kind: 'math', latex: 'A_{\\text{rectangle}}=lw', accessibleText: 'Area of a rectangle equals length times width' }, { kind: 'math', latex: 'A_{\\text{triangle}}=\\tfrac12 bh', accessibleText: 'Area of a triangle equals one half base times height' }, { kind: 'math', latex: 'A_{\\text{circle}}=\\pi r^2,\\quad C=2\\pi r', accessibleText: 'Circle area equals pi r squared; circumference equals 2 pi r' }, { kind: 'math', latex: 'a^2+b^2=c^2', accessibleText: 'For a right triangle, a squared plus b squared equals c squared' }]} /></div>
      <div><h3>Volume & angles</h3><Content blocks={[{ kind: 'math', latex: 'V_{\\text{box}}=lwh', accessibleText: 'Rectangular prism volume equals length times width times height' }, { kind: 'math', latex: 'V_{\\text{cylinder}}=\\pi r^2h', accessibleText: 'Cylinder volume equals pi r squared h' }, { kind: 'math', latex: 'V_{\\text{sphere}}=\\tfrac43\\pi r^3', accessibleText: 'Sphere volume equals four thirds pi r cubed' }, { kind: 'text', text: 'A triangle has 180° in total. A full turn is 360° or 2π radians.' }]} /></div>
      <div><h3>Special right triangles</h3><Content blocks={[{ kind: 'math', latex: '45^\\circ,45^\\circ,90^\\circ:\\quad x, x, x\\sqrt2', accessibleText: '45 45 90 triangle sides: x, x, x square root of 2' }, { kind: 'math', latex: '30^\\circ,60^\\circ,90^\\circ:\\quad x, x\\sqrt3, 2x', accessibleText: '30 60 90 triangle sides: x, x square root of 3, 2 x' }]} /></div>
      <div><h3>Cones & pyramids</h3><Content blocks={[{ kind: 'math', latex: 'V_{\\text{cone}}=\\tfrac13\\pi r^2h', accessibleText: 'Cone volume equals one third pi r squared h' }, { kind: 'math', latex: 'V_{\\text{pyramid}}=\\tfrac13 Bh', accessibleText: 'Pyramid volume equals one third base area times height' }]} /></div>
    </div></div>;
}
