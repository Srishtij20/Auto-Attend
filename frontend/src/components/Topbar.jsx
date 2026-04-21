import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import { api } from '../api'

function useDebounce(value, delay) {
  const [deb, setDeb] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDeb(value), delay); return () => clearTimeout(t) }, [value, delay])
  return deb
}

export default function Topbar({ user, onLogout }) {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [notifications, setNotifications] = useState([])
  const searchRef = useRef()
  const debouncedQuery = useDebounce(query, 300)

  // Global search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) { setResults([]); setShowResults(false); return }
    const search = async () => {
      setSearching(true)
      try {
        const [students, employees, classes] = await Promise.all([
          api.getStudents({ limit: 200 }).catch(() => []),
          api.getEmployees({ search: debouncedQuery, limit: 20 }).then(d => d.items || d).catch(() => []),
          api.getClasses().catch(() => []),
        ])
        const q = debouncedQuery.toLowerCase()
        const matchedStudents = (Array.isArray(students) ? students : [])
          .filter(s => s.full_name?.toLowerCase().includes(q) || s.student_id?.toLowerCase().includes(q))
          .slice(0, 5).map(s => ({ type: 'student', label: s.full_name, sub: s.student_id + ' · ' + s.class_name, path: '/students' }))
        const matchedEmployees = employees
          .filter(e => e.name?.toLowerCase().includes(q) || e.employee_id?.toLowerCase().includes(q))
          .slice(0, 3).map(e => ({ type: 'employee', label: e.name, sub: e.employee_id + ' · ' + (e.department || ''), path: '/employees' }))
        const matchedClasses = classes
          .filter(c => c.name?.toLowerCase().includes(q))
          .slice(0, 3).map(c => ({ type: 'class', label: c.name, sub: (c.subjects || []).join(', ') || 'No subjects', path: '/classes' }))
        setResults([...matchedStudents, ...matchedEmployees, ...matchedClasses])
        setShowResults(true)
      } catch (e) {}
      finally { setSearching(false) }
    }
    search()
  }, [debouncedQuery])

  // Click outside to close
  useEffect(() => {
    const handler = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const typeIcon = { student: '🎓', employee: '👤', class: '📚', session: '📋' }
  const typeColor = { student: '#4f46e5', employee: '#16a34a', class: '#d97706', session: '#7c3aed' }

  return (
    <div style={{ height: 60, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 90, boxShadow: 'var(--shadow)' }}>

      {/* Global Search */}
      <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            style={{ width: '100%', paddingLeft: 34, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)' }}
            placeholder="Search students, employees, classes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
          />
          {searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
        </div>
        {showResults && results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 200, marginTop: 4 }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => { navigate(r.path); setShowResults(false); setQuery('') }}
                style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 18 }}>{typeIcon[r.type]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.sub}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: typeColor[r.type] + '20', color: typeColor[r.type], fontWeight: 600 }}>{r.type}</span>
              </div>
            ))}
            {results.length === 0 && <div style={{ padding: '16px 14px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>No results for "{query}"</div>}
          </div>
        )}
        {showResults && query.length >= 2 && results.length === 0 && !searching && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: '14px', zIndex: 200, marginTop: 4, color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            No results for "{query}"
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Theme toggle */}
        <button onClick={toggle} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--text2)' }}>
          {dark ? '☀️' : '🌙'}
        </button>

        {/* User badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user?.role}</div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}