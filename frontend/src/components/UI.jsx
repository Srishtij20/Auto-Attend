import React from 'react'

export function Card({ children, style }) {
  return <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden', ...style }}>{children}</div>
}

export function StatCard({ label, value, color = '#4f46e5', sub, icon }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
      {icon && <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#78716c', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function Button({ children, onClick, variant = 'outline', size = 'md', loading, disabled, style }) {
  const s = { outline: { bg: '#fff', color: '#1c1c1a', border: '#e7e5e4' }, primary: { bg: '#4f46e5', color: '#fff', border: '#4f46e5' }, danger: { bg: '#dc2626', color: '#fff', border: '#dc2626' } }[variant] || { bg: '#fff', color: '#1c1c1a', border: '#e7e5e4' }
  return (
    <button onClick={onClick} disabled={loading || disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '5px 10px' : '8px 16px', borderRadius: 8, border: `1px solid ${s.border}`, background: s.bg, color: s.color, fontSize: size === 'sm' ? 12 : 13, fontWeight: 500, opacity: disabled ? .5 : 1, ...style }}>
      {loading && <span style={{ width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite', display: 'inline-block' }} />}
      {children}
    </button>
  )
}

export function Input({ label, error, style, ...props }) {
  return (
    <div style={style}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#78716c', marginBottom: 5 }}>{label}</label>}
      <input {...props} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${error ? '#dc2626' : '#e7e5e4'}`, borderRadius: 8, background: '#fff', color: '#1c1c1a', outline: 'none' }} />
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{error}</div>}
    </div>
  )
}

export function Badge({ children, color = 'gray' }) {
  const m = { green: { bg: '#dcfce7', text: '#16a34a' }, red: { bg: '#fee2e2', text: '#dc2626' }, yellow: { bg: '#fef3c7', text: '#d97706' }, blue: { bg: '#dbeafe', text: '#2563eb' }, gray: { bg: '#f5f5f4', text: '#78716c' } }
  const c = m[color] || m.gray
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text }}>{children}</span>
}

export function Avatar({ name, size = 34 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const hue = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `hsl(${hue},50%,88%)`, color: `hsl(${hue},45%,30%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.35 }}>{initials}</div>
}

export function Modal({ title, children, onClose, width = 520 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#78716c', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

export function Toast({ message, type = 'info', onClose }) {
  const colors = { success: '#16a34a', error: '#dc2626', info: '#4f46e5', warn: '#d97706' }
  React.useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', border: '1px solid #e7e5e4', borderLeft: `4px solid ${colors[type]}`, borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 2000, maxWidth: 340, fontSize: 13 }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#a8a29e', fontSize: 16, cursor: 'pointer' }}>×</button>
    </div>
  )
}

export function Spinner({ size = 20, color = '#4f46e5' }) {
  return <div style={{ width: size, height: size, border: `2px solid ${color}30`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'spin .6s linear infinite', flexShrink: 0 }} />
}

export function Empty({ icon, title, sub }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 10, color: '#a8a29e', textAlign: 'center' }}><div style={{ opacity: .4, fontSize: 36 }}>{icon || '📭'}</div><div style={{ fontWeight: 600, color: '#78716c' }}>{title}</div>{sub && <div style={{ fontSize: 12 }}>{sub}</div>}</div>
}

export function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 90 ? '#16a34a' : pct >= 80 ? '#d97706' : '#dc2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#f5f5f4', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 30 }}>{pct}%</span>
    </div>
  )
}

const s = document.createElement('style')
s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'
document.head.appendChild(s)