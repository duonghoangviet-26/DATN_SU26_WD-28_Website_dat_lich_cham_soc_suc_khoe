import React, { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { examinationService } from '@/services/examination.service'
import type { DoctorAppointmentDetail, ExaminationResult, PrescriptionDrug } from '@/types'
import {
  APPOINTMENT_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
} from '@/utils/constants'
import { formatDate, formatPrice } from '@/utils/format'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

type Tab = 'unconfirmed' | 'today' | 'upcoming' | 'past' | 'all'
type SortKey = 'ngay_kham' | 'benh_nhan' | 'gia_kham'

const TIME_TABS: { key: Tab; label: string }[] = [
  { key: 'unconfirmed', label: 'Chưa xác nhận' },
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'past', label: 'Đã qua' },
  { key: 'all', label: 'Tất cả' },
]

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow', confirmed: 'blue', completed: 'green', cancelled: 'red',
}

const PAYMENT_COLOR: Record<string, 'yellow' | 'blue' | 'gray'> = {
  unpaid: 'yellow', paid: 'blue', refunded: 'gray',
}

const LOAI_LABEL: Record<string, string> = {
  clinic: 'Tại phòng khám', home: 'Tại nhà',
}

const TH_SORT = 'cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100'
const TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'

const EMPTY_DRUG: Omit<PrescriptionDrug, 'id'> = {
  ten_thuoc: '', lieu_luong: '', tan_suat: '2 lần/ngày',
  gio_uong: ['07:00'], ngay_bat_dau: '', ngay_ket_thuc: '', ghi_chu: '',
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
  const [drugs, setDrugs] = useState<Omit<PrescriptionDrug, 'id'>[]>(() => {
    const today = new Date().toISOString().slice(0, 10)
    const d30 = new Date(); d30.setDate(d30.getDate() + 30)
    return [{ ...EMPTY_DRUG, ngay_bat_dau: today, ngay_ket_thuc: d30.toISOString().slice(0, 10) }]
  })
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
        setDrugs(res.thuoc.map(({ ten_thuoc, lieu_luong, tan_suat, gio_uong, ngay_bat_dau, ngay_ket_thuc, ghi_chu }) => ({
          ten_thuoc, lieu_luong, tan_suat, gio_uong, ngay_bat_dau, ngay_ket_thuc, ghi_chu,
        })))
      }
    }).finally(() => setLoading(false))
  }, [appt.id])

  const isReadOnly = existing !== null && !existing.co_the_sua

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
    const today = new Date().toISOString().slice(0, 10)
    const d30 = new Date(); d30.setDate(d30.getDate() + 30)
    setDrugs((prev) => [...prev, {
      ...EMPTY_DRUG,
      ngay_bat_dau: today,
      ngay_ket_thuc: d30.toISOString().slice(0, 10),
    }])
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
              <input type="date" className="input" readOnly={isReadOnly}
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
                        <label className="input-label text-[10px]">Ngày bắt đầu</label>
                        <input type="date" className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.ngay_bat_dau}
                          onChange={(e) => updateDrug(i, 'ngay_bat_dau', e.target.value)} />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Ngày kết thúc</label>
                        <input type="date" className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.ngay_ket_thuc}
                          onChange={(e) => updateDrug(i, 'ngay_ket_thuc', e.target.value)} />
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

            <div className={`flex justify-end gap-3 border-t border-slate-100 pt-1 ${isReadOnly ? '' : ''}`}>
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
  onConfirm: (ly_do: string) => void
  onClose: () => void
}

