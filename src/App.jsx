import { Link, Route, Routes, Navigate } from 'react-router-dom'
import StudentPage from './pages/StudentPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

export default function App() {
  return (
    <div className="container">
      <header className="header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h1>Closest Speaker System</h1>
          <p className="sub">Student (mic capture) · Admin (dashboard)</p>
        </div>
        <nav style={{display:'flex',gap:12}}>
          <Link to="/student"><button className="secondary">Student</button></Link>
          <Link to="/admin"><button className="secondary">Admin</button></Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/student" replace />} />
        <Route path="/student" element={<StudentPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  )
}
