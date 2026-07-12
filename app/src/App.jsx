import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UndoProvider } from './lib/UndoContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Artikel from './pages/Artikel'
import Lieferanten from './pages/Lieferanten'
import Bestellungen from './pages/Bestellungen'
import Statistik from './pages/Statistik'
import Bestellt from './pages/Bestellt'
import Einstellungen from './pages/Einstellungen'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem('lager_user')
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <UndoProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="artikel" element={<Artikel />} />
          <Route path="lieferanten" element={<Lieferanten />} />
          <Route path="bestellungen" element={<Bestellungen />} />
          <Route path="bestellt" element={<Bestellt />} />
          <Route path="statistik" element={<Statistik />} />
          <Route path="einstellungen" element={<Einstellungen />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </UndoProvider>
  )
}
