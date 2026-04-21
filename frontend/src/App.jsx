import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './pages/Dashboard'
import MarkAttendance from './pages/MarkAttendance'
import Employees from './pages/Employees'
import Students from './pages/Students'
import { Records, Summary } from './pages/RecordsAndSummary'
import Login from './pages/Login'
import FaceEnroll from './pages/FaceEnroll'
import ClassAttendance from './pages/ClassAttendance'
import ClassesSettings from './pages/ClassesSettings'
import StudentPortal from './pages/StudentPortal'
import Users from './pages/Users'
import { api, createWebSocket } from './api'

function MainApp() {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('aa_user')
    return u ? JSON.parse(u) : null
  })
  const [checkedIn, setCheckedIn] = useState(0)

  const handleLogin = (userData) => setUser(userData)
  const handleLogout = () => {
    localStorage.removeItem('aa_token')
    localStorage.removeItem('aa_user')
    setUser(null)
  }

  useEffect(() => {
    if (!user) return
    api.getDashboard().then(s => setCheckedIn(s.checked_in_now)).catch(() => {})
    const ws = createWebSocket((msg) => {
      if (msg.event === 'attendance')
        api.getDashboard().then(s => setCheckedIn(s.checked_in_now)).catch(() => {})
    })
    return () => ws.close()
  }, [user])

  if (!user) return <Login onLogin={handleLogin} />

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar liveCount={checkedIn} onLogout={handleLogout} user={user} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Topbar user={user} onLogout={handleLogout} />
          <main style={{ flex: 1, overflowY: 'auto' }}>
            <Routes>
              <Route path="/"               element={<Dashboard />} />
              <Route path="/mark"           element={<MarkAttendance />} />
              <Route path="/attendance"     element={<ClassAttendance />} />
              <Route path="/enroll"         element={<FaceEnroll />} />
              <Route path="/employees"      element={<Employees />} />
              <Route path="/students"       element={<Students />} />
              <Route path="/student-portal" element={<StudentPortal />} />
              <Route path="/records"        element={<Records />} />
              <Route path="/summary"        element={<Summary />} />
              <Route path="/classes"        element={<ClassesSettings />} />
              <Route path="/users"          element={<Users />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ThemeProvider>
  )
}