import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import MarkAttendance from './pages/MarkAttendance'
import Employees from './pages/Employees'
import { Records, Summary } from './pages/RecordsAndSummary'
import { api, createWebSocket } from './api'

export default function App() {
  const [checkedIn, setCheckedIn] = useState(0)

  useEffect(() => {
    api.getDashboard().then(s => setCheckedIn(s.checked_in_now)).catch(() => {})
    const ws = createWebSocket((msg) => {
      if (msg.event === 'attendance')
        api.getDashboard().then(s => setCheckedIn(s.checked_in_now)).catch(() => {})
    })
    return () => ws.close()
  }, [])

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar liveCount={checkedIn} />
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/mark"      element={<MarkAttendance />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/records"   element={<Records />} />
            <Route path="/summary"   element={<Summary />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}