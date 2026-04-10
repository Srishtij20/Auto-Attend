import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import { Button, Card, Input, Badge, Avatar, Modal, Toast, Empty, Spinner } from '../components/UI'

function EmployeeForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { employee_id: '', name: '', email: '', department: '', position: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setError('')
    if (!form.employee_id || !form.name || !form.email) { setError('ID, name and email are required'); return }
    setLoading(true)
    try { await onSave(form); onClose() }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 13 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Employee ID *" value={form.employee_id} onChange={set('employee_id')} placeholder="EMP001" disabled={!!initial} />
        <Input label="Full Name *" value={form.name} onChange={set('name')} placeholder="Jane Smith" />
      </div>
      <Input label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Department" value={form.department} onChange={set('department')} placeholder="Engineering" />
        <Input label="Position" value={form.position} onChange={set('position')} placeholder="Developer" />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={submit}>{initial ? 'Save Changes' : 'Create Employee'}</Button>
      </div>
    </div>
  )
}

function PhotoManager({ employee, onClose, onUpdate }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const videoRef = useRef(); const canvasRef = useRef()
  const [streaming, setStreaming] = useState(false)
  const MAX = 120

  const loadPhotos = useCallback(async () => {
    try { const d = await api.listPhotos(employee.employee_id); setPhotos(d.photos || []) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [employee.employee_id])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  const uploadFile = async (file) => {
    setUploading(true); setError('')
    try { const r = await api.addPhoto(employee.employee_id, file); setToast({ msg: r.message, type: 'success' }); await loadPhotos(); onUpdate() }
    catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }

  const startCamera = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); videoRef.current.srcObject = s; videoRef.current.play(); setStreaming(true) }
    catch { setError('Camera access denied') }
  }

  const captureAndUpload = async () => {
    const c = canvasRef.current, v = videoRef.current
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob(async (blob) => {
      v.srcObject?.getTracks().forEach(t => t.stop()); setStreaming(false)
      await uploadFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.85)
  }

  const deletePhoto = async (photoId) => {
    if (!confirm('Delete this photo?')) return
    try { await api.deletePhoto(employee.employee_id, photoId); setToast({ msg: 'Photo deleted', type: 'success' }); await loadPhotos(); onUpdate() }
    catch (e) { setError(e.message) }
  }

  const pct = Math.round((photos.length / MAX) * 100)

  return (
    <Modal title={`Photos — ${employee.name}`} onClose={onClose} width={640}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#78716c', marginBottom: 6 }}>
          <span>Face photos stored</span><span style={{ fontWeight: 600 }}>{photos.length} / {MAX}</span>
        </div>
        <div style={{ height: 8, background: '#f5f5f4', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: pct > 90 ? '#dc2626' : pct > 60 ? '#d97706' : '#4f46e5', borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 4 }}>{MAX - photos.length} slots remaining · more photos = better accuracy</div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {streaming && (
        <div style={{ marginBottom: 14 }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'cover', background: '#0f0e17' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button variant="primary" onClick={captureAndUpload} loading={uploading}>📸 Capture & Save</Button>
            <Button onClick={() => { videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); setStreaming(false) }}>Cancel</Button>
          </div>
        </div>
      )}
      {!streaming && <canvas ref={canvasRef} style={{ display: 'none' }} />}

      {!streaming && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={startCamera} disabled={photos.length >= MAX}>📷 Add via Camera</Button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #e7e5e4', background: photos.length >= MAX ? '#f5f5f4' : '#fff', fontSize: 13, fontWeight: 500, cursor: photos.length >= MAX ? 'not-allowed' : 'pointer', opacity: photos.length >= MAX ? .5 : 1 }}>
            {uploading ? '⏳ Uploading…' : '📁 Upload File'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadFile(e.target.files[0])} disabled={photos.length >= MAX} />
          </label>
          {photos.length > 0 && <Button variant="danger" size="sm" onClick={async () => { if (!confirm(`Delete all ${photos.length} photos?`)) return; await api.clearPhotos(employee.employee_id); await loadPhotos(); onUpdate() }}>🗑 Clear All</Button>}
        </div>
      )}

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>}
      {!loading && photos.length === 0 && <Empty icon="📷" title="No photos yet" sub="Add at least 5–10 photos for reliable recognition" />}
      {!loading && photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
          {photos.map((p, i) => (
            <div key={p.photo_id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
              <img src={api.photoUrl(employee.employee_id, p.photo_id)} alt={`photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              <button onClick={() => deletePhoto(p.photo_id)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.65)', border: 'none', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 9, padding: '2px 4px', textAlign: 'center' }}>#{i + 1}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const [departments, setDepartments] = useState([])
  const [page, setPage] = useState(0)
  const LIMIT = 20
  const [createModal, setCreateModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [photoTarget, setPhotoTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { skip: page * LIMIT, limit: LIMIT }
      if (search) params.search = search
      if (dept) params.department = dept
      const data = await api.getEmployees(params)
      setEmployees(data.items || data); setTotal(data.total || (data.items || data).length)
    } catch (e) { setToast({ msg: e.message, type: 'error' }) }
    finally { setLoading(false) }
  }, [search, dept, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { api.getDepartments().then(d => setDepartments(d.departments || [])).catch(() => {}) }, [])

  return (
    <div style={{ padding: '28px 32px' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 700 }}>Employees</h1><p style={{ color: '#78716c', marginTop: 2 }}>{total} total</p></div>
        <Button variant="primary" onClick={() => setCreateModal(true)}>+ Add Employee</Button>
      </div>

      <Card>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Input label="Search" placeholder="Name, ID or email…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} style={{ flex: '1 1 200px' }} />
          <div style={{ flex: '0 1 160px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#78716c', marginBottom: 5 }}>Department</label>
            <select value={dept} onChange={e => { setDept(e.target.value); setPage(0) }} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff', fontSize: 13 }}>
              <option value="">All departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <Button onClick={load}>Refresh</Button>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card>
          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>}
          {!loading && employees.length === 0 && <Empty icon="👤" title="No employees found" sub="Add your first employee to get started" />}
          {!loading && employees.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#fafaf9' }}>
                  {['Employee', 'ID', 'Department', 'Position', 'Photos', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#a8a29e', borderBottom: '1px solid #f0ede9', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.employee_id} style={{ borderBottom: '1px solid #fafaf9' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={emp.name} />
                          <div><div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div><div style={{ fontSize: 11, color: '#a8a29e' }}>{emp.email}</div></div>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', color: '#78716c' }}>{emp.employee_id}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13 }}>{emp.department || <span style={{ color: '#a8a29e' }}>—</span>}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13 }}>{emp.position || <span style={{ color: '#a8a29e' }}>—</span>}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 48, height: 5, background: '#f0ede9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: Math.round(emp.photo_count / 120 * 100) + '%', background: emp.photo_count >= 10 ? '#16a34a' : '#d97706', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: emp.photo_count >= 5 ? '#16a34a' : '#d97706', fontWeight: 600 }}>{emp.photo_count}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px' }}><Badge color={emp.is_active ? 'green' : 'gray'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button size="sm" onClick={() => setPhotoTarget(emp)}>📷 Photos</Button>
                          <Button size="sm" onClick={() => setEditTarget(emp)}>Edit</Button>
                          <Button size="sm" variant="danger" onClick={async () => { if (!confirm(`Deactivate ${emp.name}?`)) return; await api.deactivateEmployee(emp.employee_id); load() }}>Deactivate</Button>
                        </div>
                      </td>
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

      {createModal && <Modal title="Add New Employee" onClose={() => setCreateModal(false)}><EmployeeForm onSave={async d => { await api.createEmployee(d); setToast({ msg: `${d.name} created`, type: 'success' }); load() }} onClose={() => setCreateModal(false)} /></Modal>}
      {editTarget && <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}><EmployeeForm initial={editTarget} onSave={async d => { await api.updateEmployee(editTarget.employee_id, d); setToast({ msg: 'Employee updated', type: 'success' }); load() }} onClose={() => setEditTarget(null)} /></Modal>}
      {photoTarget && <PhotoManager employee={photoTarget} onClose={() => setPhotoTarget(null)} onUpdate={load} />}
    </div>
  )
}