import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { FirebaseSetupModal } from './components/FirebaseSetupModal'
import { isFirebaseConfigured } from './lib/firebase'
import Login from './pages/Login'
import DashboardHome from './pages/DashboardHome'
import Inventory from './pages/Inventory'
import Forecast from './pages/Forecast'
import Vendors from './pages/Vendors'
import DataSync from './pages/DataSync'

function wrap(child: JSX.Element): JSX.Element {
  return (
    <ProtectedRoute>
      <DashboardLayout>{child}</DashboardLayout>
    </ProtectedRoute>
  )
}

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <FirebaseSetupModal open={!isFirebaseConfigured} />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={wrap(<DashboardHome />)} />
          <Route path="/dashboard/inventory" element={wrap(<Inventory />)} />
          <Route path="/dashboard/forecast" element={wrap(<Forecast />)} />
          <Route path="/dashboard/vendors" element={wrap(<Vendors />)} />
          <Route path="/dashboard/datasync" element={wrap(<DataSync />)} />
          <Route path="/dashboard/settings" element={wrap(
            <div className="p-6 text-sm text-muted-foreground">Settings — coming soon</div>
          )} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
