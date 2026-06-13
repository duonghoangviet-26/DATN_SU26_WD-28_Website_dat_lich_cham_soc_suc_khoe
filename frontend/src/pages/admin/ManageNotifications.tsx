import { useEffect, useState } from 'react'
import { notificationService } from '@/services/notification.service'
import type { NotificationItem, NotificationTarget } from '@/types'
import { NOTIFICATION_TARGET_LABEL } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'

const TARGET_COLOR: Record<NotificationTarget, 'gray' | 'blue' | 'green'> = {
  all: 'gray', user: 'blue', doctor: 'green',
}

export default function ManageNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const [tieu_de, setTieuDe] = useState('')
  const [noi_dung, setNoiDung] = useState('')
  const [doi_tuong, setDoiTuong] = useState<NotificationTarget>('all')
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)

  const [detail, setDetail] = useState<NotificationItem | null>(null)

  useEffect(() => {
    notificationService.getAll().then(setNotifications).finally(() => setLoading(false))
  }, [])

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSendError('')
    setSendSuccess(false)
    if (!tieu_de.trim() || !noi_dung.trim()) {
      setSendError('Vui lòng điền đầy đủ tiêu đề và nội dung.')
      return
    }
    setSending(true)
    try {
      const newItem = await notificationService.send({ tieu_de, noi_dung, doi_tuong })
      setNotifications((prev) => [newItem, ...prev])
      setTieuDe('')
      setNoiDung('')
      setDoiTuong('all')
      setSendSuccess(true)
      setTimeout(() => setSendSuccess(false), 3000)
    } catch {
      setSendError('Gửi thất bại, vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Thông báo hệ thống"
        description="Gửi thông báo đến người dùng và xem lịch sử các thông báo đã gửi."
      />

      {/* Form gửi thông báo mới */}
      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
            <Icon name="send" className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">Gửi thông báo mới</h2>
        </div>

        {sendError && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{sendError}</div>
        )}
        {sendSuccess && (
          <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Gửi thông báo thành công!
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tiêu đề</label>
              <input
                className="input"
                placeholder="Nhập tiêu đề thông báo..."
                value={tieu_de}
                onChange={(e) => setTieuDe(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Đối tượng nhận</label>
              <select className="input" value={doi_tuong} onChange={(e) => setDoiTuong(e.target.value as NotificationTarget)}>
                <option value="all">Tất cả người dùng</option>
                <option value="user">Bệnh nhân</option>
                <option value="doctor">Bác sĩ</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nội dung</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Nhập nội dung thông báo..."
              value={noi_dung}
              onChange={(e) => setNoiDung(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={sending}>
              <Icon name="send" className="h-4 w-4" />
              {sending ? 'Đang gửi...' : 'Gửi thông báo'}
            </button>
          </div>
        </form>
      </div>

      {/* Lịch sử thông báo */}
      <h2 className="mb-3 text-base font-semibold text-slate-700">Lịch sử đã gửi</h2>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="px-4 py-3 font-medium">Đối tượng</th>
                <th className="px-4 py-3 font-medium">Người nhận</th>
                <th className="px-4 py-3 font-medium">Thời gian gửi</th>
                <th className="px-4 py-3 text-right font-medium">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : notifications.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Chưa có thông báo nào.</td></tr>
              ) : notifications.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{n.tieu_de}</td>
                  <td className="px-4 py-3">
                    <Badge color={TARGET_COLOR[n.doi_tuong]}>
                      {NOTIFICATION_TARGET_LABEL[n.doi_tuong]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{n.so_nguoi_nhan.toLocaleString('vi-VN')} người</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(n.ngay_gui)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDetail(n)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 ml-auto"
                    >
                      <Icon name="eye" className="h-3 w-3" /> Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chi tiết thông báo */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800">{detail.tieu_de}</h3>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-700 shrink-0">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 flex gap-2">
              <Badge color={TARGET_COLOR[detail.doi_tuong]}>
                {NOTIFICATION_TARGET_LABEL[detail.doi_tuong]}
              </Badge>
              <span className="text-xs text-slate-400">{formatDateTime(detail.ngay_gui)}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{detail.noi_dung}</p>
            <p className="mt-3 text-xs text-slate-400">Đã gửi đến {detail.so_nguoi_nhan.toLocaleString('vi-VN')} người</p>
            <button onClick={() => setDetail(null)} className="btn-secondary mt-5 w-full">Đóng</button>
          </div>
        </div>
      )}
    </div>
  )
}
