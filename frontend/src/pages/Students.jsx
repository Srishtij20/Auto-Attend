import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

function InlineEnroll({ student, onClose, onDone }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const TARGET = 8
  const angles = ['Look straight', 'Turn left', 'Turn right', 'Tilt up', 'Tilt down', 'Straight again', 'More left', 'More right']

  useEffect(() => {
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
        setStreaming(true)
      } catch { setError('Camera access denied') }
    }
    startCam()
    return () => { videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()) }
  }, [])

  const capture = () => {
    const v = videoRef.current; const c = canvasRef.current
    if (!v || !c) return
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob(async blob => {
      setUploading(true)
      try {
        const file = new File([blob], `face_${captured}.jpg`, { type: 'image/jpeg' })
        await api.addStudentPhoto(student.student_id, file)
        const next = captured + 1
        setCaptured(next)
        if (next >= TARGET) {
          videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
          setTimeout(() => onDone(), 1500)
        }
      } catch (e) { setError(e.message) }
      finally { setUploading(false) }
    }, 'image/jpeg', 0.9)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Enroll — {student.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{captured}/{TARGET} photos captured</div>
          </div>
          <button onClick={() => { videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); onClose() }}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
        </div>

        <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${(captured / TARGET) * 100}%`, background: 'linear-gradient(90deg,#4f46e5,#22c55e)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {angles.map((a, i) => (
            <div key={i} title={a} style={{ width: 28, height: 28, borderRadius: '50%', background: i < captured ? '#22c55e' : i === captured ? 'var(--accent-dim)' : 'var(--surface2)', border: `2px solid ${i === captured ? 'var(--accent)' : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: i < captured ? '#fff' : 'var(--text3)', transition: 'all 0.2s' }}>
              {i < captured ? '✓' : i + 1}
            </div>
          ))}
        </div>

        {captured < TARGET ? (
          <>
            <div style={{ position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3', marginBottom: 12 }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 150, height: 190, border: '2px solid rgba(99,102,241,0.7)', borderRadius: '50%', boxShadow: '0 0 0 2000px rgba(0,0,0,0.25)' }} />
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,0.7))', padding: '20px 14px 12px', textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                {angles[captured]}
              </div>
            </div>
            {error && <div style={{ background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <button onClick={capture} disabled={uploading || !streaming}
              style={{ width: '100%', padding: 12, background: uploading ? 'var(--surface2)' : 'var(--accent)', color: uploading ? 'var(--text3)' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? '⏳ Saving…' : `📸 Capture — ${angles[captured]}`}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>Enrollment Complete!</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>{TARGET} photos saved successfully</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterClass, setFilterClass] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [enrollTarget, setEnrollTarget] = useState(null)
  const [form, setForm] = useState({ student_id: '', full_name: '', class_name: '', section: '', roll_no: '', email: '', parent_email: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterClass) params.class_name = filterClass
      const [s, c] = await Promise.all([api.getStudents(params), api.getClasses()])
      setStudents(Array.isArray(s) ? s : [])
      setClasses(Array.isArray(c) ? c : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [filterClass])

  useEffect(() => { load() }, [load])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const submit = async () => {
    if (!form.student_id || !form.full_name || !form.class_name) {
      setError('Student ID, name and class are required'); return
    }
    setSubmitting(true); setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      await api.createStudent(fd)
      showToast(`${form.full_name} added successfully!`)
      setShowModal(false)
      setForm({ student_id: '', full_name: '', class_name: '', section: '', roll_no: '', email: '', parent_email: '', phone: '' })
      load()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleCSV = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    let added = 0, failed = 0
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      const row = Object.fromEntries(headers.map((h, j) => [h, vals[j] || '']))
      try {
        const fd = new FormData()
        fd.append('student_id', row.student_id || row.id || `STU${String(i).padStart(3, '0')}`)
        fd.append('full_name', row.full_name || row.name || '')
        fd.append('class_name', row.class_name || row.class || '')
        if (row.email) fd.append('email', row.email)
        if (row.parent_email) fd.append('parent_email', row.parent_email)
        if (row.roll_no) fd.append('roll_no', row.roll_no)
        if (row.phone) fd.append('phone', row.phone)
        await api.createStudent(fd)
        added++
      } catch { failed++ }
    }
    showToast(`CSV imported: ${added} added, ${failed} failed`)
    load()
    e.target.value = ''
  }

  const filtered = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(search.toLowerCase())
  )

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '28px 32px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: 'var(--success-l)', border: '1px solid var(--success)', borderRadius: 10, padding: '12px 18px', color: 'var(--success)', fontWeight: 600, zIndex: 999, boxShadow: 'var(--shadow-lg)', animation: 'fadeIn 0.3s ease' }}>
          ✅ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Students</h1>
          <p style={{ color: 'var(--text3)', marginTop: 2 }}>{students.length} students registered</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ padding: '9px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 Import CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} />
          </label>
          <button onClick={() => { setShowModal(true); setError('') }}
            style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            + Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input style={{ ...inp, flex: 1, maxWidth: 260 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID…" />
        <select style={{ ...inp, width: 180 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              {['Student ID', 'Name', 'Class', 'Roll No', 'Parent Email', 'Face Status', 'Actions'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
                No students found. Click <strong>+ Add Student</strong> to add your first student.
              </td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.student_id}>
                <td><code style={{ background: 'var(--surface2)', padding: '2px 7px', borderRadius: 5, fontSize: 12 }}>{s.student_id}</code></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {s.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600 }}>{s.full_name}</span>
                  </div>
                </td>
                <td>{s.class_name}{s.section ? ` (${s.section})` : ''}</td>
                <td style={{ color: 'var(--text3)' }}>{s.roll_no || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: 12 }}>{s.parent_email || '—'}</td>
                <td>
                  {s.face_registered
                    ? <span style={{ background: 'var(--success-l)', color: 'var(--success)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>✓ Enrolled</span>
                    : <span style={{ background: 'var(--warn-l)', color: 'var(--warn)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>⚠ Not enrolled</span>
                  }
                </td>
                <td>
                  <button onClick={() => setEnrollTarget(s)}
                    style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                    📷 {s.face_registered ? 'Add More Photos' : 'Enroll Face'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Add New Student</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
            </div>
            {error && <div style={{ background: 'var(--danger-l)', border: '1px solid var(--danger)', borderRadius: 8, padding: '8px 12px', color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Student ID *</label>
                  <input style={inp} value={form.student_id} onChange={set('student_id')} placeholder="STU001" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Full Name *</label>
                  <input style={inp} value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Class *</label>
                  <select style={inp} value={form.class_name} onChange={set('class_name')}>
                    <option value="">— Select class —</option>
                    {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Roll No</label>
                  <input style={inp} value={form.roll_no} onChange={set('roll_no')} placeholder="01" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Student Email</label>
                <input style={inp} type="email" value={form.email} onChange={set('email')} placeholder="student@email.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Parent Email <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(for absence alerts)</span></label>
                <input style={inp} type="email" value={form.parent_email} onChange={set('parent_email')} placeholder="parent@email.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>Phone</label>
                <input style={inp} value={form.phone} onChange={set('phone')} placeholder="+91 9876543210" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, color: 'var(--text)' }}>Cancel</button>
              <button onClick={submit} disabled={submitting} style={{ flex: 2, padding: 10, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Adding…' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Face Enrollment */}
      {enrollTarget && (
        <InlineEnroll
          student={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onDone={() => { setEnrollTarget(null); load(); showToast(`${enrollTarget.full_name} face enrolled!`) }}
        />
      )}
    </div>
  )
}