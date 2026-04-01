// Account Settings — password change + 2FA (TOTP via Supabase Auth)
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Shield, Key, CheckCircle, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'
import { z } from 'zod'

const pwSchema = z.object({
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type TotpFactor = { id: string; status: 'verified' | 'unverified'; totp?: { qr_code: string; secret: string; uri: string } | null }

export function AccountPage() {
  const { profile } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  // 2FA state
  const [mfaFactors, setMfaFactors] = useState<TotpFactor[]>([])
  const [mfaLoading, setMfaLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [unenrolling, setUnenrolling] = useState(false)

  useEffect(() => { fetchFactors() }, [])

  async function fetchFactors() {
    setMfaLoading(true)
    const { data } = await supabase.auth.mfa.listFactors()
    setMfaFactors((data?.totp ?? []) as TotpFactor[])
    setMfaLoading(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setConfirmError('')
    const parsed = pwSchema.safeParse({ password, confirm })
    if (!parsed.success) {
      parsed.error.errors.forEach(err => {
        if (err.path[0] === 'password') setPwError(err.message)
        if (err.path[0] === 'confirm') setConfirmError(err.message)
      })
      return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPw(false)
    if (error) { toast.error(error.message); return }
    setPassword('')
    setConfirm('')
    toast.success('Password updated')
  }

  async function startEnroll() {
    setEnrolling(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' })
    setEnrolling(false)
    if (error || !data) { toast.error(error?.message ?? 'Enrollment failed'); return }
    setEnrollData({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function verifyEnroll() {
    if (!enrollData || !verifyCode) return
    setVerifying(true)
    const challengeResp = await supabase.auth.mfa.challenge({ factorId: enrollData.id })
    if (challengeResp.error) { toast.error(challengeResp.error.message); setVerifying(false); return }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: challengeResp.data.id,
      code: verifyCode,
    })
    setVerifying(false)
    if (error) { toast.error('Invalid code — please try again'); return }
    toast.success('2FA enabled!')
    setEnrollData(null)
    setVerifyCode('')
    fetchFactors()
  }

  async function unenroll(factorId: string) {
    setUnenrolling(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setUnenrolling(false)
    if (error) { toast.error(error.message); return }
    toast.success('2FA removed')
    fetchFactors()
  }

  const verifiedFactor = mfaFactors.find(f => f.status === 'verified')
  const is2FAEnabled = !!verifiedFactor

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Account Settings" subtitle="Manage your password and security settings" />

      {/* Password change */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              error={pwError}
            />
          </div>
          <div>
            <Input
              label="Confirm Password"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
              error={confirmError}
            />
          </div>
          <Button type="submit" loading={savingPw} disabled={!password}>
            Update Password
          </Button>
        </form>
      </div>

      {/* 2FA / TOTP */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">Two-Factor Authentication (2FA)</h2>
          </div>
          {!mfaLoading && (
            <Badge variant={is2FAEnabled ? 'success' : 'gray'}>
              {is2FAEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          )}
        </div>

        {mfaLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : is2FAEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <CheckCircle size={16} />
              <span>2FA is active. Your account is protected with an authenticator app.</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => unenroll(verifiedFactor!.id)}
              disabled={unenrolling}
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
            >
              {unenrolling ? 'Removing…' : 'Remove 2FA'}
            </Button>
          </div>
        ) : enrollData ? (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to verify.
            </p>
            <div className="flex justify-center">
              <div className="bg-white border border-gray-200 rounded-lg p-3 inline-block">
                <QrCode size={24} className="text-gray-400 mx-auto mb-2" />
                <img src={enrollData.qr} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Or enter the secret manually:</p>
              <code className="text-xs font-mono text-gray-700 break-all">{enrollData.secret}</code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <Button onClick={verifyEnroll} loading={verifying} disabled={verifyCode.length !== 6}>
                  Verify & Enable
                </Button>
              </div>
            </div>
            <button onClick={() => setEnrollData(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Add an extra layer of security to your account. You'll be asked for a code from your authenticator app when signing in.
            </p>
            <Button onClick={startEnroll} disabled={enrolling}>
              {enrolling ? 'Setting up…' : 'Enable 2FA'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
