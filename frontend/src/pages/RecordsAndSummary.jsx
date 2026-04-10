import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { Card, Button, Badge, Avatar, Spinner, Empty, ConfidenceBar } from '../components/UI'

const fmt = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

export function Records() {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({ employee_id: '', attendance_type: '', start_date: '', end_date: '' })
  const LIMIT = 50
  const setF = k => e => setFilters(f => ({ ...f, [k]: e.target.value }))
  const iStyle = { padding: '7px 11px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { skip: page * LIMIT, limit: LIMIT }
      if (filters.employee_id) params.employee_id = filters.employee_id
      if (filters.attendance_type) params.attendance_type = filters.attendance_type
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      const d = await api.getRecords(params)
      setRecords(d.items || []); setTotal(d.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, fontWeight: 700 }}>Attendance Records</h1><p style={{ color: '#78716c', marginTop: 2 }}>{total.toLocaleString()} records</p></div>
      <Card>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input value={filters.employee_id} onChange={setF('employee_id')} placeholder="Employee ID" style={{ ...iStyle, flex: '1 1 120px' }} />
          <select value={filters.attendance_type} onChange={setF('attendance_type')} style={{ ...iStyle, flex: '0 1 140px' }}>
            <option value="">All types</option>
            <option value="check_in">Check in</option>
            <option value="check_out">Check out</option>
          </select>
          <input type="datetime-local" value={filters.start_date} onChange={setF('start_date')} style={iStyle} />
          <span style={{ color: '#a8a29e', fontSize: 12 }}>to</span>
          <input type="datetime-local" value={filters.end_date} onChange={setF('end_date')} style={iStyle} />
          <Button onClick={load}>Apply</Button>
          <Button onClick={() => { setFilters({ employee_id: '', attendance_type: '', start_date: '', end_date: '' }); setPage(0) }}>Clear</Button>
        </div>
      </Card>
      <div style={{ marginTop: 16 }}>
        <Card>
          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>}
          {!loading && records.length === 0 && <Empty icon="📋" title="No records found" sub="Try adjusting your filters" />}
          {!loading && records.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#fafaf9' }}>
                  {['Employee', 'Type', 'Confidence', 'Timestamp', 'Location'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a8a29e', borderBottom: '1px solid #f0ede9', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #fafaf9' }}>
                      <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={r.employee_name} size={28} /><div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.employee_name}</div><div style={{ fontSize: 11, color: '#a8a29e', fontFamily: 'monospace' }}>{r.employee_id}</div></div></div></td>
                      <td style={{ padding: '10px 14px' }}><Badge color={r.attendance_type === 'check_in' ? 'green' : 'red'}>{r.attendance_type === 'check_in' ? '↗ Check In' : '↙ Check Out'}</Badge></td>
                      <td style={{ padding: '10px 14px', minWidth: 120 }}><ConfidenceBar value={r.confidence} /></td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#78716c', whiteSpace: 'nowrap' }}>{fmt(r.timestamp)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#78716c' }}>{r.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > LIMIT && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid #f0ede9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#78716c' }}>Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                <Button size="sm" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next →</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export function Summary() {
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [stats, setStats] = useState({ present: 0, half: 0, totalHours: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.getSummary(date ? date + 'T00:00:00' : undefined)
      setSummary(d)
      setStats({
        present: d.filter(r => r.status === 'present').length,
        half: d.filter(r => r.status === 'half_day').length,
        totalHours: Math.round(d.reduce((a, r) => a + (r.total_hours || 0), 0) * 10) / 10,
      })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, fontWeight: 700 }}>Daily Summary</h1><p style={{ color: '#78716c', marginTop: 2 }}>Attendance overview per employee</p></div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#78716c', marginBottom: 5 }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }} />
        </div>
        <Button onClick={load}>Load</Button>
        <Button onClick={() => setDate(new Date().toISOString().slice(0, 10))}>Today</Button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {[{ label: 'Present', value: stats.present, color: '#16a34a', bg: '#dcfce7' }, { label: 'Half day', value: stats.half, color: '#d97706', bg: '#fef3c7' }, { label: 'Total hours', value: stats.totalHours + 'h', color: '#4f46e5', bg: '#eef2ff' }].map(s => (
            <div key={s.label} style={{ padding: '10px 16px', borderRadius: 10, background: s.bg, minWidth: 100, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.color, opacity: .8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <Card>
        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>}
        {!loading && summary.length === 0 && <Empty icon="📅" title="No data for this date" sub="Select a different date or check back later" />}
        {!loading && summary.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#fafaf9' }}>
                {['Employee', 'Department', 'Check In', 'Check Out', 'Hours', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a8a29e', borderBottom: '1px solid #f0ede9', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {summary.map(row => (
                  <tr key={row.employee_id} style={{ borderBottom: '1px solid #fafaf9' }}>
                    <td style={{ padding: '11px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={row.employee_name} size={28} /><div><div style={{ fontWeight: 500, fontSize: 13 }}>{row.employee_name}</div><div style={{ fontSize: 11, color: '#a8a29e', fontFamily: 'monospace' }}>{row.employee_id}</div></div></div></td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#78716c' }}>{row.department || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#16a34a', fontWeight: 500, fontSize: 13 }}>{fmtTime(row.check_in)}</td>
                    <td style={{ padding: '11px 14px', color: '#dc2626', fontWeight: 500, fontSize: 13 }}>{fmtTime(row.check_out)}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 500, fontSize: 13 }}>{row.total_hours != null ? <span style={{ color: row.total_hours >= 8 ? '#16a34a' : row.total_hours >= 4 ? '#d97706' : '#dc2626' }}>{row.total_hours}h</span> : '—'}</td>
                    <td style={{ padding: '11px 14px' }}><Badge color={{ present: 'green', half_day: 'yellow', absent: 'gray' }[row.status] || 'gray'}>{row.status.replace('_', ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}