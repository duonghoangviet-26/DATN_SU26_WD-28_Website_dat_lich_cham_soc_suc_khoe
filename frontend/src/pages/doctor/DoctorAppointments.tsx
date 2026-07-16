import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Icon from '@/components/admin/icons'
import ExamResultModal from '@/components/doctor/ExamResultModal'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import type { DoctorAppointmentDetail, AppointmentStatus, KetQuaKhamStatus } from '@/types'
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  KET_QUA_KHAM_STATUS_COLOR,
} from '@/utils/constants'
import { formatDate, formatPrice, toLocalDateStr } from '@/utils/format'

// ─── Tab thời gian + cửa sổ 6 ngày làm việc ─────────────────────────────────

type TimeTab = 'today' | 'upcoming' | 'past' | 'all'

const TIME_TAB_LABEL: Record<TimeTab, string> = {
  today: 'Hôm nay', upcoming: 'Sắp tới', past: 'Đã qua', all: 'Tất cả',
}

// Danh sach dung N ngay lam viec ke tiep, tinh tu ngay SAU fromDateStr, bo qua Chu nhat
// (cung quy uoc isWorkingDay ben backend, scheduleGenerator.service.js). Tra ve mang cac
// ngay cu the (khong chi mot khoang) de loai tru dut khoat Chu nhat lo lot vao "Sap toi"
// dinh vi bang ranh gioi khoang ngay (dung Set thanh vien thay vi so sanh <=).
function getUpcomingWorkingDays(fromDateStr: string, workingDays: number): Set<string> {
  const d = new Date(fromDateStr + 'T00:00:00')
  const result = new Set<string>()
  while (result.size < workingDays) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) result.add(toLocalDateStr(d))
  }
  return result
}

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const LOAI_LABEL: Record<string, string> = {
  clinic: 'Tại phòng khám', home: 'Tại nhà',
}

const KET_QUA_STATUS_LABEL: Record<KetQuaKhamStatus, string> = {
  ban_nhap: 'Nháp',
  cho_xac_nhan: 'Chờ bác sĩ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  yeu_cau_chinh_sua: 'Cần chỉnh sửa',
}

// Header bảng: chữ đủ tương phản (slate-600, không phải slate-500 nhạt), không
// viết hoa toàn bộ để đỡ "cứng" — thay bằng font-semibold + nền slate-50 phân lớp rõ.
const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

// ─── RejectModal ──────────────────────────────────────────────────────────────

interface ReasonModalProps {
  title: string
  description: string
  confirmLabel: string
  submitting?: boolean
  onConfirm: (ly_do: string) => void
  onClose: () => void
}

