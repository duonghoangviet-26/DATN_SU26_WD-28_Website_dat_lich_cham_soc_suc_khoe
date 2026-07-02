import { useState } from 'react'
import { doctorService } from '@/services/doctor.service'
import type { DoctorProfileAPI, DoctorDetailAPI } from '@/types'
import Icon from '@/components/admin/icons'

// HARDCODED ADMIN ID FOR NOW
const CURRENT_ADMIN_ID = "000000000000000000000099"

export type ActionType = 'approve' | 'reject' | 'suspend' | 'restore' | 'delete'

interface Props {
  target: DoctorProfileAPI | DoctorDetailAPI
  action: ActionType
  onClose: () => void
  onSuccess: () => void
}

export default function DoctorActionModal({ target, action, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const showReasonInput = action === 'reject' || action === 'suspend'

  async function handleConfirm() {
    setLoading(true)
    try {
      const id = target._id
      if (action === 'approve') await doctorService.approve(id, CURRENT_ADMIN_ID)
      else if (action === 'reject') await doctorService.reject(id, CURRENT_ADMIN_ID, reason)
      else if (action === 'suspend') await doctorService.suspend(id, CURRENT_ADMIN_ID, reason)
      else if (action === 'restore') await doctorService.restore(id, CURRENT_ADMIN_ID)
      else if (action === 'delete') await doctorService.delete(id)
      
      onSuccess()
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err)
      alert(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const ACTION_CONFIG = {
    approve:  { title: 'Duyệt hồ sơ bác sĩ', msg: `Xác nhận duyệt hồ sơ BS. "${target.user_id?.ho_ten}"?`, confirmText: 'Duyệt', danger: false, placeholder: '' },
    reject:   { title: 'Từ chối hồ sơ', msg: `Từ chối hồ sơ BS. "${target.user_id?.ho_ten}"?`, confirmText: 'Từ chối', danger: true, placeholder: 'Nhập lý do từ chối (bắt buộc)...' },
    suspend:  { title: 'Tạm ngưng bác sĩ', msg: `Tạm ngưng tài khoản BS. "${target.user_id?.ho_ten}"?`, confirmText: 'Tạm ngưng', danger: true, placeholder: 'Nhập lý do tạm ngưng (bắt buộc)...' },
    restore:  { title: 'Khôi phục bác sĩ', msg: `Khôi phục tài khoản BS. "${target.user_id?.ho_ten}"?`, confirmText: 'Khôi phục', danger: false, placeholder: '' },
    delete:   { title: 'Xóa vĩnh viễn', msg: `Xác nhận xóa vĩnh viễn hồ sơ BS. "${target.user_id?.ho_ten}"? Hành động này không thể hoàn tác!`, confirmText: 'Xóa vĩnh viễn', danger: true, placeholder: '' },
  }
  const cfg = ACTION_CONFIG[action]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl transform transition-transform">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          {cfg.danger && <Icon name="alert-triangle" className="w-5 h-5 text-red-500" />}
          {cfg.title}
        </h3>
        <p className="mt-2 text-sm text-slate-600">{cfg.msg}</p>
        
        {showReasonInput && (
          <textarea
            className="input mt-4 resize-none w-full bg-slate-50 border-slate-200 focus:bg-white"
            rows={3}
            placeholder={cfg.placeholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
        )}
        
        <div className="mt-6 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="btn-secondary"
            disabled={loading}
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (showReasonInput && !reason.trim())}
            className={cfg.danger ? 'btn-danger disabled:opacity-50 flex items-center gap-2' : 'btn-primary disabled:opacity-50 flex items-center gap-2'}
          >
            {loading && <Icon name="sync" className="w-4 h-4 animate-spin" />}
            {cfg.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
