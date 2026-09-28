import { useId, type ComponentPropsWithRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ComponentPropsWithRef<'button'> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button type={type} className={`button button--${variant} ${className}`} {...props} />;
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props} />;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'success' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Notice({ title, children, tone = 'info' }: { title: string; children: ReactNode; tone?: 'info' | 'error' }) {
  return <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <strong>{title}</strong><div>{children}</div>
  </div>;
}

export function LoadingState({ label = 'Connecting to the exam service…' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function TextField({ label, hint, error, id, className = '', 'aria-describedby': describedBy, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const description = [describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={`field ${className}`}>
    <label htmlFor={inputId}>{label}{props.required && <span className="required-label"> (required)</span>}</label>
    {hint && <p id={`${inputId}-hint`} className="field-hint">{hint}</p>}
    <input {...props} id={inputId} aria-describedby={description} aria-invalid={error ? true : props['aria-invalid']} />
    {error && <p id={`${inputId}-error`} className="field-error">{error}</p>}
  </div>;
}
