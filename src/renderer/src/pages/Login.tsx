import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck, BarChart3, Package2, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../lib/utils'
import logo from '../assets/logo.png'

export default function Login(): JSX.Element {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-gray-950 transition-colors duration-200">
      {/* Left Panel — Brand (always dark navy, no dark: needed) */}
      <div
        className="hidden md:flex md:w-2/5 lg:w-[38%] flex-col justify-between p-12 xl:p-12"
        style={{ background: 'linear-gradient(160deg, #0A2040 0%, #0D2B52 60%, #1060C0 100%)' }}
      >
        {/* Brand text */}
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-semibold text-white tracking-tight">PharmaTracker</span>
        </div>

        {/* Center content */}
        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-semibold text-white leading-tight">
              Inventory<br />Management<br />System
            </h1>
            <p className="text-sm text-blue-200/80 leading-relaxed max-w-[260px]">
              Real-time stock monitoring, vendor tracking, and supply chain visibility for healthcare.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: ShieldCheck, text: 'Secure access control' },
              { icon: BarChart3, text: 'Live inventory analytics' },
              { icon: Package2, text: 'Multi-vendor tracking' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 border border-white/15">
                  <Icon className="h-3.5 w-3.5 text-blue-200" />
                </div>
                <span className="text-sm text-blue-100/90">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-blue-300/50">
          &copy; {new Date().getFullYear()} Gauciv. All rights reserved.
        </p>
      </div>

      {/* Right Panel — Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="w-full max-w-[360px] space-y-6">
          {/* Logo + Heading */}
          <div className="flex flex-col items-center text-center space-y-4">
            <img src={logo} alt="PharmaTracker" className="h-56 w-auto object-contain" />
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-charcoal-900 dark:text-gray-50 tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <p className="text-xs font-medium text-destructive">{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-charcoal-700 dark:text-gray-300">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                className="h-10 bg-white dark:bg-gray-800 border-silver-300 dark:border-gray-700 focus-visible:ring-brand text-sm"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-charcoal-700 dark:text-gray-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="h-10 bg-white dark:bg-gray-800 border-silver-300 dark:border-gray-700 focus-visible:ring-brand text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full h-10 text-sm font-semibold',
                loading ? 'opacity-80 cursor-not-allowed' : ''
              )}
              style={{ backgroundColor: '#1060C0' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Info */}
          <p className="text-center text-xs text-muted-foreground">
            Account access is managed by your system administrator.
          </p>
        </div>
      </div>
    </div>
  )
}