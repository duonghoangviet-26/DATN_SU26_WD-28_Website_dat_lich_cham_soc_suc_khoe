import { Fragment } from 'react'
import Icon from '@/components/admin/icons'
import { formatDateTime } from '@/utils/format'

interface AuditLog {
  id: string
  thoi_gian: string
  hanh_dong: string
  nguoi_thay_doi: string
  mo_ta: string
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  logs: AuditLog[]
  loading: boolean
}

// Hàm format nhãn hành động cho thân thiện
function getActionLabel(action: string) {
  const map: Record<string, { text: string; color: string; icon: string }> = {
    CREATE_CLINIC_INFO: { text: 'Tạo chi nhánh', color: 'bg-green-100 text-green-700', icon: 'plus' },
    UPDATE_CLINIC_INFO: { text: 'Cập nhật', color: 'bg-blue-100 text-blue-700', icon: 'edit' },
    HIDE_CLINIC_INFO: { text: 'Ngừng HĐ', color: 'bg-red-100 text-red-700', icon: 'trash' },
    CREATE_SPECIALTY: { text: 'Thêm chuyên khoa', color: 'bg-green-100 text-green-700', icon: 'plus' },
    UPDATE_SPECIALTY: { text: 'Cập nhật CK', color: 'bg-blue-100 text-blue-700', icon: 'edit' },
    SHOW_SPECIALTY: { text: 'Hiện CK', color: 'bg-emerald-100 text-emerald-700', icon: 'eye' },
    HIDE_SPECIALTY: { text: 'Ẩn CK', color: 'bg-orange-100 text-orange-700', icon: 'eye-off' },
  }
  return map[action] || { text: action, color: 'bg-slate-100 text-slate-700', icon: 'info' }
}

export default function ClinicAuditLogModal({ open, onClose, title, logs, loading }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800">
            Lịch sử: {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Icon name="refresh-cw" className="h-6 w-6 animate-spin" />
              <span className="ml-2">Đang tải lịch sử...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              Chưa có lịch sử chỉnh sửa nào.
            </div>
          ) : (
            <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6">
              {logs.map((log) => {
                const actionInfo = getActionLabel(log.hanh_dong)
                return (
                  <div key={log.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[35px] mt-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 ring-4 ring-white">
                      <div className={`h-2 w-2 rounded-full ${actionInfo.color.split(' ')[0].replace('100', '500')}`} />
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${actionInfo.color}`}>
                          {actionInfo.text}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {formatDateTime(log.thoi_gian)}
                        </span>
                      </div>
                      
                      <p className="text-sm font-medium text-slate-800">
                        {log.mo_ta || 'Không có mô tả'}
                      </p>
                      
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <Icon name="user" className="h-3.5 w-3.5" />
                        Thực hiện bởi: <strong className="text-slate-700">{log.nguoi_thay_doi}</strong>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 text-right rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
