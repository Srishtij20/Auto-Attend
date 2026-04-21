import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function StudentPortal() {
  const [studentId, setStudentId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentUser = JSON.parse(localStorage.getItem('aa_user') || '{}')

  const load = async (id) => {
    setLoading(true); setError('')
    try {
      const [profile, history] = await Promise.all([
        api.getStudent(id),
        api.getStudentAttendance(id),
      ])
      const total = history.length
      const present = history.filter(r => r.status === 'present').length
      const pct = total ? Math.round(present / total * 100) : 0
      setData({ profile, history, stats: { total, present, absent: total - present, pct } })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Student Portal</h1>
      <p style={{ color: '#78716c', marginBottom: 24 }}>View attendance history and statistics for any student</p>

      <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', gap: 10 }}>
        <input style={{ ...inp }} value={studentId} onChange={e => setStudentId(e.target.value)}
          placeholder="Enter Student ID (e.g. STU001)" onKeyDown={e => e.key === 'Enter' && load(studentId)} />
        <button onClick={() => load(studentId)} disabled={!studentId || loading}
          style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', opacity: (!studentId || loading) ? .6 : 1 }}>
          {loading ? 'Loading…' : 'View Record'}
        </button>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Profile card */}
          <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 22 }}>
                {data.profile.full_name?.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{data.profile.full_name}</div>
                <div style={{ color: '#78716c', fontSize: 13 }}>{data.profile.student_id} · {data.profile.class_name}{data.profile.section ? ` (${data.profile.section})` : ''}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: data.stats.pct >= 75 ? '#16a34a' : '#dc2626' }}>{data.stats.pct}%</div>
                <div style={{ fontSize: 12, color: '#78716c' }}>Attendance</div>
              </div>
            </div>

            {data.stats.pct < 75 && (
              <div style={{ marginTop: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ <strong>Low attendance warning</strong> — {data.profile.full_name} has only {data.stats.pct}% attendance. Minimum required is 75%.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 16 }}>
              {[['Total Classes', data.stats.total, '#2563eb', '#eff6ff'], ['Present', data.stats.present, '#16a34a', '#f0fdf4'], ['Absent', data.stats.absent, '#dc2626', '#fef2f2']].map(([l, v, c, bg]) => (
                <div key={l} style={{ background: bg, padding: '12px', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 12, color: c }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* History table */}
          <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ede9', fontWeight: 700 }}>Attendance History</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafaf9' }}>
                    {['Date', 'Subject', 'Class', 'Status', 'Time'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a8a29e', borderBottom: '1px solid #f0ede9', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.history.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#a8a29e' }}>No records found</td></tr>
                  )}
                  {data.history.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #fafaf9' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>{r.date}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>{r.subject || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>{r.class_name}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: r.status === 'present' ? '#dcfce7' : '#fee2e2', color: r.status === 'present' ? '#16a34a' : '#dc2626' }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#78716c' }}>
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}