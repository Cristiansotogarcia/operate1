import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { loginSchema } from '@/lib/schemas'
import toast from 'react-hot-toast'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      toast.error(result.error.errors[0].message)
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      navigate('/')
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/auth/reset`,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password reset email sent. Check your inbox.')
      setResetMode(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #164e63 50%, #0f172a 100%)' }}
    >
      {/* Background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute bottom-10 right-10 w-64 h-64 rounded-full bg-white/5" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <img src="/logo.svg" alt="Operate1" className="h-12 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {resetMode ? 'Reset your password' : 'Sign in to continue'}
            </p>
          </div>

          {!resetMode ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="text-sm text-cyan-600 hover:text-cyan-700"
                >
                  Forgot your password?
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => setResetMode(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>

        {/* Agent download */}
        <div className="mt-6 bg-white/10 backdrop-blur rounded-xl p-4 text-center">
          <p className="text-white/80 text-sm font-medium mb-1">Operate1 Monitoring Agent</p>
          <p className="text-white/50 text-xs mb-3">Install on any PC or server to start monitoring</p>
          <a
            href="https://github.com/Cristiansotogarcia/operate1/releases/latest/download/Operate1.Setup.1.0.2.exe"
            className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download for Windows
          </a>
          <p className="text-white/40 text-[10px] mt-2">v1.0.2 — 78 MB</p>
        </div>

        <p className="text-center text-xs text-white/50 mt-4">Operate1 v1.1.5</p>
      </div>
    </div>
  )
}
