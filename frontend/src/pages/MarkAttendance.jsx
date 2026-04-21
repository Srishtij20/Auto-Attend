import React, { useState, useRef } from 'react'
import { api } from '../api'
import { Button, Card, ConfidenceBar, Badge, Toast } from '../components/UI'

export default function MarkAttendance() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [location, setLocation] = useState('')

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      videoRef.current.srcObject = stream
      videoRef.current.play()
      setStreaming(true); setCaptured(null); setResult(null)
    } catch (e) { setToast({ msg: 'Camera access denied: ' + e.message, type: 'error' }) }
  }

  const stopCamera = () => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setStreaming(false)
  }

  const capture = () => {
    const canvas = canvasRef.current, video = videoRef.current
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    setCaptured(canvas.toDataURL('image/jpeg', 0.85))
    stopCamera()
  }

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setCaptured(ev.target.result); setResult(null) }
    reader.readAsDataURL(file)
  }

  const mark = async () => {
    if (!captured) return
    setLoading(true); setResult(null)
    try {
      const res = await api.markAttendance(captured, { location })
      setResult(res)
      if (res.success) setToast({ msg: `${res.employee_name} — ${res.attendance_type?.replace('_', ' ')} recorded!`, type: 'success' })
    } catch (e) { setToast({ msg: typeof e.message === 'string' ? e.message : 'Recognition failed', type: 'error' }) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Mark Attendance</h1>
        <p style={{ color: '#78716c', marginTop: 2 }}>Capture or upload a photo to mark attendance via face recognition</p>
      </div>

      <Card>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ede9' }}><span style={{ fontWeight: 600, fontSize: 14 }}>Face Capture</span></div>
        <div style={{ padding: 22 }}>
          <div style={{ width: '100%', aspectRatio: '4/3', maxHeight: 360, background: '#0f0e17', borderRadius: 10, overflow: 'hidden', position: 'relative', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: streaming ? 'block' : 'none' }} muted playsInline />
            {captured && <img src={captured} alt="captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            {!streaming && !captured && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#6366f1' }}><div style={{ fontSize: 48, opacity: .5 }}>👁</div><div style={{ fontSize: 13, color: '#a8a29e' }}>Camera preview will appear here</div></div>}
            {streaming && <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(99,102,241,.6)', borderRadius: 10, pointerEvents: 'none' }}><div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 180, height: 230, border: '2px solid rgba(99,102,241,.7)', borderRadius: '50%', pointerEvents: 'none' }} /></div>}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#78716c', marginBottom: 5 }}>Location (optional)</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Main Office" style={{ width: '100%', padding: '8px 12px', border: '1px solid #e7e5e4', borderRadius: 8, outline: 'none', fontSize: 13 }} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!streaming && !captured && <>
              <Button variant="primary" onClick={startCamera}>📷 Start Camera</Button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #e7e5e4', background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                📁 Upload Photo <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              </label>
            </>}
            {streaming && <><Button variant="primary" onClick={capture}>📸 Capture</Button><Button onClick={stopCamera}>Cancel</Button></>}
            {captured && !result && <><Button variant="primary" onClick={mark} loading={loading}>{loading ? 'Recognizing…' : '✓ Mark Attendance'}</Button><Button onClick={() => { setCaptured(null); setResult(null) }}>Retake</Button></>}
            {result && <Button variant="primary" onClick={() => { setCaptured(null); setResult(null) }}>Mark Another</Button>}
          </div>
        </div>
      </Card>

      {result && (
        <div style={{ marginTop: 20 }}>
          <Card>
            <div style={{ padding: '18px 22px' }}>
              {result.success ? (
                <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{result.employee_name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      <Badge color={result.attendance_type === 'check_in' ? 'green' : 'red'}>{result.attendance_type?.replace('_', ' ').toUpperCase()}</Badge>
                      <Badge color="gray">{result.employee_id}</Badge>
                      <Badge color="blue">{new Date(result.timestamp).toLocaleTimeString()}</Badge>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: '#78716c', marginBottom: 4 }}>Recognition confidence</div>
                      <ConfidenceBar value={result.confidence} />
                    </div>
                    <div style={{ fontSize: 12, color: '#78716c' }}>{result.message}</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✗</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#dc2626', marginBottom: 6 }}>Recognition Failed</div>
                    <div style={{ fontSize: 13, color: '#78716c' }}>{result.message}</div>
                    {result.confidence > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 12, color: '#78716c', marginBottom: 4 }}>Best match confidence</div><ConfidenceBar value={result.confidence} /></div>}
                    <div style={{ marginTop: 12, fontSize: 12, color: '#a8a29e' }}>Tips: ensure good lighting, face the camera directly, and make sure the employee has photos registered.</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}