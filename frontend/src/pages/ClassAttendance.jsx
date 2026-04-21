import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api'

export default function ClassAttendance() {
  const [classes, setClasses] = useState([])
  const [step, setStep] = useState('setup') // setup | live | done
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [subjects, setSubjects] = useState([])
  const [session, setSession] = useState(null)
  const [feed, setFeed] = useState([])
  const [progress, setProgress] = useState({ present: 0, total: 0 })
  const [autoScan, setAutoScan] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    api.getClasses().then(setClasses).catch(() => {})
  }, [])

  const onClassChange = (cls) => {
    setSelectedClass(cls)
    const found = classes.find(c => c.name === cls)
    setSubjects(found?.subjects || [])
    setSelectedSubject('')
  }

  const startSession = async () => {
    if (!selectedClass || !selectedSubject) return
    const fd = new FormData()
    fd.append('class_name', selectedClass)
    fd.append('subject', selectedSubject)
    const res = await api.startSession(fd)
    setSession(res)
    setProgress({ present: 0, total: res.total_students })
    setStep('live')
    startCamera()
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch (e) { alert('Camera access denied') }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(scanRef.current)
  }

  const captureAndMark = useCallback(async () => {
    if (!session || scanning) return
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(async (blob) => {
      if (!blob) return
      setScanning(true)
      try {
        const fd = new FormData(); fd.append('image', blob, 'frame.jpg')
        const result = await api.markSessionAttendance(session.session_id, fd)
        setLastResult(result)
        if (result.matched && !result.already_marked) {
          setFeed(f => [result, ...f].slice(0, 20))
          setProgress(p => ({ ...p, present: p.present + 1 }))
        }
      } catch (e) {}
      finally { setScanning(false) }
    }, 'image/jpeg', 0.85)
  }, [session, scanning])

  useEffect(() => {
    if (autoScan && step === 'live') {
      scanRef.current = setInterval(captureAndMark, 2500)
    } else {
      clearInterval(scanRef.current)
    }
    return () => clearInterval(scanRef.current)
  }, [autoScan, step, captureAndMark])

  const endSession = async () => {
    const res = await api.endSession(session.session_id)
    stopCamera()
    setStep('done')
    setLastResult(res)
  }

  const pct = progress.total ? Math.round(progress.present / progress.total * 100) : 0

  if (step === 'setup') return (
    <div style={{ padding: '28px 32px', maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Class Attendance</h1>
      <p style={{ color: '#78716c', marginBottom: 24 }}>Select class and subject to start a session</p>
      <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 6 }}>Class *</label>
          <select value={selectedClass} onChange={e => onClassChange(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 14, background: '#fff' }}>
            <option value="">— Select class —</option>
            {classes.map(c => <option key={c.name} value={c.name}>{c.name}{c.section ? ` (${c.section})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 6 }}>Subject *</label>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
            disabled={!selectedClass}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 14, background: '#fff', opacity: selectedClass ? 1 : .5 }}>
            <option value="">— Select subject —</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="auto" checked={autoScan} onChange={e => setAutoScan(e.target.checked)} style={{ width: 16, height: 16 }} />
          <label htmlFor="auto" style={{ fontSize: 13 }}>Auto-scan mode (camera scans every 2.5 seconds automatically)</label>
        </div>
        <button onClick={startSession} disabled={!selectedClass || !selectedSubject}
          style={{ padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: (!selectedClass || !selectedSubject) ? .5 : 1 }}>
          Start Attendance Session →
        </button>
      </div>
    </div>
  )

  if (step === 'live') return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{session.class_name} — {session.subject}</h1>
          <p style={{ color: '#78716c', fontSize: 13 }}>By {session.teacher_name} · {new Date().toLocaleDateString()}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoScan} onChange={e => setAutoScan(e.target.checked)} style={{ width: 16, height: 16 }} />
            Auto-scan
          </label>
          <button onClick={endSession} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            ⏹ End Session
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div>
          {/* Progress */}
          <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Present</span>
              <span style={{ color: '#78716c' }}>{progress.present} / {progress.total}</span>
            </div>
            <div style={{ height: 8, background: '#f0ede9', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,#4f46e5,#16a34a)', borderRadius: 4, transition: 'width .5s' }} />
            </div>
          </div>

          {/* Camera */}
          <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: 180, height: 230, border: `3px solid ${autoScan ? '#4ade80' : 'rgba(99,102,241,.6)'}`, borderRadius: '50%', boxShadow: '0 0 0 2000px rgba(0,0,0,.2)', transition: 'border-color .3s' }} />
            </div>
            {autoScan && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: '#4ade80', color: '#14532d', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#14532d', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                Auto-scanning
              </div>
            )}
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
          </div>

          {!autoScan && (
            <button onClick={captureAndMark} disabled={scanning}
              style={{ width: '100%', marginTop: 12, padding: 13, background: scanning ? '#e0e7ff' : '#4f46e5', color: scanning ? '#4f46e5' : '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: scanning ? 'wait' : 'pointer' }}>
              {scanning ? '⏳ Scanning…' : '📸 Scan Face'}
            </button>
          )}

          {lastResult && (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: lastResult.matched ? '#f0fdf4' : '#fef2f2', border: `1px solid ${lastResult.matched ? '#bbf7d0' : '#fecaca'}`, color: lastResult.matched ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {lastResult.message || (lastResult.matched ? '✅ Marked present' : '❌ Not recognized')}
            </div>
          )}
        </div>

        {/* Live feed */}
        <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0ede9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Live Feed</span>
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {feed.length === 0 && <div style={{ padding: '32px 16px', textAlign: 'center', color: '#a8a29e', fontSize: 13 }}>Waiting for scans…</div>}
            {feed.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #fafaf9' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {f.full_name?.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.full_name}</div>
                  <div style={{ fontSize: 11, color: '#78716c' }}>{f.student_id} · {f.confidence}%</div>
                </div>
                <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 560 }}>
      <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Session Complete</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '20px 0' }}>
          {[['Present', lastResult?.present, '#16a34a', '#f0fdf4'], ['Absent', lastResult?.absent, '#dc2626', '#fef2f2'], ['Total', lastResult?.total, '#2563eb', '#eff6ff']].map(([l, v, c, bg]) => (
            <div key={l} style={{ background: bg, padding: '14px 10px', borderRadius: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: 12, color: c }}>{l}</div>
            </div>
          ))}
        </div>
        <p style={{ color: '#78716c', fontSize: 13, marginBottom: 20 }}>Absence alerts have been sent to parents.</p>
        <button onClick={() => { setStep('setup'); setFeed([]); setSession(null); setLastResult(null) }}
          style={{ padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          Start New Session
        </button>
      </div>
    </div>
  )
}