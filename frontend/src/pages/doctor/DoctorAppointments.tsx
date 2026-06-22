import { useEffect, useMemo, useRef, useState } from 'react'
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

type Tab = 'today' | 'upcoming' | 'past' | 'all'
type SortKey = 'ngay_kham' | 'benh_nhan' | 'gia_kham'

const TIME_TABS: { key: Tab; label: string }[] = [
  { key: 'today',    label: 'Hôm nay'  },
  { key: 'upcoming', label: 'Sắp tới'  },
  { key: 'past',     label: 'Đã qua'   },
  { key: 'all',      label: 'Tất cả'   },
]

const STATUS_TABS = [
  { value: '',           label: 'Tất cả'       },
  { value: 'pending',    label: 'Chờ xác nhận' },
  { value: 'confirmed',  label: 'Đã xác nhận'  },
  { value: 'completed',  label: 'Hoàn thành'   },
  { value: 'cancelled',  label: 'Đã hủy'       },
]

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow', confirmed: 'blue', completed: 'green', cancelled: 'red',
}

const PAYMENT_COLOR: Record<string, 'yellow' | 'blue' | 'gray'> = {
  unpaid: 'yellow', paid: 'blue', refunded: 'gray',
}

const LOAI_LABEL: Record<string, string> = {
  clinic: 'Tại phòng khám', home: 'Tại nhà', video: 'Video',
}

const TH_SORT = 'cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100'
const TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'

const EMPTY_DRUG: Omit<PrescriptionDrug, 'id'> = {
  ten_thuoc: '', lieu_dung: '', tan_suat: '2 lần/ngày', so_ngay: 7, ghi_chu: '',
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
        setNgayTaiKham(res.ngay_tai_kham)
        setDrugs(res.thuoc.map(({ ten_thuoc, lieu_dung, tan_suat, so_ngay, ghi_chu }) => ({
          ten_thuoc, lieu_dung, tan_suat, so_ngay, ghi_chu,
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
        ngay_tai_kham,
        thuoc: drugs,
      })
      onSaved(result)
    } finally {
      setSaving(false)
    }
  }

  function addDrug() { setDrugs((prev) => [...prev, { ...EMPTY_DRUG }]) }
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
                        <label className="input-label text-[10px]">Liều dùng</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.lieu_dung}
                          onChange={(e) => updateDrug(i, 'lieu_dung', e.target.value)}
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
                        <label className="input-label text-[10px]">Số ngày</label>
                        <input type="number" min={1} className="input py-1.5 text-sm"
                          readOnly={isReadOnly}
                          value={drug.so_ngay}
                          onChange={(e) => updateDrug(i, 'so_ngay', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="input-label text-[10px]">Ghi chú</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.ghi_chu}
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
  const [activeStatus, setActiveStatus] = useState('')
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
    doctorAppointmentService.getAll({ tab: 'all' })
      .then(setAll)
      .finally(() => setLoading(false))
  }, [])

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Urgent count: pending chưa xử lý hôm nay
  // ─────────────────────────────────────────────────────────────────────────────
  const urgentCount = useMemo(
    () => all.filter((a) => a.ngay_kham === todayStr && a.status === 'pending').length,
    [all, todayStr],
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Badge count tab — KHÔNG bị ảnh hưởng bởi search hay status filter
  // ─────────────────────────────────────────────────────────────────────────────
  function tabCount(t: Tab) {
    if (t === 'today')    return all.filter((a) => a.ngay_kham === todayStr).length
    if (t === 'upcoming') return all.filter((a) => a.ngay_kham > todayStr).length
    if (t === 'past')     return all.filter((a) => a.ngay_kham < todayStr).length
    return all.length
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lọc + sort — áp dụng tab + status + search + sortKey/Dir
  // ─────────────────────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...all]

    // Lọc theo tab thời gian
    if (tab === 'today')    list = list.filter((a) => a.ngay_kham === todayStr)
    else if (tab === 'upcoming') list = list.filter((a) => a.ngay_kham > todayStr)
    else if (tab === 'past')     list = list.filter((a) => a.ngay_kham < todayStr)

    // Lọc theo trạng thái
    if (activeStatus) list = list.filter((a) => a.status === activeStatus)

    // Tìm kiếm theo tên bệnh nhân (debounced)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((a) => a.benh_nhan.toLowerCase().includes(q))
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
  }, [all, tab, activeStatus, search, sortKey, sortDir, todayStr])

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
      updateAppt(id, { status: updated.status })
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
      await doctorAppointmentService.cancelConfirmed(id, ly_do)
      updateAppt(id, { status: 'cancelled', payment_status: 'refunded', ly_do_huy: ly_do })
      showToast('Đã hủy lịch — bệnh nhân được hoàn 100%')
    } catch {
      showToast('Không thể hủy lịch hẹn', 'error')
    }
    setCancelId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GIAO DIỆN
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast — góc trên phải, tự mất sau 3 giây */}
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
            <span>
              Có <strong>{urgentCount}</strong> lịch hôm nay chưa xác nhận — vui lòng xử lý.
            </span>
          </div>
        )}

        {/* ── Filter: Tab thời gian + Status tab + Search (pattern ManageServices) ── */}
        <div className="mb-3 flex flex-wrap items-center gap-3">

          {/* Tab thời gian */}
          <div className="card flex gap-1 p-1.5">
            {TIME_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tabCount(key)}
                </span>
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative min-w-[200px] flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên bệnh nhân..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input w-full pl-9"
            />
          </div>
        </div>

        {/* Status tab */}
        <div className="mb-4 card flex gap-1 p-1.5 w-fit">
          {STATUS_TABS.map((s) => (
            <button
              key={s.value}
              onClick={() => setActiveStatus(s.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeStatus === s.value
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

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
                      <>
                        {/* ── Row chính ── */}
                        <tr
                          key={appt.id}
                          className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                            expandedId === appt.id ? 'bg-brand-50/60' : ''
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

                          {/* Ngày / Giờ */}
                          <td className="px-4 py-3 text-slate-600">
                            <div className="font-medium">{formatDate(appt.ngay_kham)}</div>
                            <div className="text-xs text-slate-400">{appt.gio_kham}</div>
                          </td>

                          {/* Hình thức */}
                          <td className="px-4 py-3 text-slate-600">
                            {LOAI_LABEL[appt.loai_kham]}
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
                              <span className={`text-[10px] font-medium ${
                                appt.payment_status === 'paid'     ? 'text-blue-500'  :
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
                              className="flex items-center justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* PENDING */}
                              {appt.status === 'pending' && (
                                <>
                                  {/* Xác nhận — chỉ khi paid VÀ không hết hạn */}
                                  {appt.payment_status === 'paid' && !isExpiredPending(appt) && (
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
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                    appt.da_co_ket_qua
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
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {expandedId === appt.id && (
                          <tr key={`${appt.id}-detail`} className="bg-brand-50/30">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
                                {appt.ly_do_kham && (
                                  <div className="sm:col-span-2">
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
                            </td>
                          </tr>
                        )}
                      </>
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

        {cancelId !== null && (
          <ReasonModal
            title="Hủy lịch đã xác nhận"
            description="Bác sĩ hủy → bệnh nhân được hoàn tiền 100% bất kể thời điểm."
            confirmLabel="Xác nhận hủy"
            onConfirm={(ly_do) => handleCancelConfirmed(cancelId, ly_do)}
            onClose={() => setCancelId(null)}
          />
        )}

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
