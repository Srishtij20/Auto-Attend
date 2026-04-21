import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', absent: '🔔' }
  const colors = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    info: { bg: 'var(--surface)', border: 'var(--border2)', text: 'var(--text)' },
    absent: { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info
          return (
            <div key={t.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 16px', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'slideIn 0.3s ease', color: c.text }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[t.type] || icons.info}</span>
              <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{t.message}</span>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)