function ReasonModal({ title, description, confirmLabel, onConfirm, onClose }: ReasonModalProps) {
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
        />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Đóng</button>
          <button
            onClick={() => { if (ly_do.trim()) onConfirm(ly_do) }}
            disabled={!ly_do.trim()}
            className="btn-primary disabled:opacity-40"
          >
            {confirmLabel}
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

  // ── Filter & search (pattern từ ManageServices) ───────────────────────────────
  const [tab, setTab] = useState<Tab>('today')
  const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'confirmed' | 'cancelled'>('')
  const [filterLoai, setFilterLoai] = useState<'' | 'clinic' | 'home'>('')
  const [searchInput, setSearchInput] = useState('')   // giá trị đang gõ
  const [search, setSearch] = useState('')              // debounced 300ms

  // ── Sort ──────────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('ngay_kham')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [bulkRejecting, setBulkRejecting] = useState(false)
  const [examAppt, setExamAppt] = useState<DoctorAppointmentDetail | null>(null)

  // ── Toast (pattern từ ManageServices) ────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // Debounce 300ms — không filter ngay khi gõ từng ký tự
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ─────────────────────────────────────────────────────────────────────────────
  // Load dữ liệu lần đầu
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    doctorAppointmentService.getAll()
      .then(setAll)
      .finally(() => setLoading(false))
  }, [])

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Urgent count: pending chưa xử lý hôm nay (không tính hết hạn)
  // ─────────────────────────────────────────────────────────────────────────────
  const urgentCount = useMemo(
    () => all.filter((a) => a.ngay_kham === todayStr && a.status === 'pending').length,
    [all, todayStr],
  )

  // Pending đã quá ngày khám — không thể xác nhận, cần đóng hồ sơ
  const expiredPending = useMemo(
    () => all.filter((a) => a.status === 'pending' && a.ngay_kham < todayStr),
    [all, todayStr],
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Badge count tab — KHÔNG bị ảnh hưởng bởi search hay status filter
  // ─────────────────────────────────────────────────────────────────────────────
  function tabCount(t: Tab) {
    // unconfirmed: chỉ đếm pending chưa hết hạn — expired hiển thị riêng ở banner
    if (t === 'unconfirmed') return all.filter((a) => a.status === 'pending' && a.ngay_kham >= todayStr).length
    if (t === 'today') return all.filter((a) => a.ngay_kham === todayStr).length
    if (t === 'upcoming') return all.filter((a) => a.ngay_kham > todayStr).length
    if (t === 'past') return all.filter((a) => a.ngay_kham < todayStr).length
    return all.length
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lọc + sort — áp dụng tab + status + search + sortKey/Dir
  // ─────────────────────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...all]

    // Lọc theo tab
    // unconfirmed: chỉ hiện pending chưa hết hạn — expired pending xử lý qua banner riêng
    if (tab === 'unconfirmed') list = list.filter((a) => a.status === 'pending' && a.ngay_kham >= todayStr)
    else if (tab === 'today') list = list.filter((a) => a.ngay_kham === todayStr)
    else if (tab === 'upcoming') list = list.filter((a) => a.ngay_kham > todayStr)
    else if (tab === 'past') list = list.filter((a) => a.ngay_kham < todayStr)

    // Lọc trạng thái (ẩn khi đang ở tab 'unconfirmed' vì đã mặc định = pending)
    if (filterStatus && tab !== 'unconfirmed') {
      list = list.filter((a) => a.status === filterStatus)
    }

    // Lọc hình thức
    if (filterLoai) list = list.filter((a) => a.loai_kham === filterLoai)

    // Tìm kiếm theo tên hoặc số điện thoại (debounced)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (a) => a.benh_nhan.toLowerCase().includes(q) || a.so_dien_thoai.includes(q),
      )
    }

    // Sắp xếp theo cột đang chọn
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'ngay_kham') {
        cmp = a.ngay_kham.localeCompare(b.ngay_kham) || a.gio_kham.localeCompare(b.gio_kham)
      } else if (sortKey === 'benh_nhan') {
        cmp = a.benh_nhan.localeCompare(b.benh_nhan, 'vi', { sensitivity: 'base' })
      } else if (sortKey === 'gia_kham') {
        cmp = a.gia_kham - b.gia_kham
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [all, tab, filterStatus, filterLoai, search, sortKey, sortDir, todayStr])

  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setSortKey('ngay_kham')
    setSortDir(newTab === 'past' ? 'desc' : 'asc')
    if (newTab === 'unconfirmed') setFilterStatus('')
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="text-[11px] text-slate-300">⇅</span>
    return <span className="text-[11px] text-brand-500">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: pending đã quá ngày
  // ─────────────────────────────────────────────────────────────────────────────
  function isExpiredPending(a: DoctorAppointmentDetail) {
    return a.status === 'pending' && a.ngay_kham < todayStr
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cập nhật 1 record trong state
  // ─────────────────────────────────────────────────────────────────────────────
  function updateAppt(id: number, data: Partial<DoctorAppointmentDetail>) {
    setAll((prev) => prev.map((a) => a.id === id ? { ...a, ...data } : a))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────────
  async function handleConfirm(id: number) {
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

  async function handleReject(id: number, ly_do: string) {
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

  async function handleComplete(id: number) {
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

  async function handleCancelConfirmed(id: number, ly_do: string) {
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

  // Từ chối hàng loạt tất cả pending đã hết hạn
  // Lý do tự điền sẵn: cron job thực tế sẽ làm việc này, UI cho phép bác sĩ đóng thủ công
  async function handleBulkRejectExpired() {
    if (bulkRejecting || expiredPending.length === 0) return
    setBulkRejecting(true)
    const LY_DO = 'Lịch hẹn đã quá ngày khám, không thể tiến hành xác nhận'
    let count = 0
    try {
      for (const appt of expiredPending) {
        try {
          const updated = await doctorAppointmentService.reject(appt.id, LY_DO)
          updateAppt(appt.id, {
            status: 'cancelled',
            ly_do_huy: LY_DO,
            payment_status: updated.payment_status,
          })
          count++
        } catch { /* bỏ qua lỗi từng record, tiếp tục record kế */ }
      }
      showToast(`Đã đóng hồ sơ ${count} lịch hẹn hết hạn`)
    } finally {
      setBulkRejecting(false)
    }
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
          description="Quản lý và xử lý lịch hẹn từ bệnh nhân."
        />

        {/* Banner cảnh báo urgent */}
        {urgentCount > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Có <strong>{urgentCount}</strong> lịch hẹn chưa tiến hành xác nhận — vui lòng xử lý.
            </span>
            <button
              onClick={() => handleTabChange('unconfirmed')}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
            >
              Xem ngay
            </button>
          </div>
        )}

        {/* ── Filter row 1: Tab thời gian ── */}
        <div className="mb-2 card flex gap-1 p-1.5 w-fit">
          {TIME_TABS.map(({ key, label }) => {
            const count = tabCount(key)
            const isActive = tab === key
            const isUrgent = key === 'unconfirmed' && count > 0
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`relative whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isActive
                    ? isUrgent ? 'bg-amber-500 text-white' : 'bg-brand-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive
                    ? 'bg-white/20 text-white'
                    : isUrgent
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Filter row 2: Hình thức + Trạng thái + Tìm kiếm ── */}
        <div className="mb-3 flex flex-wrap items-center gap-3">

          {/* Hình thức — luôn đứng đầu, không bị đẩy khi đổi tab */}
          <select
            value={filterLoai}
            onChange={(e) => setFilterLoai(e.target.value as typeof filterLoai)}
            className="input w-auto min-w-[170px]"
          >
            <option value="">Tất cả hình thức</option>
            <option value="clinic">Tại phòng khám</option>
            <option value="home">Tại nhà</option>
          </select>

          {/* Trạng thái — ẩn khi tab Chưa xác nhận (đã ngầm lọc pending) */}
          {tab !== 'unconfirmed' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="input w-auto min-w-[170px]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          )}

          {/* Tìm kiếm */}
          <div className="relative min-w-[200px] flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc số điện thoại..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input w-full pl-9"
            />
          </div>
        </div>

        {/* Banner hết hạn — chỉ hiện ở tab Chưa xác nhận khi có lịch quá ngày chưa đóng */}
        {tab === 'unconfirmed' && expiredPending.length > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <Icon name="clock" className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Có <strong>{expiredPending.length}</strong> lịch hẹn đã quá ngày khám chưa được đóng hồ sơ.
              {expiredPending.some((a) => a.payment_status === 'paid') && (
                <span className="ml-1 font-medium">Lịch đã thanh toán sẽ được hoàn tiền tự động.</span>
              )}
            </span>
            <button
              onClick={handleBulkRejectExpired}
              disabled={bulkRejecting}
              className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              {bulkRejecting ? 'Đang xử lý...' : 'Đóng tất cả'}
            </button>
          </div>
        )}

        {/* ── Bảng ── */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th onClick={() => handleSort('benh_nhan')} className={TH_SORT}>
                      <div className="flex items-center gap-1">Bệnh nhân {sortIcon('benh_nhan')}</div>
                    </th>
                    <th onClick={() => handleSort('ngay_kham')} className={TH_SORT}>
                      <div className="flex items-center gap-1">Ngày / Giờ {sortIcon('ngay_kham')}</div>
                    </th>
                    <th className={TH_PLAIN}>Hình thức</th>
                    <th className={TH_PLAIN}>Trạng thái</th>
                    <th onClick={() => handleSort('gia_kham')} className={TH_SORT}>
                      <div className="flex items-center gap-1">Phí {sortIcon('gia_kham')}</div>
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {displayed.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Icon name="calendar" className="h-10 w-10 text-slate-200" />
                          <p className="text-base font-medium text-slate-500">
                            {search
                              ? `Không tìm thấy lịch hẹn khớp với "${search}"`
                              : tab === 'unconfirmed'
                                ? 'Không có lịch hẹn nào cần xác nhận.'
                                : 'Không có lịch hẹn nào.'}
                          </p>
                          {search && (
                            <button
                              onClick={() => setSearchInput('')}
                              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              Xoá tìm kiếm
                            </button>
                          )}
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
                          {/* Bệnh nhân */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                                {appt.benh_nhan.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{appt.benh_nhan}</p>
                                <p className="text-xs text-slate-400">{appt.so_dien_thoai}</p>
                              </div>
                            </div>
                          </td>

                          {/* Ngày / Giờ + Dịch vụ */}
                          <td className="px-4 py-3 text-slate-600">
                            <div className="font-medium">{formatDate(appt.ngay_kham)}</div>
                            <div className="text-xs text-slate-400">{appt.gio_kham}</div>
                            {appt.ten_dich_vu && (
                              <div className="mt-0.5 text-xs text-brand-500">{appt.ten_dich_vu}</div>
                            )}
                          </td>

                          {/* Hình thức + địa điểm */}
                          <td className="px-4 py-3">
                            {appt.loai_kham === 'home' ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex w-fit items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                                  <Icon name="home" className="h-3 w-3" />
                                  Tại nhà
                                </span>
                                {appt.dia_chi_kham && (
                                  <span className="max-w-[160px] text-[10px] leading-tight text-purple-500">
                                    <Icon name="map-pin" className="mr-0.5 inline h-2.5 w-2.5" />
                                    {appt.dia_chi_kham}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm text-slate-600">{LOAI_LABEL[appt.loai_kham]}</span>
                                {appt.phong_kham && (
                                  <span className="text-[10px] font-medium text-green-600">
                                    <Icon name="hospital" className="mr-0.5 inline h-2.5 w-2.5" />
                                    {appt.phong_kham}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Trạng thái */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge color={STATUS_COLOR[appt.status]}>
                                {APPOINTMENT_STATUS_LABEL[appt.status]}
                              </Badge>
                              {isExpiredPending(appt) && (
                                <Badge color="gray">Hết hạn</Badge>
                              )}
                              <span className={`text-[10px] font-medium ${appt.payment_status === 'paid' ? 'text-blue-500' :
                                  appt.payment_status === 'refunded' ? 'text-slate-400' :
                                    'text-amber-500'
                                }`}>
                                {PAYMENT_STATUS_LABEL[appt.payment_status]}
                              </span>
                            </div>
                          </td>

                          {/* Phí */}
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {formatPrice(appt.gia_kham)}
                          </td>

                          {/* Thao tác */}
                          <td className="px-4 py-3">
                            <div
                              className="flex flex-col items-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5">
                                {/* PENDING */}
                                {appt.status === 'pending' && (
                                  <>
                                    {/* Xác nhận — Luồng C: BS confirm bất kể đã trả tiền chưa, chỉ chặn khi hết hạn */}
                                    {!isExpiredPending(appt) && (
                                      <button
                                        onClick={() => handleConfirm(appt.id)}
                                        disabled={actionLoading === appt.id}
                                        className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600 transition-colors hover:bg-green-100 disabled:opacity-50"
                                      >
                                        <Icon name="check" className="h-3 w-3" /> Xác nhận
                                      </button>
                                    )}
                                    {/* Từ chối — luôn hiện cho pending (kể cả hết hạn, unpaid) */}
                                    <button
                                      onClick={() => setRejectId(appt.id)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                                    >
                                      <Icon name="x" className="h-3 w-3" /> Từ chối
                                    </button>
                                  </>
                                )}

                                {/* CONFIRMED */}
                                {appt.status === 'confirmed' && (
                                  <>
                                    {/* Hoàn thành + Kết quả: chỉ khi ngày khám đã đến (hôm nay hoặc đã qua) */}
                                    {appt.ngay_kham <= todayStr && (
                                      <>
                                        <button
                                          onClick={() => handleComplete(appt.id)}
                                          disabled={actionLoading === appt.id}
                                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 disabled:opacity-50"
                                        >
                                          <Icon name="check" className="h-3 w-3" /> Hoàn thành
                                        </button>
                                        <button
                                          onClick={() => setExamAppt(appt)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                                        >
                                          <Icon name="edit" className="h-3 w-3" /> Kết quả
                                        </button>
                                      </>
                                    )}
                                    {/* Hủy: luôn hiện — bác sĩ hủy bất kỳ thời điểm → hoàn tiền 100% */}
                                    <button
                                      onClick={() => setCancelId(appt.id)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                                    >
                                      <Icon name="x" className="h-3 w-3" /> Hủy
                                    </button>
                                  </>
                                )}

                                {/* COMPLETED */}
                                {appt.status === 'completed' && (
                                  <button
                                    onClick={() => setExamAppt(appt)}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${appt.da_co_ket_qua
                                        ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                                        : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                                      }`}
                                  >
                                    <Icon
                                      name={appt.da_co_ket_qua ? 'eye' : 'edit'}
                                      className="h-3 w-3"
                                    />
                                    {appt.da_co_ket_qua ? 'Xem kết quả' : 'Nhập kết quả'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {expandedId === appt.id && (
                          <tr className="bg-brand-50/30">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="space-y-3 text-sm">

                                {/* Tầng 1: thông tin nhỏ gọn — flex-wrap để tự điền, không tạo khoảng trống */}
                                <div className="flex flex-wrap gap-x-8 gap-y-3">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Số điện thoại</p>
                                    <p className="mt-0.5 text-slate-700">{appt.so_dien_thoai}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Thanh toán</p>
                                    <p className="mt-0.5">
                                      <Badge color={PAYMENT_COLOR[appt.payment_status]}>
                                        {PAYMENT_STATUS_LABEL[appt.payment_status]}
                                      </Badge>
                                    </p>
                                  </div>
                                  {appt.tuoi !== undefined && (
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tuổi / Giới tính</p>
                                      <p className="mt-0.5 text-slate-700">{appt.tuoi} tuổi · {appt.gioi_tinh}</p>
                                    </div>
                                  )}
                                  {appt.ten_dich_vu && (
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dịch vụ</p>
                                      <p className="mt-0.5 text-slate-700">{appt.ten_dich_vu}</p>
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

                              </div>
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
          return (
            <ReasonModal
              title="Hủy lịch đã xác nhận"
              description={hasPaid
                ? 'Bác sĩ hủy → bệnh nhân được hoàn tiền 100% bất kể thời điểm.'
                : 'Bác sĩ hủy → lịch hẹn sẽ bị hủy. Bệnh nhân chưa thanh toán nên không có hoàn tiền.'}
              confirmLabel="Xác nhận hủy"
              onConfirm={(ly_do) => handleCancelConfirmed(cancelId, ly_do)}
              onClose={() => setCancelId(null)}
            />
          )
        })()}

        {examAppt && (
          <ExamModal
            appt={examAppt}
            onClose={() => setExamAppt(null)}
            onSaved={() => {
              updateAppt(examAppt.id, { da_co_ket_qua: true })
              showToast('Đã lưu kết quả khám')
              setExamAppt(null)
            }}
          />
        )}
      </div>
    </>
  )
}
