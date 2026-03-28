import { useState, useEffect, useCallback } from 'react';

// ── SPINNER ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '3px solid var(--red-mid)',
      borderTopColor: 'var(--red)',
      borderRadius: '50%',
      animation: 'spin .75s linear infinite',
      margin: '0 auto',
    }} />
  );
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastFn = null;
export function useToast() {
  const show = useCallback((msg, type = 'success') => {
    if (toastFn) toastFn(msg, type);
  }, []);
  return show;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastFn = (msg, type) => {
      const id = Date.now();
      setToasts(t => [...t, { id, msg, type }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--gray-900)', color: '#fff',
          padding: '14px 20px', borderRadius: 14,
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: 'var(--shadow-lg)',
          animation: 'toastIn .3s cubic-bezier(.22,.68,0,1.2)',
          maxWidth: 320,
          borderLeft: `4px solid ${t.type === 'success' ? '#69F0AE' : '#FF5252'}`,
        }}>
          {t.type === 'success'
            ? <svg width="18" height="18" fill="none" stroke="#69F0AE" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            : <svg width="18" height="18" fill="none" stroke="#FF5252" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          }
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── MODAL ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 520 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,19,24,.5)',
        backdropFilter: 'blur(8px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--white)', borderRadius: 32,
        width: '100%', maxWidth,
        boxShadow: '0 24px 80px rgba(0,0,0,.14)',
        animation: 'slideUp .25s cubic-bezier(.22,.68,0,1.2)',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '28px 32px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{
            width: 36, height: 36, border: 'none', background: 'var(--gray-100)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-700)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '20px 32px 32px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

// ── INPUT ────────────────────────────────────────────────────────────────────
export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', padding: '12px 16px',
        background: 'var(--gray-100)', border: '2px solid transparent',
        borderRadius: 14, fontSize: 14, fontWeight: 500,
        color: 'var(--gray-900)', outline: 'none', transition: 'all .2s',
        ...props.style,
      }}
        onFocus={e => { e.target.style.background = 'var(--white)'; e.target.style.borderColor = 'var(--red)'; }}
        onBlur={e => { e.target.style.background = 'var(--gray-100)'; e.target.style.borderColor = 'transparent'; }}
      />
    </div>
  );
}

export function Textarea({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{label}</label>}
      <textarea {...props} style={{
        width: '100%', padding: '12px 16px',
        background: 'var(--gray-100)', border: '2px solid transparent',
        borderRadius: 14, fontSize: 14, fontWeight: 500,
        color: 'var(--gray-900)', outline: 'none', transition: 'all .2s',
        resize: 'vertical', minHeight: 90,
        ...props.style,
      }}
        onFocus={e => { e.target.style.background = 'var(--white)'; e.target.style.borderColor = 'var(--red)'; }}
        onBlur={e => { e.target.style.background = 'var(--gray-100)'; e.target.style.borderColor = 'transparent'; }}
      />
    </div>
  );
}

// ── BADGE ────────────────────────────────────────────────────────────────────
export function Badge({ label, color }) {
  const colors = {
    green:  { bg: '#F0FDF4', text: '#15803D' },
    red:    { bg: 'var(--red-light)', text: 'var(--red)' },
    orange: { bg: '#FFF7ED', text: '#C2410C' },
    gray:   { bg: 'var(--gray-100)', text: 'var(--gray-500)' },
    accent: { bg: 'var(--accent-light)', text: '#8B4A42' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.text,
      display: 'inline-block',
    }}>{label}</span>
  );
}

// ── BUTTON ───────────────────────────────────────────────────────────────────
export function Btn({ children, variant = 'primary', size = 'md', ...props }) {
  const isDisabled = !!props.disabled;
  const base = {
    border: 'none', borderRadius: 14, fontWeight: 700,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 7, transition: 'all .15s',
    fontSize: size === 'sm' ? 12 : 14,
    padding: size === 'sm' ? '7px 14px' : '11px 22px',
    opacity: isDisabled ? 0.55 : 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
  };
  const variants = {
    primary: { background: 'var(--red)', color: '#fff', boxShadow: 'var(--shadow-red)' },
    ghost:   { background: 'var(--gray-100)', color: 'var(--gray-700)' },
    danger:  { background: '#FFF0ED', color: 'var(--red)' },
    accent:  { background: 'var(--accent-light)', color: '#8B4A42' },
    outline: { background: 'transparent', color: 'var(--red)', border: '2px solid var(--red)' },
  };
  return (
    <button {...props} style={{ ...base, ...variants[variant], ...props.style }}
      onMouseEnter={e => { if (!isDisabled && variant === 'primary') e.currentTarget.style.background = '#d02a14'; }}
      onMouseLeave={e => { if (!isDisabled && variant === 'primary') e.currentTarget.style.background = 'var(--red)'; }}
    >
      {children}
    </button>
  );
}

// ── CSS KEYFRAMES (injected once) ────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes toastIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
`;
document.head.appendChild(style);
