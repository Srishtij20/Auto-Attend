const BASE = "/api/v1";

// -------------------------------
// 🔹 Core Request Function
// -------------------------------
async function req(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(BASE + path, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        detail: res.statusText,
      }));
      throw new Error(err.detail || "Request failed");
    }

    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw err;
  }
}

// -------------------------------
// 🔹 FormData Helper
// -------------------------------
async function reqForm(path, formData) {
  const res = await fetch(BASE + path, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({
      detail: res.statusText,
    }));
    throw new Error(err.detail || "Request failed");
  }

  return res.json();
}

// -------------------------------
// 🔹 Helper: Query Params Cleaner
// -------------------------------
function buildQuery(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  return new URLSearchParams(clean).toString();
}

// -------------------------------
// 🔹 API METHODS
// -------------------------------
export const api = {
  // 👤 Employees
  getEmployees: (p = {}) =>
    req(`/employees?${buildQuery(p)}`),

  getEmployee: (id) =>
    req(`/employees/${id}`),

  createEmployee: (data) =>
    req("/employees/", {
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
    const form = new FormData();
    form.append("image_data", b64);

    if (opts.location) form.append("location", opts.location);
    if (opts.device_id) form.append("device_id", opts.device_id);

    return reqForm("/attendance/mark", form);
  },

  getRecords: (p = {}) =>
    req(`/attendance/records?${buildQuery(p)}`),

  getSummary: (date) =>
    req(`/attendance/summary${date ? `?date=${date}` : ""}`),

  getDashboard: () =>
    req("/attendance/dashboard"),

  getEmployeeToday: (id) =>
    req(`/attendance/employee/${id}/today`),
};

// -------------------------------
// 🔹 WebSocket
// -------------------------------
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