const BASE = "/api/v1";

// 🔹 Core Request Function
async function req(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const token = localStorage.getItem('aa_token')
  try {
    const res = await fetch(BASE + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    })
    clearTimeout(timeout)
    if (res.status === 401) {
      localStorage.removeItem('aa_token')
      localStorage.removeItem('aa_user')
      window.location.reload()
    }
    if (!res.ok) { const err = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(err.detail || 'Request failed') }
    return res.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timeout')
    throw err
  }
}

// 🔹 FormData Helper
async function reqForm(path, formData) {
  const token = localStorage.getItem('aa_token')
  const res = await fetch(BASE + path, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({
      detail: res.statusText,
    }));
    throw new Error(err.detail || "Request failed");
  }

  return res.json();
}

// 🔹 Helper: Query Params Cleaner
function buildQuery(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  return new URLSearchParams(clean).toString();
}

// 🔹 API METHODS
export const api = {
  // 👤 Employees
  getEmployees: (p = {}) =>
    req(`/employees?${buildQuery(p)}`),

  getEmployee: (id) =>
    req(`/employees/${id}`),

  createEmployee: (data) =>
    req("/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEmployee: (id, data) =>
    req(`/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deactivateEmployee: (id) =>
    req(`/employees/${id}`, { method: "DELETE" }),

  getDepartments: () =>
    req("/employees/meta/departments"),

  // Classes
getClasses: () => req('/classes'),
createClass: (data) => req('/classes', { method: 'POST', body: JSON.stringify(data) }),
updateSubjects: (className, subjects) => req(`/classes/${className}/subjects`, { method: 'PATCH', body: JSON.stringify(subjects) }),
deleteClass: (name) => req(`/classes/${name}`, { method: 'DELETE' }),

// Students
getStudents: (p = {}) => req(`/students?${new URLSearchParams(p).toString()}`),
getStudent: (id) => req(`/students/${id}`),
createStudent: (formData) => reqForm('/students', formData),
getStudentPerformance: (id) => req(`/students/${id}/performance`),
addStudentPhoto: async (studentId, file) => {
  const form = new FormData(); form.append('file', file);
  return reqForm(`/students/${studentId}/photos`, form);
},
getStudentAttendance: (id) => req(`/sessions/student/${id}/attendance`),

// Sessions
startSession: (formData) => reqForm('/sessions/start', formData),
markSessionAttendance: (sessionId, formData) => reqForm(`/sessions/${sessionId}/mark`, formData),
endSession: (sessionId) => req(`/sessions/${sessionId}/end`, { method: 'POST' }),
getSessions: (p = {}) => req(`/sessions?${new URLSearchParams(p).toString()}`),
getSession: (id) => req(`/sessions/${id}`),
correctAttendance: (sessionId, data) => req(`/sessions/${sessionId}/correct`, { method: 'POST', body: JSON.stringify(data) }),

  // 📸 Photos
  addPhoto: async (empId, file) => {
    const form = new FormData();
    form.append("file", file);
    return reqForm(`/employees/${empId}/photos`, form);
  },

  addPhotoBase64: async (empId, b64) => {
    const form = new FormData();
    form.append("image_data", b64);
    return reqForm(`/employees/${empId}/photos/base64`, form);
  },

  listPhotos: (id) =>
    req(`/employees/${id}/photos`),

  deletePhoto: (empId, photoId) =>
    req(`/employees/${empId}/photos/${photoId}`, { method: "DELETE" }),

  clearPhotos: (id) =>
    req(`/employees/${id}/photos`, { method: "DELETE" }),

  photoUrl: (empId, photoId) =>
    `${BASE}/employees/${empId}/photos/${photoId}`,

  // 📊 Attendance
  markAttendance: async (b64, opts = {}) => {
    return req("/attendance/mark", {
      method: "POST",
      body: JSON.stringify({
        image_data: b64,
        ...(opts.location ? { location: opts.location } : {}),
        ...(opts.device_id ? { device_id: opts.device_id } : {}),
      }),
    });
  },

  // Auth
  login: async (username, password) => {
    const form = new FormData()
    form.append('username', username)
    form.append('password', password)
    const res = await fetch(BASE + '/auth/login', { method: 'POST', body: form })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Login failed') }
    return res.json()
  },

  // Reports
  downloadReport: async (format, date) => {
    const token = localStorage.getItem('aa_token')
    const d = date || new Date().toISOString().slice(0, 10)
    const res = await fetch(`${BASE}/reports/daily/${format}?date=${d}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `attendance_${d}.${format === 'pdf' ? 'pdf' : 'xlsx'}`; a.click()
    URL.revokeObjectURL(url)
  },

  getRecords: (p = {}) =>
    req(`/attendance/records?${buildQuery(p)}`),

  getSummary: (date) =>
    req(`/attendance/summary${date ? `?date=${date}` : ""}`),

  getDashboard: () =>
    req("/attendance/dashboard"),

  getEmployeeToday: (id) =>
    req(`/attendance/employee/${id}/today`),

  // Users
  getUsers: () => req('/auth/users'),

  createUser: (data) => req('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// 🔹 WebSocket
export function createWebSocket(onMessage) {
  const proto = location.protocol === "https:" ? "wss" : "ws";

  const ws = new WebSocket(
    `${proto}://${location.host}/api/v1/attendance/ws/live`
  );

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (err) {
      console.warn("Invalid WS message");
    }
  };

  ws.onerror = () => {
    console.warn("WebSocket error");
  };

  return ws;
}
