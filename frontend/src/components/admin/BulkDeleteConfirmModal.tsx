import { useState } from 'react'
import Modal from '@/components/common/Modal'
import Icon from '@/components/admin/icons'

interface BulkDeleteConfirmModalProps {
  count: number
  onClose: () => void
  onConfirm: (confirmText: string, totpCode: string) => void
  isSubmitting: boolean
  isHardDelete: boolean
}

export default function BulkDeleteConfirmModal({
  count,
  onClose,
  onConfirm,
  isSubmitting,
  isHardDelete
}: BulkDeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [totpCode, setTotpCode] = useState('')

  const expectedText = isHardDelete ? 'XOA-VINH-VIEN' : 'XOA-TAI-KHOAN'
  const isValid = confirmText === expectedText && totpCode.length === 6

  return (
    <Modal isOpen={true} title={isHardDelete ? "Xác nhận Xóa Vĩnh Viễn" : "Xác nhận Xóa Người Dùng"} onClose={onClose} size="md">
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 mb-6">
          <Icon name="ban" className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{isHardDelete ? "Cảnh báo xóa vĩnh viễn!" : "Cảnh báo xóa tài khoản!"}</p>
            <p className="text-sm mt-1">
              Bạn đang yêu cầu xóa {isHardDelete ? "vĩnh viễn" : ""} <strong>{count}</strong> người dùng đã chọn. Hành động này được bảo vệ bởi xác thực 2 lớp.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nhập chữ <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{expectedText}</span> để xác nhận:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              placeholder={expectedText}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mã Google Authenticator (Lớp 2)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Mở ứng dụng Google Authenticator và nhập mã 6 số của tài khoản Admin.
            </p>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-xl tracking-[0.5em] text-center font-mono"
              placeholder="000000"
              disabled={isSubmitting}
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
            onClick={() => onConfirm(confirmText, totpCode)}
            disabled={!isValid || isSubmitting}
            className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Icon name="spinner" className="w-5 h-5 animate-spin" /> : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
