import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const links = [
  { to: '/',          icon: '⊞', label: 'Dashboard' },
  { to: '/mark',      icon: '◉', label: 'Mark Attendance' },
  { to: '/employees', icon: '◈', label: 'Employees' },
  { to: '/records',   icon: '☰', label: 'Records' },
  { to: '/summary',   icon: '◫', label: 'Summary' },
]

export default function Sidebar({ liveCount }) {
  const loc = useLocation()
  return (
    <aside style={{ width: 220, flexShrink: 0, background: '#1e1b4b', display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👁</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>FaceAttend</div>
            <div style={{ color: '#818cf8', fontSize: 10, fontWeight: 500 }}>v2.0</div>
          </div>
        </div>
      </div>
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {links.map(l => {
          const active = loc.pathname === l.to
          return (
            <NavLink key={l.to} to={l.to} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, marginBottom: 2,
              color: active ? '#fff' : '#a5b4fc',
              background: active ? 'rgba(99,102,241,.25)' : 'transparent',
              fontSize: 13, fontWeight: active ? 600 : 400,
            }}>
              <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{l.icon}</span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {l.to === '/mark' && liveCount > 0 && (
                <span style={{ background: '#4ade80', color: '#14532d', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{liveCount}</span>
              )}
            </NavLink>
          )
        })}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 11, color: '#6366f1' }}>
        {liveCount} currently checked in
      </div>
    </aside>
  )
}