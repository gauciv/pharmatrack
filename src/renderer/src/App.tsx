import { useState, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { FirebaseSetupModal } from './components/FirebaseSetupModal'
import { SplashScreen } from './components/SplashScreen'
import { isFirebaseConfigured } from './lib/firebase'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import DashboardHome from './pages/DashboardHome'
import Inventory from './pages/Inventory'
import Transactions from './pages/Transactions'
import Forecast from './pages/Forecast'
import Vendors from './pages/Vendors'
import Settings from './pages/Settings'

function wrap(child: JSX.Element): JSX.Element {
  return (
    <ProtectedRoute>
      <DashboardLayout>{child}</DashboardLayout>
    </ProtectedRoute>
  )
}

function AppContent({ showSplash, hideSplash }: { showSplash: boolean; hideSplash: () => void }): JSX.Element {
  const { theme } = useTheme()

  return (
    <>
      {showSplash && <SplashScreen onFinished={hideSplash} />}
      <HashRouter>
        <FirebaseSetupModal open={!isFirebaseConfigured} />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={wrap(<DashboardHome />)} />
            <Route path="/dashboard/inventory" element={wrap(<Inventory />)} />
            <Route path="/dashboard/transactions" element={wrap(<Transactions />)} />
            <Route path="/dashboard/forecast" element={wrap(<Forecast />)} />
            <Route path="/dashboard/vendors" element={wrap(<Vendors />)} />
            <Route path="/dashboard/settings" element={wrap(<Settings />)} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </HashRouter>

      <Toaster
        position="top-right"
        richColors
        closeButton
        theme={theme}
      />
    </>
  )
}

function App(): JSX.Element {
  const [showSplash, setShowSplash] = useState(true)
  const hideSplash = useCallback(() => setShowSplash(false), [])

  return (
    <ThemeProvider>
      <AppContent showSplash={showSplash} hideSplash={hideSplash} />
    </ThemeProvider>
  )
}

export default App
