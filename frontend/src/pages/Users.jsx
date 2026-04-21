import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

const ROLES = ['teacher', 'admin', 'viewer']
const ROLE_COLORS = { admin: '#7c3aed', teacher: '#2563eb', viewer: '#16a34a' }

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', username: '', email: '', password: '', role: 'teacher' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (e) {
      setError('Failed to load users — admin access required')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.full_name || !form.username || !form.email || !form.password) {
      setError('All fields are required'); return
    }
    setSubmitting(true); setError('')
    try {
      await api.createUser(form)
      setSuccess(`User "${form.username}" created as ${form.role}!`)
      setShowModal(false)
      setForm({ full_name: '', username: '', email: '', password: '', role: 'teacher' })
      load()
    } catch (e) {
      setError(e.message)
    } finally { setSubmitting(false) }
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>User Management</h1>
          <p style={{ color: '#78716c', marginTop: 2 }}>{users.length} users in system</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(''); setSuccess('') }}
          style={{ padding: '9px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          + Add User
        </button>
      </div>

      {/* Success toast */}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          ✅ {success}
          <span onClick={() => setSuccess('')} style={{ cursor: 'pointer' }}>✕</span>
        </div>
      )}

      {/* Error */}
      {error && !showModal && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafaf9' }}>
              {['User', 'Username', 'Email', 'Role', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #f0ede9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#a8a29e' }}>Loading…</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#a8a29e' }}>No users found</td></tr>
            )}
            {!loading && users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #fafaf9' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: ROLE_COLORS[u.role] || '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {u.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <code style={{ background: '#f5f5f4', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>@{u.username}</code>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#78716c' }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: ROLE_COLORS[u.role] + '20', color: ROLE_COLORS[u.role] }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#a8a29e' }}>
                  {u.role === 'admin' ? '🔒 Protected' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 20 }}>
        {[
          { role: 'admin', icon: '🔑', desc: 'Full access — manage users, employees, view all reports' },
          { role: 'teacher', icon: '👩‍🏫', desc: 'Can add employees, take attendance, download reports' },
          { role: 'viewer', icon: '👁', desc: 'Read-only — view records and summary only' },
        ].map(r => (
          <div key={r.role} style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{r.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: ROLE_COLORS[r.role] }}>{r.role.charAt(0).toUpperCase() + r.role.slice(1)}</span>
            </div>
            <p style={{ fontSize: 12, color: '#78716c', lineHeight: 1.5 }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>Add New User</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#78716c' }}>✕</button>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 5 }}>Full Name *</label>
                  <input style={inp} value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 5 }}>Username *</label>
                  <input style={inp} value={form.username} onChange={set('username')} placeholder="jsmith" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 5 }}>Email *</label>
                <input style={inp} type="email" value={form.email} onChange={set('email')} placeholder="jane@school.com" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 5 }}>Password *</label>
                  <input style={inp} type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 5 }}>Role *</label>
                  <select style={inp} value={form.role} onChange={set('role')}>
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 10, border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={submit} disabled={submitting} style={{ flex: 2, padding: 10, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? .7 : 1 }}>
                {submitting ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}