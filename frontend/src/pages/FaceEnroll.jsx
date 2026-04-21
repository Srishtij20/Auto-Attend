import React, { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../api'

const ANGLES = [
  { id: 'front',      label: 'Look straight ahead',     icon: '😐', hint: 'Face the camera directly' },
  { id: 'left',       label: 'Turn slightly left',       icon: '👈', hint: 'About 30° to your left' },
  { id: 'right',      label: 'Turn slightly right',      icon: '👉', hint: 'About 30° to your right' },
  { id: 'up',         label: 'Tilt slightly up',         icon: '☝️', hint: 'Chin up a little' },
  { id: 'down',       label: 'Tilt slightly down',       icon: '👇', hint: 'Chin down a little' },
  { id: 'front2',     label: 'Straight ahead again',     icon: '😊', hint: 'Natural expression' },
  { id: 'left2',      label: 'Turn left more',           icon: '⬅️', hint: 'A bit further left' },
  { id: 'right2',     label: 'Turn right more',          icon: '➡️', hint: 'A bit further right' },
]

export default function FaceEnroll() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [employees, setEmployees] = useState([])
  const [selectedEmp, setSelectedEmp] = useState('')
  const [step, setStep] = useState('select') // select | guide | done
  const [currentAngle, setCurrentAngle] = useState(0)
  const [captured, setCaptured] = useState([]) // array of blobs
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [countdown, setCountdown] = useState(null)
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState('')
  const [autoMode, setAutoMode] = useState(false)
  const autoRef = useRef(null)
  const [mode, setMode] = useState('employee') // 'employee' | 'student'
  const [students, setStudents] = useState([])

  // Load employees
  useEffect(() => {
    api.getEmployees({ limit: 200 })
      .then(d => setEmployees(d.items || d))
      .catch(() => {})
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (e) {
      setError('Camera access denied. Please allow camera and reload.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    if (step === 'guide') startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [step, startCamera, stopCamera])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))
  }, [])

  const doCapture = useCallback(async () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 200)
    const blob = await captureFrame()
    if (!blob) return
    const newCaptured = [...captured, blob]
    setCaptured(newCaptured)
    if (currentAngle + 1 >= ANGLES.length) {
      stopCamera()
      setStep('confirm')
    } else {
      setCurrentAngle(a => a + 1)
    }
  }, [captured, currentAngle, captureFrame, stopCamera])

  const startCountdown = useCallback(() => {
    let c = 3
    setCountdown(c)
    const t = setInterval(() => {
      c--
      if (c <= 0) {
        clearInterval(t)
        setCountdown(null)
        doCapture()
      } else {
        setCountdown(c)
      }
    }, 1000)
  }, [doCapture])

  // Auto mode — captures every 2s automatically
  useEffect(() => {
    if (autoMode && step === 'guide') {
      autoRef.current = setTimeout(() => startCountdown(), 2000)
    }
    return () => clearTimeout(autoRef.current)
  }, [autoMode, step, currentAngle, startCountdown])

  const uploadAll = async () => {
    setUploading(true)
    setUploadProgress(0)
    let success = 0
    for (let i = 0; i < captured.length; i++) {
      try {
        const file = new File([captured[i]], `angle_${i}.jpg`, { type: 'image/jpeg' })
        await api.addPhoto(selectedEmp, file)
        success++
      } catch (e) { /* skip duplicates */ }
      setUploadProgress(Math.round(((i + 1) / captured.length) * 100))
    }
    setUploading(false)
    setStep('done')
    setCaptured([])
    setCurrentAngle(0)
  }

  const reset = () => {
    setCaptured([])
    setCurrentAngle(0)
    setStep('select')
    setError('')
    setAutoMode(false)
  }

  const pct = Math.round((currentAngle / ANGLES.length) * 100)

  // ── Step: Select Employee ──────────────────────────────
  if (step === 'select') return (
    <div style={{ padding: '32px', maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Face Enrollment</h1>
      <p style={{ color: '#78716c', marginBottom: 28 }}>
        Capture photos from multiple angles — like Face ID — for reliable recognition in any position.
      </p>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}
      <div style={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#78716c', marginBottom: 8 }}>Select Employee</label>
        <select
          value={selectedEmp}
          onChange={e => setSelectedEmp(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 14, background: '#fff', marginBottom: 20 }}
        >
          <option value="">— Choose an employee —</option>
          {employees.map(e => (
            <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id})</option>
          ))}
        </select>

        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: 6 }}>📋 How it works</div>
          <div style={{ color: '#0c4a6e', lineHeight: 1.6 }}>
            You'll capture <strong>{ANGLES.length} photos</strong> from different angles.<br/>
            Follow the on-screen guide for each position.<br/>
            More angles = better recognition accuracy.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
          <input
            type="checkbox"
            id="auto"
            checked={autoMode}
            onChange={e => setAutoMode(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="auto" style={{ fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            <strong>Auto-capture mode</strong> — automatically captures each angle every 2 seconds
          </label>
        </div>

        <button
          onClick={() => { if (!selectedEmp) { setError('Please select an employee first'); return; } setError(''); setStep('guide') }}
          style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
        >
          Start Face Enrollment →
        </button>
      </div>
    </div>
  )

  // ── Step: Guide ────────────────────────────────────────
  if (step === 'guide') {
    const angle = ANGLES[currentAngle]
    return (
      <div style={{ padding: '28px 32px', maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Capturing angles</h1>
            <p style={{ color: '#78716c', fontSize: 13 }}>
              Photo {currentAngle + 1} of {ANGLES.length}
            </p>
          </div>
          <button onClick={reset} style={{ padding: '7px 14px', border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, background: '#f0ede9', borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,#4f46e5,#7c3aed)', borderRadius: 3, transition: 'width .4s ease' }} />
        </div>

        {/* Angle indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {ANGLES.map((a, i) => (
            <div key={a.id} style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              background: i < currentAngle ? '#4f46e5' : i === currentAngle ? '#e0e7ff' : '#f5f5f4',
              border: i === currentAngle ? '2px solid #4f46e5' : '2px solid transparent',
              transition: 'all .3s'
            }}>
              {i < currentAngle ? '✓' : a.icon}
            </div>
          ))}
        </div>

        {/* Camera */}
        <div style={{ position: 'relative', background: '#0f0e17', borderRadius: 16, overflow: 'hidden', aspectRatio: '4/3', marginBottom: 16 }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Flash overlay */}
          {flash && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', transition: 'opacity .1s' }} />}

          {/* Face oval guide */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{
              width: 200, height: 260, border: '3px solid rgba(79,70,229,.7)', borderRadius: '50%',
              boxShadow: '0 0 0 2000px rgba(0,0,0,.25)',
              animation: countdown ? 'pulse 1s ease infinite' : 'none'
            }} />
          </div>

          {/* Countdown */}
          {countdown && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 80, fontWeight: 900, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,.5)', lineHeight: 1 }}>{countdown}</div>
            </div>
          )}

          {/* Instruction overlay */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.7))', padding: '24px 20px 16px' }}>
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{angle.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{angle.label}</div>
              <div style={{ fontSize: 13, opacity: .8 }}>{angle.hint}</div>
            </div>
          </div>
        </div>

        <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 2000px rgba(0,0,0,.25),0 0 0 0 rgba(79,70,229,.4)}50%{box-shadow:0 0 0 2000px rgba(0,0,0,.25),0 0 0 12px rgba(79,70,229,0)}}`}</style>

        {/* Capture button */}
        {!autoMode && (
          <button
            onClick={countdown ? null : startCountdown}
            disabled={!!countdown}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: countdown ? '#e0e7ff' : '#4f46e5', color: countdown ? '#4f46e5' : '#fff',
              fontWeight: 700, fontSize: 16, cursor: countdown ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            {countdown ? `Capturing in ${countdown}…` : `📸 Capture — ${angle.label}`}
          </button>
        )}
        {autoMode && (
          <div style={{ textAlign: 'center', padding: 14, background: '#f0f9ff', borderRadius: 12, color: '#0369a1', fontWeight: 600 }}>
            🤖 Auto-capturing… {countdown ? `Taking photo in ${countdown}…` : 'Get in position'}
          </div>
        )}
      </div>
    )
  }

  // ── Step: Confirm ──────────────────────────────────────
  if (step === 'confirm') return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Review & Upload</h1>
      <p style={{ color: '#78716c', marginBottom: 20 }}>{captured.length} photos captured — review then upload to the database.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
        {captured.map((blob, i) => (
          <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '2px solid #e7e5e4' }}>
            <img src={URL.createObjectURL(blob)} alt={`angle ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, padding: '3px 6px', textAlign: 'center' }}>
              {ANGLES[i]?.label || `Angle ${i + 1}`}
            </div>
          </div>
        ))}
      </div>
      {uploading && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span>Uploading to database…</span><span>{uploadProgress}%</span>
          </div>
          <div style={{ height: 8, background: '#f0ede9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: uploadProgress + '%', background: '#4f46e5', borderRadius: 4, transition: 'width .3s' }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={reset} style={{ flex: 1, padding: 12, border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Retake</button>
        <button onClick={uploadAll} disabled={uploading} style={{ flex: 2, padding: 12, border: 'none', borderRadius: 8, background: '#4f46e5', color: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15 }}>
          {uploading ? 'Uploading…' : `✓ Save ${captured.length} Photos to Database`}
        </button>
      </div>
    </div>
  )

  // ── Step: Done ─────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', maxWidth: 560 }}>
      <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: '1px solid #e7e5e4', borderRadius: 16 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Enrollment Complete!</h2>
        <p style={{ color: '#78716c', marginBottom: 24 }}>
          Face data saved from <strong>{ANGLES.length} angles</strong>.<br/>
          This employee can now be recognized from any direction.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} style={{ padding: '10px 24px', border: 'none', borderRadius: 8, background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            Enroll Another
          </button>
          <button onClick={() => window.location.href = '/mark'} style={{ padding: '10px 24px', border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            Test Recognition →
          </button>
        </div>
      </div>
    </div>
  )
}