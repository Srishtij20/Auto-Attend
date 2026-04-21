import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function ClassesSettings() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [newClass, setNewClass] = useState({ name: '', section: '', subjects: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingSubjects, setEditingSubjects] = useState(null)
  const [subjectInput, setSubjectInput] = useState('')

  const load = async () => {
    setLoading(true)
    try { setClasses(await api.getClasses()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const createClass = async () => {
    if (!newClass.name) { setError('Class name required'); return }
    setSubmitting(true); setError('')
    try {
      await api.createClass({
        name: newClass.name,
        section: newClass.section || undefined,
        subjects: newClass.subjects ? newClass.subjects.split(',').map(s => s.trim()).filter(Boolean) : [],
      })
      setNewClass({ name: '', section: '', subjects: '' })
      load()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const saveSubjects = async (className) => {
    const subjects = subjectInput.split(',').map(s => s.trim()).filter(Boolean)
    await api.updateSubjects(className, subjects)
    setEditingSubjects(null)
    load()
  }

  const deleteClass = async (name) => {
    if (!confirm(`Delete class "${name}"?`)) return
    await api.deleteClass(name)
    load()
  }

  const inp = { padding: '9px 12px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Classes & Subjects</h1>
      <p style={{ color: '#78716c', marginBottom: 24 }}>Manage classes and their subjects for attendance sessions</p>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Add new class */}
      <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Add New Class</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#78716c', marginBottom: 4 }}>Class Name *</label>
            <input style={{ ...inp, width: '100%' }} value={newClass.name} onChange={e => setNewClass(c => ({ ...c, name: e.target.value }))} placeholder="e.g. CS-3A" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#78716c', marginBottom: 4 }}>Section</label>
            <input style={{ ...inp, width: '100%' }} value={newClass.section} onChange={e => setNewClass(c => ({ ...c, section: e.target.value }))} placeholder="e.g. Morning" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#78716c', marginBottom: 4 }}>Subjects (comma separated)</label>
            <input style={{ ...inp, width: '100%' }} value={newClass.subjects} onChange={e => setNewClass(c => ({ ...c, subjects: e.target.value }))} placeholder="Math, Physics, Chemistry" />
          </div>
          <button onClick={createClass} disabled={submitting} style={{ padding: '9px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>
      </div>

      {/* Classes list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#a8a29e' }}>Loading…</div>}
        {!loading && classes.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#a8a29e', background: '#fff', borderRadius: 12, border: '1px solid #e7e5e4' }}>
            No classes yet — add your first class above
          </div>
        )}
        {classes.map(cls => (
          <div key={cls.name} style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{cls.name}</span>
                {cls.section && <span style={{ marginLeft: 8, fontSize: 12, color: '#78716c' }}>({cls.section})</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditingSubjects(cls.name); setSubjectInput((cls.subjects || []).join(', ')) }}
                  style={{ padding: '5px 12px', border: '1px solid #e7e5e4', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                  Edit Subjects
                </button>
                <button onClick={() => deleteClass(cls.name)}
                  style={{ padding: '5px 12px', border: '1px solid #fecaca', borderRadius: 6, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
                  Delete
                </button>
              </div>
            </div>
            {editingSubjects === cls.name ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inp, flex: 1 }} value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="Math, Physics, Chemistry" />
                <button onClick={() => saveSubjects(cls.name)} style={{ padding: '7px 14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>Save</button>
                <button onClick={() => setEditingSubjects(null)} style={{ padding: '7px 14px', border: '1px solid #e7e5e4', borderRadius: 7, cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(cls.subjects || []).length === 0
                  ? <span style={{ fontSize: 12, color: '#a8a29e' }}>No subjects — click Edit Subjects to add</span>
                  : (cls.subjects || []).map(s => (
                    <span key={s} style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>{s}</span>
                  ))
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}