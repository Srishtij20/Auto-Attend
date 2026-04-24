import React, { useEffect, useState, useCallback } from 'react'
import { api, createWebSocket } from '../api'
import { Card, StatCard, Badge, ConfidenceBar, Spinner, Avatar } from '../components/UI'

const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [summary, setSummary] = useState([])
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalStudents, setTotalStudents] = useState(0)

  const load = useCallback(async () => {
    try {
      const [s, sum, students] = await Promise.all([
        api.getDashboard(),
        api.getSummary(),
        api.getStudents({ limit: 1000 }),
      ])
      setStats(s)
      setSummary(sum)
      setTotalStudents(Array.isArray(students) ? students.length : (students?.items?.length ?? 0))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const ws = createWebSocket((msg) => {
      if (msg.event === 'attendance') { setFeed(p => [msg, ...p].slice(0, 25)); load() }
    })
    return () => ws.close()
  }, [load])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spinner size={36} /></div>

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h1>
        <p style={{ color: '#78716c', marginTop: 2 }}>{new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard label="Total Employees" value={stats?.total_employees ?? '—'} color="#4f46e5" />
        <StatCard label="Total Students" value={totalStudents} color="#0891b2" />
        <StatCard label="Active Today" value={stats?.active_today ?? '—'} color="#16a34a" sub={`${stats?.total_employees ? Math.round(stats.active_today / stats.total_employees * 100) : 0}% attendance`} />
        <StatCard label="Currently In" value={stats?.checked_in_now ?? '—'} color="#d97706" />
        <StatCard label="Avg Hours Today" value={(stats?.avg_hours_today ?? 0).toFixed(1) + 'h'} color="#7c3aed" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <Card>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ede9' }}><span style={{ fontWeight: 600, fontSize: 14 }}>Today's Summary</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#fafaf9' }}>
                {['Employee', 'Dept', 'In', 'Out', 'Hours', 'Status'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a8a29e', borderBottom: '1px solid #f0ede9', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {summary.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#a8a29e' }}>No records yet today</td></tr>}
                {summary.map(row => (
                  <tr key={row.employee_id}>
                    <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={row.employee_name} size={28} /><span style={{ fontWeight: 500, fontSize: 13 }}>{row.employee_name}</span></div></td>
                    <td style={{ padding: '10px 14px', color: '#78716c', fontSize: 12 }}>{row.department || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 500, fontSize: 13 }}>{fmt(row.check_in)}</td>
                    <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: 500, fontSize: 13 }}>{fmt(row.check_out)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.total_hours ? row.total_hours + 'h' : '—'}</td>
                    <td style={{ padding: '10px 14px' }}><Badge color={row.status === 'present' ? 'green' : row.status === 'half_day' ? 'yellow' : 'gray'}>{row.status.replace('_', ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ede9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Live Feed</span>
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {feed.length === 0 && <div style={{ padding: '36px 20px', textAlign: 'center', color: '#a8a29e', fontSize: 13 }}>Waiting for activity…</div>}
            {feed.map((evt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < feed.length - 1 ? '1px solid #fafaf9' : 'none' }}>
                <Avatar name={evt.employee_name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.employee_name}</div>
                  <div style={{ fontSize: 11, color: evt.attendance_type === 'check_in' ? '#16a34a' : '#dc2626' }}>
                    {evt.attendance_type === 'check_in' ? '↗ Checked in' : '↙ Checked out'} · {fmt(evt.timestamp)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#a8a29e' }}>{Math.round((evt.confidence || 0) * 100)}%</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}