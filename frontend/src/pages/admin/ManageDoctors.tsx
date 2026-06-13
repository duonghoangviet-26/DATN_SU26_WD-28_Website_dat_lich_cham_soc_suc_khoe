import { useEffect, useState } from 'react'
import { doctorService } from '@/services/doctor.service'
import type { DoctorProfile, DoctorApproval } from '@/types'
import { DOCTOR_APPROVAL_LABEL } from '@/utils/constants'
import { formatPrice, formatDate } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'

const APPROVAL_COLOR: Record<DoctorApproval, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green', pending: 'yellow', rejected: 'red', suspended: 'gray',
}

const STATUS_TABS: { value: DoctorApproval | ''; label: string; color: string }[] = [
  { value: '', label: 'Tất cả', color: 'text-slate-600' },
  { value: 'pending', label: 'Chờ duyệt', color: 'text-yellow-600' },
  { value: 'approved', label: 'Đã duyệt', color: 'text-green-600' },
  { value: 'rejected', label: 'Từ chối', color: 'text-red-600' },
  { value: 'suspended', label: 'Tạm ngưng', color: 'text-slate-500' },
]

type Action = 'approve' | 'reject' | 'suspend' | 'restore'

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DoctorApproval | ''>('')

  const [target, setTarget] = useState<DoctorProfile | null>(null)
  const [action, setAction] = useState<Action>('approve')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    doctorService.getAll(activeTab).then((data) => {
      if (!ignore) setDoctors(data)
    }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [activeTab])

  function openAction(doc: DoctorProfile, act: Action) {
    setTarget(doc)
    setAction(act)
    setRejectReason('')
    setShowRejectInput(act === 'reject')
  }

  async function handleConfirm() {
    if (!target) return
    const id = target.id
    setTarget(null)
    let updated: DoctorProfile
    if (action === 'approve') updated = await doctorService.approve(id)
    else if (action === 'reject') updated = await doctorService.reject(id, rejectReason)
    else if (action === 'suspend') updated = await doctorService.suspend(id)
    else updated = await doctorService.restore(id)
    setDoctors((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
  }

  const counts = {
    pending: doctors.filter((d) => d.trang_thai_duyet === 'pending').length,
  }

  const ACTION_CONFIG = {
    approve:  { title: 'Duyệt hồ sơ bác sĩ', msg: `Xác nhận duyệt hồ sơ BS. "${target?.ho_ten}"?`, confirmText: 'Duyệt', danger: false },
    reject:   { title: 'Từ chối hồ sơ', msg: `Từ chối hồ sơ BS. "${target?.ho_ten}"?`, confirmText: 'Từ chối', danger: true },
    suspend:  { title: 'Tạm ngưng bác sĩ', msg: `Tạm ngưng tài khoản BS. "${target?.ho_ten}"?`, confirmText: 'Tạm ngưng', danger: true },
    restore:  { title: 'Khôi phục bác sĩ', msg: `Khôi phục tài khoản BS. "${target?.ho_ten}"?`, confirmText: 'Khôi phục', danger: false },
  }
  const cfg = ACTION_CONFIG[action]

  return (
    <div>
      <PageHeader
        title="Duyệt hồ sơ bác sĩ"
        description="Xét duyệt, tạm ngưng và quản lý tài khoản bác sĩ trong hệ thống."
      />

      {/* Thẻ thống kê nhanh */}
      {counts.pending > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <Icon name="clock" className="h-5 w-5 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            Có <strong>{counts.pending}</strong> hồ sơ bác sĩ đang chờ duyệt
          </span>
          <button
            onClick={() => setActiveTab('pending')}
            className="ml-auto text-sm font-semibold text-yellow-700 hover:underline"
          >
            Xem ngay →
          </button>
        </div>
      )}

      {/* Tab lọc */}
      <div className="card mb-4 flex gap-1 overflow-x-auto p-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bảng bác sĩ */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Bác sĩ</th>
                <th className="px-4 py-3 font-medium">Chuyên khoa</th>
                <th className="px-4 py-3 font-medium">Kinh nghiệm</th>
                <th className="px-4 py-3 font-medium">Phí tư vấn</th>
                <th className="px-4 py-3 font-medium">Đánh giá</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ngày nộp</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : doctors.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Không có hồ sơ nào.</td></tr>
              ) : doctors.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{doc.ho_ten}</p>
                    <p className="text-xs text-slate-400">{doc.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{doc.chuyen_khoa}</td>
                  <td className="px-4 py-3 text-slate-600">{doc.so_nam_kinh_nghiem} năm</td>
                  <td className="px-4 py-3 text-slate-600">{formatPrice(doc.phi_tu_van)}</td>
                  <td className="px-4 py-3">
                    {doc.so_danh_gia > 0 ? (
                      <span className="flex items-center gap-1 text-amber-500">
                        <Icon name="star" className="h-3.5 w-3.5" />
                        <span className="text-slate-700">{doc.diem_danh_gia.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">({doc.so_danh_gia})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Chưa có</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={APPROVAL_COLOR[doc.trang_thai_duyet]}>
                      {DOCTOR_APPROVAL_LABEL[doc.trang_thai_duyet]}
                    </Badge>
                    {doc.trang_thai_duyet === 'rejected' && doc.ly_do_tu_choi && (
                      <p className="mt-1 max-w-[200px] text-xs text-red-500">{doc.ly_do_tu_choi}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(doc.ngay_tao)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {doc.trang_thai_duyet === 'pending' && (
                        <>
                          <button
                            onClick={() => openAction(doc, 'approve')}
                            className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600 transition-colors hover:bg-green-100"
                          >
                            <Icon name="check" className="h-3 w-3" /> Duyệt
                          </button>
                          <button
                            onClick={() => openAction(doc, 'reject')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                          >
                            <Icon name="x" className="h-3 w-3" /> Từ chối
                          </button>
                        </>
                      )}
                      {doc.trang_thai_duyet === 'approved' && (
                        <button
                          onClick={() => openAction(doc, 'suspend')}
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100"
                        >
                          <Icon name="ban" className="h-3 w-3" /> Tạm ngưng
                        </button>
                      )}
                      {(doc.trang_thai_duyet === 'suspended' || doc.trang_thai_duyet === 'rejected') && (
                        <button
                          onClick={() => openAction(doc, 'restore')}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100"
                        >
                          <Icon name="check" className="h-3 w-3" /> Khôi phục
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <p className="mt-3 text-sm text-slate-500">Tổng cộng {doctors.length} bác sĩ</p>
      )}

      {/* Dialog xác nhận (có ô nhập lý do từ chối) */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">{cfg.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{cfg.msg}</p>
            {showRejectInput && (
              <textarea
                className="input mt-3 resize-none"
                rows={3}
                placeholder="Nhập lý do từ chối (bắt buộc)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setTarget(null)} className="btn-secondary">Hủy</button>
              <button
                onClick={handleConfirm}
                disabled={showRejectInput && !rejectReason.trim()}
                className={cfg.danger ? 'btn-danger disabled:opacity-50' : 'btn-primary disabled:opacity-50'}
              >
                {cfg.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
