import { Terminal, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'

interface FirebaseSetupModalProps {
  open: boolean
}

export function FirebaseSetupModal({ open }: FirebaseSetupModalProps): JSX.Element {
  const steps = [
    'Go to console.firebase.google.com and open your project.',
    'Navigate to Project Settings → General → Your apps.',
    'Copy the SDK config values (apiKey, authDomain, projectId, etc.).',
    'Copy .env.example to .env in the project root.',
    'Paste your values into .env, then restart the app.',
  ]

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        // Prevent closing by clicking outside or pressing Escape
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-200">
              <Terminal className="h-4 w-4 text-amber-600" />
            </div>
            <DialogTitle className="text-base">Firebase not configured</DialogTitle>
          </div>
          <DialogDescription className="text-[13px] leading-relaxed">
            No Firebase credentials were found. The app cannot authenticate or load data until you
            connect it to a Firebase project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Setup steps
          </p>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-foreground/80 leading-snug">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2.5">
          <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
            # .env (project root)<br />
            VITE_FIREBASE_API_KEY=…<br />
            VITE_FIREBASE_AUTH_DOMAIN=…<br />
            VITE_FIREBASE_PROJECT_ID=…
          </p>
        </div>

        <a
          href="https://console.firebase.google.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Open Firebase Console
          <ExternalLink className="h-3 w-3" />
        </a>
      </DialogContent>
    </Dialog>
  )
}
