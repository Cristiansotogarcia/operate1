import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { Plus, Key, Copy, Check, Trash2, EyeOff } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { ApiKey } from '@operate1/types'
import toast from 'react-hot-toast'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

// Generate a cryptographically random API key in the browser
function generateApiKey(): string {
  const prefix = 'op1'
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  const body = Array.from(arr).map(b => chars[b % chars.length]).join('')
  return `${prefix}_${body}`
}

// Simple SHA-256 hash (browser SubtleCrypto)
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function ApiKeysPage() {
  const { profile } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [expiresIn, setExpiresIn] = useState<number | ''>('')
  const [creating, setCreating] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => { fetchKeys() }, [])

  async function fetchKeys() {
    setLoading(true)
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false })
    setKeys((data ?? []) as ApiKey[])
    setLoading(false)
  }

  async function createKey() {
    if (!keyName.trim()) return
    setCreating(true)
    const rawKey = generateApiKey()
    const hash = await sha256(rawKey)
    const prefix = rawKey.slice(0, 8)

    let expiresAt: string | null = null
    if (expiresIn) {
      const d = new Date()
      d.setDate(d.getDate() + Number(expiresIn))
      expiresAt = d.toISOString()
    }

    const { error } = await supabase.from('api_keys').insert({
      tenant_id: TENANT_ID,
      name: keyName.trim(),
      key_hash: hash,
      key_prefix: prefix,
      scopes: ['worker:register'],
      is_active: true,
      expires_at: expiresAt,
      created_by: profile?.id,
    })
    setCreating(false)
    if (error) { toast.error(error.message); return }
    setNewKeyValue(rawKey)
    setKeyName('')
    setExpiresIn('')
    fetchKeys()
  }

  function copyKey() {
    if (!newKeyValue) return
    navigator.clipboard.writeText(newKeyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  async function revokeKey() {
    if (!revokeTarget) return
    setRevoking(true)
    await supabase.from('api_keys')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', revokeTarget.id)
    setRevoking(false)
    setRevokeTarget(null)
    fetchKeys()
    toast.success('Key revoked')
  }

  function closeModal() {
    setModalOpen(false)
    setNewKeyValue(null)
    setKeyName('')
    setExpiresIn('')
    setCopied(false)
  }

  if (loading) return (
    <div className="p-6">
      <div className="animate-pulse h-8 w-48 bg-gray-200 rounded mb-6" />
    </div>
  )

  return (
    <div className="p-6">
      <PageHeader
        title="API Keys"
        subtitle="Manage worker registration keys for device onboarding"
        actions={<Button onClick={() => setModalOpen(true)}><Plus size={16} className="mr-1" />New Key</Button>}
      />

      {keys.length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create API keys so worker agents can register new devices."
          action={<Button onClick={() => setModalOpen(true)}><Plus size={16} className="mr-1" />New Key</Button>}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Prefix</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Scopes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Last Used</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">{k.key_prefix}…</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {k.scopes.map(s => (
                        <Badge key={s} variant="gray" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={k.is_active ? 'success' : 'danger'}>{k.is_active ? 'Active' : 'Revoked'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {k.last_used_at ? formatDateTime(k.last_used_at) : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {k.expires_at ? formatDateTime(k.expires_at) : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    {k.is_active && (
                      <button
                        onClick={() => setRevokeTarget(k)}
                        className="text-gray-400 hover:text-red-500"
                        title="Revoke key"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Create API Key"
        size="md"
        footer={
          newKeyValue ? (
            <Button onClick={closeModal}>Done — I've saved my key</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button onClick={createKey} disabled={creating || !keyName.trim()}>
                {creating ? 'Creating…' : 'Create Key'}
              </Button>
            </>
          )
        }
      >
        {newKeyValue ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <EyeOff size={15} className="text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Copy this key — it won't be shown again</p>
              </div>
              <p className="text-xs text-amber-700">Store it securely. Once you close this dialog the raw key is gone.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-xs font-mono text-gray-800 break-all">
                {newKeyValue}
              </code>
              <button
                onClick={copyKey}
                className="shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Key Name"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              placeholder="e.g. Site A Onboarding Key"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires in (days)</label>
              <input
                type="number"
                min={1}
                value={expiresIn}
                onChange={e => setExpiresIn(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Leave blank = never"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <p className="text-xs text-gray-500">Keys are scoped to <code>worker:register</code> and allow agent registration only.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revokeKey}
        title="Revoke API Key"
        message={`Revoke "${revokeTarget?.name}"? Any worker using this key will be unable to re-register.`}
        confirmLabel="Revoke"
        loading={revoking}
      />
    </div>
  )
}
