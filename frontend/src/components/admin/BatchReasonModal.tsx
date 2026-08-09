import { useState } from 'react'
import Modal from '@/components/common/Modal'
import Icon from '@/components/admin/icons'

interface BatchReasonModalProps {
  action: 'lock' | 'delete' | 'restore'
  count: number
  onClose: () => void
  onConfirm: (reason: string) => void
  isSubmitting: boolean
}

export default function BatchReasonModal({
  action,
  count,
  onClose,
  onConfirm,
  isSubmitting
}: BatchReasonModalProps) {
  const [reason, setReason] = useState('')
  
  const actionNames: Record<string, string> = {
    lock: 'khóa',
    delete: 'xóa',
    restore: 'khôi phục'
  }

  const actionColors: Record<string, string> = {
    lock: 'text-yellow-600 bg-yellow-50',
    delete: 'text-red-600 bg-red-50',
    restore: 'text-green-600 bg-green-50'
  }

  const actionBtnColors: Record<string, string> = {
    lock: 'bg-yellow-600 hover:bg-yellow-700',
    delete: 'bg-red-600 hover:bg-red-700',
    restore: 'bg-green-600 hover:bg-green-700'
  }

  const actionIcons: Record<string, any> = {
    lock: 'ban',
    delete: 'trash',
    restore: 'check'
  }

  return (
    <Modal isOpen={true} title={`Xác nhận ${actionNames[action]} hàng loạt`} onClose={onClose} size="sm">
      <div className="p-6">
        <div className={`p-4 rounded-lg flex items-start gap-3 mb-6 ${actionColors[action]}`}>
          <Icon name={actionIcons[action]} className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Thao tác hàng loạt</p>
            <p className="text-sm mt-1">
              Bạn đang yêu cầu <strong>{actionNames[action]} {count}</strong> người dùng đã chọn.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nhập lý do {actionNames[action]} (không bắt buộc):
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={`Lý do ${actionNames[action]}...`}
              disabled={isSubmitting}
              rows={3}
            />
          </div>
        </div>

        <div className="flex w-full gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={isSubmitting}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${actionBtnColors[action]}`}
          >
            {isSubmitting ? <Icon name="spinner" className="w-5 h-5 animate-spin" /> : 'Xác nhận'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
