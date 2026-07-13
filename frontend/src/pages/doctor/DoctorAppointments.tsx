import React, { useEffect, useRef, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { examinationService } from '@/services/examination.service'
import type { DoctorAppointmentDetail, ExaminationResult, PrescriptionDrug, AppointmentStatus, KetQuaKhamStatus } from '@/types'
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  KET_QUA_KHAM_STATUS_COLOR,
} from '@/utils/constants'
import { formatDate, formatPrice } from '@/utils/format'

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

const EMPTY_DRUG: Omit<PrescriptionDrug, 'id'> = {
  ten_thuoc: '', lieu_luong: '', tan_suat: '2 lần/ngày',
  gio_uong: ['07:00'], so_ngay: 7, ghi_chu: '',
}

// ─── ExamModal ────────────────────────────────────────────────────────────────

interface ExamModalProps {
  appt: DoctorAppointmentDetail
  onClose: () => void
  onSaved: (result: ExaminationResult) => void
}

function ExamModal({ appt, onClose, onSaved }: ExamModalProps) {
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<ExaminationResult | null>(null)
  const [chan_doan, setChanDoan] = useState('')
  const [huong_dan, setHuongDan] = useState('')
  const [ghi_chu, setGhiChu] = useState('')
  const [ngay_tai_kham, setNgayTaiKham] = useState('')
  const [drugs, setDrugs] = useState<Omit<PrescriptionDrug, 'id'>[]>([{ ...EMPTY_DRUG }])
  const [saving, setSaving] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    examinationService.getByAppointment(appt.id).then((res) => {
      if (res) {
        setExisting(res)
        setChanDoan(res.chan_doan)
        setHuongDan(res.huong_dan_dieu_tri)
        setGhiChu(res.ghi_chu ?? '')
        setNgayTaiKham(res.ngay_tai_kham)
        setDrugs(res.thuoc.map(({ ten_thuoc, lieu_luong, tan_suat, gio_uong, so_ngay, ghi_chu }) => ({
          ten_thuoc, lieu_luong, tan_suat, gio_uong, so_ngay, ghi_chu,
        })))
      }
    }).finally(() => setLoading(false))
  }, [appt.id])

  const isReadOnly = existing !== null && !existing.co_the_sua

  // Ngày tái khám bắt buộc từ ngày tiếp theo trở đi — không được chọn trùng ngày khám hoặc quá khứ.
  const minNgayTaiKham = (() => {
    const d = new Date(appt.ngay_kham)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await examinationService.save({
        appointment_id: appt.id,
        chan_doan,
        huong_dan_dieu_tri: huong_dan,
        ghi_chu: ghi_chu || null,
        ngay_tai_kham,
        thuoc: drugs,
      })
      onSaved(result)
    } finally {
      setSaving(false)
    }
  }

  function addDrug() {
    setDrugs((prev) => [...prev, { ...EMPTY_DRUG }])
  }
  function removeDrug(i: number) { setDrugs((prev) => prev.filter((_, idx) => idx !== i)) }
  function updateDrug<K extends keyof Omit<PrescriptionDrug, 'id'>>(
    i: number, key: K, val: Omit<PrescriptionDrug, 'id'>[K],
  ) {
    setDrugs((prev) => prev.map((d, idx) => idx === i ? { ...d, [key]: val } : d))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div ref={topRef} className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="font-semibold text-slate-800">Kết quả khám</p>
            <p className="text-sm text-slate-500">
              {appt.benh_nhan} · {formatDate(appt.ngay_kham)} {appt.gio_kham}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 px-6 py-5">
            {isReadOnly && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <Icon name="clock" className="h-4 w-4 shrink-0" />
                Kết quả đã được lưu trên 24 giờ — không thể chỉnh sửa.
              </div>
            )}

            <div>
              <label className="input-label">Chẩn đoán <span className="text-red-500">*</span></label>
              <textarea className="input resize-none" rows={2} required readOnly={isReadOnly}
                value={chan_doan} onChange={(e) => setChanDoan(e.target.value)}
                placeholder="Nhập chẩn đoán của bệnh nhân..." />
            </div>

            <div>
              <label className="input-label">Hướng dẫn điều trị</label>
              <textarea className="input resize-none" rows={3} readOnly={isReadOnly}
                value={huong_dan} onChange={(e) => setHuongDan(e.target.value)}
                placeholder="Hướng dẫn, lưu ý về chế độ ăn uống, nghỉ ngơi..." />
            </div>

            <div>
              <label className="input-label">Ghi chú bổ sung</label>
              <textarea className="input resize-none" rows={2} readOnly={isReadOnly}
                value={ghi_chu} onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Ghi chú thêm cho bệnh nhân (nếu có)..." />
            </div>

            <div className="sm:w-48">
              <label className="input-label">Ngày tái khám</label>
              <input type="date" className="input" readOnly={isReadOnly} min={minNgayTaiKham}
                value={ngay_tai_kham} onChange={(e) => setNgayTaiKham(e.target.value)} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="input-label mb-0">Đơn thuốc</label>
                {!isReadOnly && (
                  <button type="button" onClick={addDrug}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition-colors">
                    <Icon name="plus" className="h-3 w-3" /> Thêm thuốc
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {drugs.map((drug, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="input-label text-[10px]">Tên thuốc</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.ten_thuoc}
                          onChange={(e) => updateDrug(i, 'ten_thuoc', e.target.value)}
                          placeholder="VD: Paracetamol 500mg" />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Liều lượng</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.lieu_luong}
                          onChange={(e) => updateDrug(i, 'lieu_luong', e.target.value)}
                          placeholder="VD: 1 viên/lần" />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Tần suất</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.tan_suat}
                          onChange={(e) => updateDrug(i, 'tan_suat', e.target.value)}
                          placeholder="VD: 3 lần/ngày" />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Giờ uống <span className="font-normal text-slate-400">(cách nhau bằng dấu phẩy)</span></label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.gio_uong.join(', ')}
                          onChange={(e) => updateDrug(i, 'gio_uong',
                            e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                          )}
                          placeholder="VD: 07:00, 12:00, 19:00" />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Số ngày uống</label>
                        <input type="number" min={1} max={90} className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.so_ngay}
                          onChange={(e) => updateDrug(i, 'so_ngay', Number(e.target.value))}
                          placeholder="VD: 7" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="input-label text-[10px]">Ghi chú</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.ghi_chu ?? ''}
                          onChange={(e) => updateDrug(i, 'ghi_chu', e.target.value)}
                          placeholder="Uống sau ăn, tránh ánh nắng..." />
                      </div>
                      {!isReadOnly && drugs.length > 1 && (
                        <button type="button" onClick={() => removeDrug(i)}
                          className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
              {!isReadOnly && (
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : (existing ? 'Cập nhật' : 'Lưu kết quả')}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

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
  const todayStr = new Date().toISOString().slice(0, 10)

  // ── Dữ liệu ──────────────────────────────────────────────────────────────────
  const [all, setAll] = useState<DoctorAppointmentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ── Filter — theo ngày + theo trạng thái (truyền thẳng lên API, backend tự lọc theo doctor_id) ──
  // Mặc định KHÔNG lọc ngày (rỗng) — nếu mặc định "hôm nay", lịch đã thanh toán/xác nhận cho
  // ngày khác (rất phổ biến vì bệnh nhân đặt trước) sẽ biến mất khỏi màn hình mặc định, dễ bị
  // hiểu nhầm là lỗi hệ thống dù dữ liệu và API đều đúng — xem docs/Bác sĩ/Debug - Lich da
  // thanh toan khong hien o trang bac si.
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | AppointmentStatus>('')

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [revisionId, setRevisionId] = useState<string | null>(null)
  const [confirmResultId, setConfirmResultId] = useState<string | null>(null)
  const [resultActionLoading, setResultActionLoading] = useState<string | null>(null)
  const [examAppt, setExamAppt] = useState<DoctorAppointmentDetail | null>(null)

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // Tải lại mỗi khi đổi filter — status/date truyền thẳng lên API (không tải hết rồi lọc)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setError(false)
    doctorAppointmentService.getAll({ status: filterStatus, date: filterDate })
      .then(setAll)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [filterDate, filterStatus])

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const displayed = [...all].sort((a, b) => a.gio_kham.localeCompare(b.gio_kham))

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: pending đã quá ngày
  // ─────────────────────────────────────────────────────────────────────────────
  function isExpiredPending(a: DoctorAppointmentDetail) {
    return a.status === 'pending' && a.ngay_kham < todayStr
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

  // Xác nhận hồ sơ khám — mở ConfirmDialog trước, chỉ gọi API sau khi bác sĩ bấm Đồng ý
  async function handleConfirmResult(id: string) {
    setConfirmResultId(null)
    setResultActionLoading(id)
    try {
      const updated = await doctorAppointmentService.confirmResult(id)
      updateAppt(id, { ket_qua_status: updated.status, status: updated.appointment_status })
      showToast('Đã xác nhận hồ sơ khám')
    } catch {
      showToast('Không thể xác nhận hồ sơ khám', 'error')
    } finally {
      setResultActionLoading(null)
    }
  }

  async function handleRequestRevision(id: string, ly_do: string) {
    setResultActionLoading(id)
    try {
      const updated = await doctorAppointmentService.requestResultRevision(id, ly_do)
      updateAppt(id, { ket_qua_status: updated.status })
      showToast('Đã gửi yêu cầu chỉnh sửa hồ sơ')
      setRevisionId(null)
    } catch {
      showToast('Không thể gửi yêu cầu chỉnh sửa', 'error')
    } finally {
      setResultActionLoading(null)
    }
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
            <p className="mt-0.5 text-slate-700">{appt.so_dien_thoai}</p>
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
              {appt.ket_qua_status === 'cho_xac_nhan' && (
                <>
                  <Button variant="success" size="sm" onClick={() => setConfirmResultId(appt.id)}
                    disabled={resultActionLoading === appt.id}
                    icon={<Icon name="check" className="h-3.5 w-3.5" />}>
                    {resultActionLoading === appt.id ? 'Đang xác nhận...' : 'Xác nhận hồ sơ'}
                  </Button>
                  <Button variant="warning" size="sm" onClick={() => setRevisionId(appt.id)}
                    disabled={resultActionLoading === appt.id}
                    icon={<Icon name="edit" className="h-3.5 w-3.5" />}>
                    Yêu cầu chỉnh sửa
                  </Button>
                </>
              )}
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
          description="Danh sách lịch hẹn của riêng bạn — lọc theo ngày hoặc trạng thái."
        />

        {/* ── Bộ lọc: gom vào 1 khu vực rõ ràng (filter card) ── */}
        <div className="card mb-4 flex flex-wrap items-end gap-4 p-4">
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

          {(filterDate || filterStatus) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterDate(''); setFilterStatus('') }}>
              Xóa lọc
            </Button>
          )}

          {!loading && !error && (
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
                              {filterDate || filterStatus
                                ? 'Không có lịch hẹn nào khớp với bộ lọc.'
                                : 'Không có lịch hẹn nào.'}
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
                    {filterDate || filterStatus
                      ? 'Không có lịch hẹn nào khớp với bộ lọc.'
                      : 'Không có lịch hẹn nào.'}
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

        {revisionId !== null && (
          <ReasonModal
            title="Yêu cầu chỉnh sửa hồ sơ khám"
            description="Nêu rõ phần cần sửa (vd: thiếu chẩn đoán, sai liều thuốc...). Hồ sơ sẽ chuyển sang trạng thái Cần chỉnh sửa."
            confirmLabel="Gửi yêu cầu"
            submitting={resultActionLoading === revisionId}
            onConfirm={(ly_do) => handleRequestRevision(revisionId, ly_do)}
            onClose={() => setRevisionId(null)}
          />
        )}

        <ConfirmDialog
          open={confirmResultId !== null}
          title="Xác nhận hồ sơ khám"
          message="Bạn có chắc chắn hồ sơ khám này đã đầy đủ và chính xác? Sau khi xác nhận, hồ sơ sẽ chuyển sang trạng thái Đã xác nhận."
          confirmText="Xác nhận"
          onConfirm={() => confirmResultId && handleConfirmResult(confirmResultId)}
          onCancel={() => setConfirmResultId(null)}
        />

        {examAppt && (
          <ExamModal
            appt={examAppt}
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
