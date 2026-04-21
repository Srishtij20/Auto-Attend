import React, { useState } from 'react'
import { api } from '../api'

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Both fields required'); return }
    setLoading(true); setError('')
    try {
      const data = await api.login(form.username, form.password)
      localStorage.setItem('aa_token', data.access_token)
      localStorage.setItem('aa_user', JSON.stringify(data.user))
      onLogin(data.user)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf9' }}>
      <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 40, height: 40, background: '#4f46e5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>A</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Auto<span style={{ color: '#4f46e5' }}>Attend</span></div>
        </div>
        <div style={{ fontSize: 13, color: '#78716c', marginBottom: 24 }}>Sign in to your account</div>
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 5 }}>Username</label>
            <input style={inp} value={form.username} onChange={set('username')} placeholder="your username" autoComplete="username" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 5 }}>Password</label>
            <input style={inp} type="password" value={form.password} onChange={set('password')} placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#a8a29e', textAlign: 'center', marginTop: 20 }}>Contact your administrator for access</p>
      </form>
    </div>
  )
}