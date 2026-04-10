const BASE = '/api/v1'

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  getEmployees: (p = {}) => req('/employees?' + new URLSearchParams(p)),
  getEmployee:  (id) => req(`/employees/${id}`),
  createEmployee: (d) => req('/employees/', { method: 'POST', body: JSON.stringify(d) }),
  updateEmployee: (id, d) => req(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deactivateEmployee: (id) => req(`/employees/${id}`, { method: 'DELETE' }),
  getDepartments: () => req('/employees/meta/departments'),

  addPhoto: async (empId, file) => {
    const f = new FormData(); f.append('file', file)
    const r = await fetch(`${BASE}/employees/${empId}/photos`, { method: 'POST', body: f })
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Upload failed') }
    return r.json()
  },
  addPhotoBase64: async (empId, b64) => {
    const f = new FormData(); f.append('image_data', b64)
    const r = await fetch(`${BASE}/employees/${empId}/photos/base64`, { method: 'POST', body: f })
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Upload failed') }
    return r.json()
  },
  listPhotos:  (id) => req(`/employees/${id}/photos`),
  deletePhoto: (empId, photoId) => req(`/employees/${empId}/photos/${photoId}`, { method: 'DELETE' }),
  clearPhotos: (id) => req(`/employees/${id}/photos`, { method: 'DELETE' }),
  photoUrl:    (empId, photoId) => `${BASE}/employees/${empId}/photos/${photoId}`,

  markAttendance: async (b64, opts = {}) => {
    const f = new FormData()
    f.append('image_data', b64)
    if (opts.location) f.append('location', opts.location)
    const r = await fetch(`${BASE}/attendance/mark`, { method: 'POST', body: f })
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Failed') }
    return r.json()
  },
  getRecords:       (p = {}) => req('/attendance/records?' + new URLSearchParams(p)),
  getSummary:       (date) => req(`/attendance/summary${date ? '?date=' + date : ''}`),
  getDashboard:     () => req('/attendance/dashboard'),
  getEmployeeToday: (id) => req(`/attendance/employee/${id}/today`),
}

export function createWebSocket(onMessage) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/api/v1/attendance/ws/live`)
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch {} }
  ws.onerror = () => {}
  return ws
}