import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { UndoProvider } from './lib/UndoContext'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Artikel from './pages/Artikel'
import Lieferanten from './pages/Lieferanten'
import Bestellungen from './pages/Bestellungen'
import Statistik from './pages/Statistik'
import Bestellt from './pages/Bestellt'
import Finanzen from './pages/Finanzen'
import Einstellungen from './pages/Einstellungen'
import Login from './pages/Login'
import UpdatePassword from './pages/UpdatePassword'
function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/update-password')
      }
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <UndoProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="artikel" element={<Artikel />} />
          <Route path="lieferanten" element={<Lieferanten />} />
          <Route path="bestellungen" element={<Bestellungen />} />
          <Route path="bestellt" element={<Bestellt />} />
          <Route path="statistik" element={<Statistik />} />
          <Route path="finanzen" element={<Finanzen />} />
          <Route path="einstellungen" element={<Einstellungen />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </UndoProvider>
  )
}