function ReasonModal({ title, description, confirmLabel, submitting = false, onConfirm, onClose }: ReasonModalProps) {
  const [ly_do, setLyDo] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <textarea
          className="input mt-3 resize-none"
          rows={3}
          placeholder="Nhập lý do..."
          value={ly_do}
          onChange={(e) => setLyDo(e.target.value)}
          disabled={submitting}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>Đóng</button>
          <button
            onClick={() => { if (ly_do.trim()) onConfirm(ly_do) }}
            disabled={!ly_do.trim() || submitting}
            className="btn-primary disabled:opacity-40"
          >
            {submitting ? 'Đang gửi...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorAppointments() {
  // toLocalDateStr() thay cho new Date().toISOString().slice(0,10) — tránh lệch 1 ngày trong
  // khung 00:00–07:00 giờ VN (bug đã phát hiện, xem docs/Bác sĩ/Thiet ke tim kiem va loc lich
  // hen bac si - Bao cao truoc khi code, mục 4).
  const todayStr = toLocalDateStr()
  const upcomingWorkingDays = useMemo(() => getUpcomingWorkingDays(todayStr, 6), [todayStr])

  const [searchParams, setSearchParams] = useSearchParams()

  // ── Dữ liệu — tải 1 lần lúc vào trang, mọi tab/lọc xử lý ở client (useMemo bên dưới) ──
  const [all, setAll] = useState<DoctorAppointmentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ── Tab thời gian + tìm kiếm + lọc — đồng bộ tối thiểu vào URL (tab/status/q) ──
  const [timeTab, setTimeTab] = useState<TimeTab>((searchParams.get('tab') as TimeTab) || 'today')
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '')
  const [filterStatus, setFilterStatus] = useState<'' | AppointmentStatus>(
    (searchParams.get('status') as AppointmentStatus) || ''
  )
  // Chọn 1 ngày cụ thể — dùng chung mọi tab; riêng tab "Đã qua" còn dùng để "mở khóa" hiển thị.
  const [filterDate, setFilterDate] = useState('')

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [examAppt, setExamAppt] = useState<DoctorAppointmentDetail | null>(null)

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // Tải đúng 1 lần lúc vào trang — không phụ thuộc filter (loại bỏ race-condition
  // giữa các lần đổi filter, không load nhấp nháy khi đổi tab/tìm kiếm).
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setError(false)
    doctorAppointmentService.getAll({})
      .then(setAll)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // Đồng bộ tab/status/q vào URL (refresh không mất bộ lọc, copy URL được).
  useEffect(() => {
    const next = new URLSearchParams()
    if (timeTab !== 'today') next.set('tab', timeTab)
    if (filterStatus) next.set('status', filterStatus)
    if (searchTerm.trim()) next.set('q', searchTerm.trim())
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTab, filterStatus, searchTerm])

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function ngayKhamLocal(a: DoctorAppointmentDetail): string {
    return toLocalDateStr(new Date(a.ngay_kham))
  }

  // Đếm theo tab thời gian trên TOÀN BỘ dữ liệu đã tải (không áp search/status/date) — dùng
  // cho số trên nhãn tab, kể cả tab "Đã qua" (vẫn hiện tổng số thật dù danh sách đang ẩn).
  const tabCounts = useMemo(() => ({
    today: all.filter((a) => ngayKhamLocal(a) === todayStr).length,
    upcoming: all.filter((a) => upcomingWorkingDays.has(ngayKhamLocal(a))).length,
    past: all.filter((a) => ngayKhamLocal(a) < todayStr).length,
    all: all.length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [all, todayStr, upcomingWorkingDays])

  // Tab "Đã qua" (lịch sử) mặc định RỖNG — chỉ hiện khi có từ khóa tìm kiếm hoặc đã chọn 1
  // ngày cụ thể (quyết định 2026-07-16, khác thiết kế 07-11 vốn hiện sẵn toàn bộ).
  const historyLocked = timeTab === 'past' && !searchTerm.trim() && !filterDate

  const filtered = useMemo(() => {
    if (historyLocked) return []

    let list = all
    if (timeTab === 'today') {
      list = list.filter((a) => ngayKhamLocal(a) === todayStr)
    } else if (timeTab === 'upcoming') {
      list = list.filter((a) => upcomingWorkingDays.has(ngayKhamLocal(a)))
    } else if (timeTab === 'past') {
      list = list.filter((a) => ngayKhamLocal(a) < todayStr)
    }

    if (filterStatus) list = list.filter((a) => a.status === filterStatus)
    if (filterDate) list = list.filter((a) => ngayKhamLocal(a) === filterDate)

    const q = searchTerm.trim().toLowerCase()
    if (q) {
      list = list.filter((a) =>
        a.benh_nhan.toLowerCase().includes(q) ||
        (a.ma_lich_hen ?? '').toLowerCase().includes(q) ||
        (a.so_dien_thoai ?? '').includes(q)
      )
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, timeTab, filterStatus, filterDate, searchTerm, todayStr, upcomingWorkingDays, historyLocked])

  const hasActiveFilter = Boolean(filterDate || filterStatus || searchTerm.trim())

  const displayed = [...filtered].sort((a, b) => {
    const dateCompare = a.ngay_kham.localeCompare(b.ngay_kham)
    return dateCompare !== 0 ? dateCompare : a.gio_kham.localeCompare(b.gio_kham)
  })

  const emptyMessage = historyLocked
    ? 'Nhập từ khóa hoặc chọn ngày cụ thể để xem lịch sử khám.'
    : hasActiveFilter
      ? 'Không có lịch hẹn nào khớp với bộ lọc.'
      : 'Không có lịch hẹn nào.'

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: pending đã quá ngày
  // ─────────────────────────────────────────────────────────────────────────────
  function isExpiredPending(a: DoctorAppointmentDetail) {
    return a.status === 'pending' && ngayKhamLocal(a) < todayStr
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cập nhật 1 record trong state
  // ─────────────────────────────────────────────────────────────────────────────
  function updateAppt(id: string, data: Partial<DoctorAppointmentDetail>) {
    setAll((prev) => prev.map((a) => a.id === id ? { ...a, ...data } : a))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────────
  async function handleConfirm(id: string) {
    if (actionLoading !== null) return
    setActionLoading(id)
    try {
      const updated = await doctorAppointmentService.confirm(id)
      updateAppt(id, { status: updated.status, payment_deadline: updated.payment_deadline })
      showToast('Đã xác nhận lịch hẹn')
    } catch {
      showToast('Không thể xác nhận lịch hẹn', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(id: string, ly_do: string) {
    try {
      const updated = await doctorAppointmentService.reject(id, ly_do)
      updateAppt(id, {
        status: 'cancelled',
        ly_do_huy: ly_do,
        payment_status: updated.payment_status,
      })
      showToast('Đã từ chối lịch hẹn')
    } catch {
      showToast('Không thể từ chối lịch hẹn', 'error')
    }
    setRejectId(null)
  }

  async function handleComplete(id: string) {
    if (actionLoading !== null) return
    setActionLoading(id)
    try {
      const updated = await doctorAppointmentService.complete(id)
      updateAppt(id, { status: updated.status, da_co_ket_qua: updated.da_co_ket_qua })
      showToast('Đã đánh dấu hoàn thành')
    } catch {
      showToast('Không thể hoàn thành lịch hẹn', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelConfirmed(id: string, ly_do: string) {
    try {
      const updated = await doctorAppointmentService.cancelConfirmed(id, ly_do)
      updateAppt(id, { status: 'cancelled', payment_status: updated.payment_status, ly_do_huy: ly_do, payment_deadline: null })
      const msg = updated.payment_status === 'refunded'
        ? 'Đã hủy lịch — bệnh nhân được hoàn 100%'
        : 'Đã hủy lịch hẹn'
      showToast(msg)
    } catch {
      showToast('Không thể hủy lịch hẹn', 'error')
    }
    setCancelId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Nội dung mở rộng (chi tiết lịch hẹn) — dùng chung cho hàng bảng (desktop/tablet)
  // và card (mobile), tránh viết trùng 2 lần.
  // ─────────────────────────────────────────────────────────────────────────────
  function renderDetailPanel(appt: DoctorAppointmentDetail) {
    return (
      <div className="space-y-3 text-sm">
        {/* Tầng 0: thông tin lịch hẹn — mã lịch hẹn + chuyên khoa */}
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {appt.ma_lich_hen && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mã lịch hẹn</p>
              <p className="mt-0.5 font-mono text-slate-700">{appt.ma_lich_hen}</p>
            </div>
          )}
          {appt.chuyen_khoa && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chuyên khoa</p>
              <p className="mt-0.5 text-slate-700">{appt.chuyen_khoa}</p>
            </div>
          )}
        </div>

        {/* Tầng 1: thông tin bệnh nhân + lịch hẹn — flex-wrap để tự điền, không tạo khoảng trống */}
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Số điện thoại</p>
            <p className="mt-0.5 text-slate-700">{appt.so_dien_thoai ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phí khám</p>
            <p className="mt-0.5 font-semibold text-slate-700">{formatPrice(appt.gia_kham)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Thanh toán</p>
            <p className="mt-0.5">
              <Badge color={PAYMENT_STATUS_COLOR[appt.payment_status]}>
                {PAYMENT_STATUS_LABEL[appt.payment_status]}
              </Badge>
            </p>
          </div>
          {appt.tuoi !== undefined && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tuổi</p>
              <p className="mt-0.5 text-slate-700">{appt.tuoi} tuổi</p>
            </div>
          )}
          {appt.gioi_tinh && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Giới tính</p>
              <p className="mt-0.5 text-slate-700">{appt.gioi_tinh}</p>
            </div>
          )}
          {appt.di_ung && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dị ứng</p>
              <p className="mt-0.5 font-medium text-red-600">{appt.di_ung}</p>
            </div>
          )}
          {appt.benh_nen && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bệnh nền</p>
              <p className="mt-0.5 text-slate-700">{appt.benh_nen}</p>
            </div>
          )}
        </div>

        {/* Cảnh báo Luồng C: BS đã confirm nhưng BN chưa thanh toán */}
        {appt.status === 'confirmed' && appt.payment_status === 'unpaid' && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <Icon name="clock" className="h-3.5 w-3.5 shrink-0" />
            <span>
              Chờ bệnh nhân thanh toán
              {appt.payment_deadline && (
                <span className="ml-1 text-amber-500">
                  — trước {new Date(appt.payment_deadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {formatDate(appt.payment_deadline.slice(0, 10))}
                </span>
              )}
              . Nếu quá hạn, hệ thống sẽ tự động hủy.
            </span>
          </div>
        )}

        {/* Tầng 2: nội dung rộng — chỉ render khi có ít nhất 1 field */}
        {(appt.phong_kham || appt.dia_chi_kham || appt.ly_do_kham || appt.ly_do_huy) && (
          <div className="grid gap-3 border-t border-brand-100 pt-3 sm:grid-cols-2">
            {appt.loai_kham === 'clinic' && appt.phong_kham && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phòng khám</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-green-800">
                  <Icon name="hospital" className="h-3.5 w-3.5 shrink-0" />
                  {appt.phong_kham}
                </p>
              </div>
            )}
            {appt.loai_kham === 'home' && appt.dia_chi_kham && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Địa chỉ bác sĩ đến</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-purple-800">
                  <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
                  {appt.dia_chi_kham}
                </p>
              </div>
            )}
            {appt.ly_do_kham && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lý do khám</p>
                <p className="mt-0.5 text-slate-700">{appt.ly_do_kham}</p>
              </div>
            )}
            {appt.ly_do_huy && (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lý do hủy</p>
                <p className="mt-0.5 text-red-600">{appt.ly_do_huy}</p>
              </div>
            )}
          </div>
        )}

        {/* Hồ sơ khám */}
        {appt.da_co_ket_qua && (
          <div className="flex flex-wrap items-center gap-3 border-t border-brand-100 pt-3">
            <div className="flex items-center gap-2">
              <Icon name="file-text" className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hồ sơ khám</span>
              {appt.ket_qua_status && (
                <Badge color={KET_QUA_KHAM_STATUS_COLOR[appt.ket_qua_status]}>
                  {KET_QUA_STATUS_LABEL[appt.ket_qua_status]}
                </Badge>
              )}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setExamAppt(appt)}
                icon={<Icon name="eye" className="h-3.5 w-3.5" />}>
                Xem hồ sơ
              </Button>
              {/* Hồ sơ 'cho_xac_nhan' được xác nhận tại trang "Hồ sơ chờ xác nhận" (một nguồn duy nhất). */}
            </div>
          </div>
        )}

        {/* Tầng 3: hành động — theo trạng thái hiện tại (không có nút xóa/sửa lịch) */}
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
          {/* PENDING — chỉ còn cho HOME (quyết định 2026-07-02: clinic auto-confirm khi
              thanh toán, không còn ở trạng thái pending nên không có nút Xác nhận/Từ chối) */}
          {appt.status === 'pending' && appt.loai_kham === 'home' && (
            <>
              {!isExpiredPending(appt) && (
                <Button variant="success" size="sm" onClick={() => handleConfirm(appt.id)}
                  disabled={actionLoading === appt.id}
                  icon={<Icon name="check" className="h-3.5 w-3.5" />}>
                  Xác nhận
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => setRejectId(appt.id)}
                icon={<Icon name="x" className="h-3.5 w-3.5" />}>
                Từ chối
              </Button>
            </>
          )}

          {/* CONFIRMED */}
          {appt.status === 'confirmed' && (
            <>
              {appt.ngay_kham <= todayStr && (
                <>
                  <Button variant="success" size="sm" onClick={() => handleComplete(appt.id)}
                    disabled={actionLoading === appt.id}
                    icon={<Icon name="check" className="h-3.5 w-3.5" />}>
                    Hoàn thành
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setExamAppt(appt)}
                    icon={<Icon name="edit" className="h-3.5 w-3.5" />}>
                    Kết quả
                  </Button>
                </>
              )}
              {/* Hủy: bác sĩ hủy → hoàn tiền 100%. Với clinic đây là "Hủy khẩn cấp"
                  (bắt buộc lý do, slot → locked, chờ Admin xử lý — không phải xóa lịch hẹn). */}
              <Button variant="danger" size="sm" onClick={() => setCancelId(appt.id)}
                icon={<Icon name="x" className="h-3.5 w-3.5" />}>
                {appt.loai_kham === 'clinic' ? 'Hủy khẩn cấp' : 'Hủy'}
              </Button>
            </>
          )}

          {/* COMPLETED — chưa có hồ sơ khám: cho nhập lần đầu (khối "Hồ sơ khám" ở trên xử lý khi đã có) */}
          {appt.status === 'completed' && !appt.da_co_ket_qua && (
            <Button variant="secondary" size="sm" onClick={() => setExamAppt(appt)}
              icon={<Icon name="edit" className="h-3.5 w-3.5" />}>
              Nhập kết quả
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GIAO DIỆN
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast — góc trên phải, tự mất sau 3 giây */}
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}

      <div>
        <PageHeader
          title="Lịch hẹn của tôi"
          description="Danh sách lịch hẹn của riêng bạn — lọc theo thời gian, tìm kiếm hoặc theo ngày cụ thể."
        />

        {/* ── Tab thời gian ── */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(TIME_TAB_LABEL) as TimeTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTimeTab(tab)}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                timeTab === tab
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {TIME_TAB_LABEL[tab]} ({tabCounts[tab]})
            </button>
          ))}
        </div>

        {/* ── Bộ lọc: gom vào 1 khu vực rõ ràng (filter card) ── */}
        <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tìm kiếm</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tên bệnh nhân, mã lịch hẹn, số điện thoại..."
              className="input"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Ngày khám</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input w-auto"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="input w-auto min-w-[170px]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterDate(''); setFilterStatus(''); setSearchTerm('') }}>
              Xóa lọc
            </Button>
          )}

          {!loading && !error && !historyLocked && (
            <span className="ml-auto text-xs text-slate-400">{displayed.length} lịch hẹn</span>
          )}
        </div>

        {/* ── Nội dung: loading / error / bảng (desktop-tablet) + card list (mobile) ── */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
            <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
            <p className="text-sm font-medium text-red-600">Không tải được danh sách lịch hẹn. Vui lòng thử lại sau.</p>
          </div>
        ) : (
          <>
            {/* ── Bảng — từ md (≥768px) trở lên ── */}
            <div className="card hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-[11%]" />
                    <col className="w-[24%]" />
                    <col className="w-[24%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[11%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className={TH}>Giờ khám</th>
                      <th className={TH}>Bệnh nhân</th>
                      <th className={TH}>Thông tin khám</th>
                      <th className={TH}>Phòng khám</th>
                      <th className={TH}>Trạng thái</th>
                      <th className={TH}>Thao tác</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {displayed.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Icon name="calendar" className="h-10 w-10 text-slate-200" />
                            <p className="text-base font-medium text-slate-500">
                              {emptyMessage}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayed.map((appt) => (
                        <React.Fragment key={appt.id}>
                          {/* ── Row chính ── */}
                          <tr
                            className={`cursor-pointer transition-colors hover:bg-slate-50 ${expandedId === appt.id ? 'bg-brand-50/60' : ''
                              }`}
                            onClick={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                          >
                            {/* Giờ khám */}
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-slate-700">{appt.gio_kham}</div>
                              <div className="text-xs text-slate-400">{formatDate(appt.ngay_kham)}</div>
                            </td>

                            {/* Bệnh nhân (+ tuổi/giới tính nếu có) */}
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                                  {appt.benh_nhan.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-800">{appt.benh_nhan}</p>
                                  {(appt.tuoi !== undefined || appt.gioi_tinh) && (
                                    <p className="truncate text-xs text-slate-400">
                                      {[appt.tuoi !== undefined ? `${appt.tuoi} tuổi` : null, appt.gioi_tinh ?? null]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Thông tin khám: dịch vụ (chính) + mã lịch hẹn (metadata) */}
                            <td className="px-4 py-3 align-top">
                              <p className="truncate text-slate-700" title={appt.ten_dich_vu ?? undefined}>
                                {appt.ten_dich_vu ?? (appt.loai_kham === 'home' ? LOAI_LABEL.home : '—')}
                              </p>
                              {appt.ma_lich_hen && (
                                <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{appt.ma_lich_hen}</p>
                              )}
                            </td>

                            {/* Phòng khám — ẩn dưới lg, vẫn xem được qua "Chi tiết" */}
                            <td className="px-4 py-3 align-top">
                              {appt.loai_kham === 'clinic' ? (
                                appt.phong_kham
                                  ? <p className="truncate text-slate-700">{appt.phong_kham}</p>
                                  : <p className="text-xs font-medium text-amber-600">⚠ Chưa có phòng</p>
                              ) : (
                                <p className="text-xs text-slate-400">—</p>
                              )}
                            </td>

                            {/* Trạng thái lịch hẹn + thanh toán */}
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-col items-start gap-1">
                                <Badge color={APPOINTMENT_STATUS_COLOR[appt.status]}>
                                  {APPOINTMENT_STATUS_LABEL[appt.status]}
                                </Badge>
                                <Badge color={PAYMENT_STATUS_COLOR[appt.payment_status]}>
                                  {PAYMENT_STATUS_LABEL[appt.payment_status]}
                                </Badge>
                                {isExpiredPending(appt) && (
                                  <Badge color="gray">Hết hạn</Badge>
                                )}
                              </div>
                            </td>

                            {/* Thao tác */}
                            <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="whitespace-nowrap"
                                onClick={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                                icon={<Icon name="eye" className="h-3.5 w-3.5" />}
                              >
                                {expandedId === appt.id ? 'Ẩn' : 'Chi tiết'}
                              </Button>
                            </td>
                          </tr>

                          {/* ── Expanded detail row ── */}
                          {expandedId === appt.id && (
                            <tr className="bg-brand-50/30">
                              <td colSpan={6} className="px-6 py-4">
                                {renderDetailPanel(appt)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Card list — dưới md (<768px) ── */}
            <div className="space-y-3 md:hidden">
              {displayed.length === 0 ? (
                <div className="card flex flex-col items-center gap-3 py-16 text-center">
                  <Icon name="calendar" className="h-10 w-10 text-slate-200" />
                  <p className="text-base font-medium text-slate-500">
                    {emptyMessage}
                  </p>
                </div>
              ) : (
                displayed.map((appt) => (
                  <div key={appt.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-700">{appt.gio_kham}</p>
                        <p className="text-xs text-slate-400">{formatDate(appt.ngay_kham)}</p>
                      </div>
                      {isExpiredPending(appt) && <Badge color="gray">Hết hạn</Badge>}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {appt.benh_nhan.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{appt.benh_nhan}</p>
                        {(appt.tuoi !== undefined || appt.gioi_tinh) && (
                          <p className="truncate text-xs text-slate-400">
                            {[appt.tuoi !== undefined ? `${appt.tuoi} tuổi` : null, appt.gioi_tinh ?? null]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="mt-3 truncate text-sm text-slate-700" title={appt.ten_dich_vu ?? undefined}>
                      {appt.ten_dich_vu ?? (appt.loai_kham === 'home' ? LOAI_LABEL.home : '—')}
                    </p>

                    {appt.loai_kham === 'clinic' && (
                      appt.phong_kham
                        ? <p className="text-sm text-slate-600">{appt.phong_kham}</p>
                        : <p className="text-xs font-medium text-amber-600">⚠ Chưa có phòng</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge color={APPOINTMENT_STATUS_COLOR[appt.status]}>
                        {APPOINTMENT_STATUS_LABEL[appt.status]}
                      </Badge>
                      <Badge color={PAYMENT_STATUS_COLOR[appt.payment_status]}>
                        {PAYMENT_STATUS_LABEL[appt.payment_status]}
                      </Badge>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                        icon={<Icon name="eye" className="h-3.5 w-3.5" />}
                      >
                        {expandedId === appt.id ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                      </Button>
                      {expandedId === appt.id && (
                        <div className="mt-3">
                          {renderDetailPanel(appt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── Modals ── */}

        {rejectId !== null && (
          <ReasonModal
            title="Từ chối lịch hẹn"
            description="Vui lòng nêu lý do từ chối để bệnh nhân được biết."
            confirmLabel="Xác nhận từ chối"
            onConfirm={(ly_do) => handleReject(rejectId, ly_do)}
            onClose={() => setRejectId(null)}
          />
        )}

        {cancelId !== null && (() => {
          const appt = all.find((a) => a.id === cancelId)
          const hasPaid = appt?.payment_status === 'paid'
          const isClinic = appt?.loai_kham === 'clinic'
          return (
            <ReasonModal
              title={isClinic ? 'Hủy khẩn cấp (bắt buộc lý do)' : 'Hủy lịch đã xác nhận'}
              description={
                isClinic
                  ? 'Dùng khi bác sĩ đột xuất không thể khám. Slot sẽ bị khóa (không mở lại tự động) để tránh nhận nhầm đúng ca đó. Bệnh nhân được hoàn tiền 100%.'
                  : hasPaid
                    ? 'Bác sĩ hủy → bệnh nhân được hoàn tiền 100% bất kể thời điểm.'
                    : 'Bác sĩ hủy → lịch hẹn sẽ bị hủy. Bệnh nhân chưa thanh toán nên không có hoàn tiền.'
              }
              confirmLabel="Xác nhận hủy"
              onConfirm={(ly_do) => handleCancelConfirmed(cancelId, ly_do)}
              onClose={() => setCancelId(null)}
            />
          )
        })()}

        {/* Xác nhận/chỉnh sửa hồ sơ khám đã chuyển sang trang "Hồ sơ chờ xác nhận" (2026-07-16):
            bác sĩ sửa trực tiếp rồi "Lưu & Xác nhận" một chỗ. Trang này chỉ còn nhập/xem hồ sơ. */}
        {examAppt && (
          <ExamResultModal
            appt={examAppt}
            mode="edit"
            onClose={() => setExamAppt(null)}
            onSaved={(result) => {
              // result.status: 'da_xac_nhan' ngay nếu bác sĩ tự nhập (không qua y tá) — cập
              // nhật luôn ket_qua_status tại chỗ để badge/nút hành động đúng ngay, không cần tải lại trang.
              updateAppt(examAppt.id, { da_co_ket_qua: true, ket_qua_status: result.status ?? examAppt.ket_qua_status })
              showToast('Đã lưu kết quả khám')
              setExamAppt(null)
            }}
          />
        )}
      </div>
    </>
  )
}
