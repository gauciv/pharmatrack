import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  AuthError
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function login(email: string, password: string): Promise<void> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase is not configured. Copy .env.example to .env and fill in your Firebase project credentials.')
    }
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      const authError = error as AuthError
      throw new Error(getAuthErrorMessage(authError.code))
    }
  }

  async function logout(): Promise<void> {
    await signOut(auth)
  }

  useEffect(() => {
    // If Firebase is not configured with real credentials, skip auth entirely
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }

    let settled = false

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        settled = true
        setCurrentUser(user)
        setLoading(false)
      },
      () => {
        // onError - Firebase connection failed
        settled = true
        setLoading(false)
      }
    )

    // Safety timeout: if Firebase never responds within 5 s, unblock the UI
    const timeout = setTimeout(() => {
      if (!settled) setLoading(false)
    }, 5000)

    return () => {
      unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.'
    default:
      return 'An error occurred. Please try again.'
  }
}
