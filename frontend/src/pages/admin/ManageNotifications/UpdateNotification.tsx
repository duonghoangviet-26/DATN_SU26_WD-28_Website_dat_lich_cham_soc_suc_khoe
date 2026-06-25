import React, { useState } from 'react'
import { notificationService } from '@/services/notification.service'
import type { NotificationItemAPI, NotificationUpdatePayload } from '@/types'
import Icon from '@/components/admin/icons'

interface Props {
  notification: NotificationItemAPI
  onClose: () => void
  onSuccess: () => void
}

export default function UpdateNotification({ notification, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form states
  const [tieuDe, setTieuDe] = useState(notification.tieu_de)
  const [noiDung, setNoiDung] = useState(notification.noi_dung)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!tieuDe.trim() || !noiDung.trim()) {
      setError('Tiêu đề và nội dung không được để trống')
      return
    }

    setLoading(true)

    const payload: NotificationUpdatePayload = {
      tieu_de: tieuDe,
      noi_dung: noiDung,
    }

    try {
      await notificationService.update(notification._id, payload)
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Cập nhật thất bại')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden transform transition-all">
        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Icon name="edit" className="w-5 h-5 text-brand-600" />
            Sửa thông báo
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2">
              <Icon name="alert-triangle" className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tiêu đề thông báo</label>
              <input 
                type="text" 
                className="input w-full bg-slate-50 focus:bg-white transition-colors" 
                placeholder="Nhập tiêu đề..."
                value={tieuDe} 
                onChange={e => setTieuDe(e.target.value)} 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nội dung chi tiết</label>
              <textarea 
                rows={5} 
                className="input w-full bg-slate-50 focus:bg-white resize-none transition-colors" 
                placeholder="Nhập nội dung..."
                value={noiDung} 
                onChange={e => setNoiDung(e.target.value)} 
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs p-3 rounded-lg mt-2 flex items-start gap-2">
              <Icon name="info" className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
              <p>Lưu ý: Bạn chỉ có thể sửa Tiêu đề và Nội dung. Việc sửa thông báo không thay đổi đối tượng nhận hay gửi lại thông báo cho người dùng.</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary px-6">Hủy</button>
            <button type="submit" disabled={loading} className="btn-primary px-6 flex items-center gap-2">
              {loading && <Icon name="loader" className="w-4 h-4 animate-spin" />}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
