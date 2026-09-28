import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './ui';

export function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const element = ref.current; const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby="modal-title" onCancel={(event) => { event.preventDefault(); closeRef.current(); }}><div className="modal-heading"><h2 id="modal-title">{title}</h2><Button variant="quiet" aria-label="Close dialog" onClick={onClose}>×</Button></div>{children}</dialog>;
}
