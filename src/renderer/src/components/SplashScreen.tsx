import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'

export function SplashScreen({ onFinished }: { onFinished: () => void }): JSX.Element | null {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1200)
    const removeTimer = setTimeout(() => onFinished(), 1700)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [onFinished])

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-5"
      style={{
        background: 'linear-gradient(160deg, #0A2040 0%, #0D2B52 60%, #1060C0 100%)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 500ms ease-out',
      }}
    >
      <img src={logo} alt="" className="h-96 w-96 object-contain animate-pulse" />
      <span className="text-lg font-semibold text-white tracking-tight">PharmaTracker</span>
    </div>
  )
}
