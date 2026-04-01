import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative w-full bg-white shadow-xl max-h-[90vh] flex flex-col',
        'rounded-t-xl sm:rounded-xl sm:mx-4',
        widths[size]
      )}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t bg-gray-50 rounded-b-xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', loading }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Deleting...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
