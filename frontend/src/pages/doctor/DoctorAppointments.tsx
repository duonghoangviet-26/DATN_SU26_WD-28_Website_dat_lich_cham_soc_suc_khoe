import { useEffect, useRef, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { examinationService } from '@/services/examination.service'
import type { DoctorAppointmentDetail, ExaminationResult, PrescriptionDrug } from '@/types'
import { APPOINTMENT_STATUS_LABEL } from '@/utils/constants'
import { formatDate, formatPrice } from '@/utils/format'

type Tab = 'today' | 'upcoming' | 'past' | 'all'

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'past', label: 'Đã qua' },
  { key: 'all', label: 'Tất cả' },
]

const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow', confirmed: 'blue', completed: 'green', cancelled: 'red',
}

const LOAI_LABEL: Record<string, string> = {
  clinic: 'Tại phòng khám', home: 'Tại nhà', video: 'Video',
}

const EMPTY_DRUG: Omit<PrescriptionDrug, 'id'> = {
  ten_thuoc: '', lieu_dung: '', tan_suat: '2 lần/ngày', so_ngay: 7, ghi_chu: '',
}

// ─── Examination modal ────────────────────────────────────────────────────────
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
        setDrugs(res.thuoc.map(({ ten_thuoc, lieu_dung, tan_suat, so_ngay, ghi_chu }) => ({ ten_thuoc, lieu_dung, tan_suat, so_ngay, ghi_chu })))
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
  function updateDrug<K extends keyof Omit<PrescriptionDrug, 'id'>>(i: number, key: K, val: Omit<PrescriptionDrug, 'id'>[K]) {
    setDrugs((prev) => prev.map((d, idx) => idx === i ? { ...d, [key]: val } : d))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div ref={topRef} className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="font-semibold text-slate-800">Kết quả khám</p>
            <p className="text-sm text-slate-500">{appt.benh_nhan} · {formatDate(appt.ngay_kham)} {appt.gio_kham}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><Icon name="x" className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
        ) : (
          <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
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

            {/* Prescription */}
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
                          value={drug.ten_thuoc} onChange={(e) => updateDrug(i, 'ten_thuoc', e.target.value)}
                          placeholder="VD: Paracetamol 500mg" />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Liều dùng</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.lieu_dung} onChange={(e) => updateDrug(i, 'lieu_dung', e.target.value)}
                          placeholder="VD: 1 viên/lần" />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Tần suất</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.tan_suat} onChange={(e) => updateDrug(i, 'tan_suat', e.target.value)}
                          placeholder="VD: 3 lần/ngày" />
                      </div>
                      <div>
                        <label className="input-label text-[10px]">Số ngày</label>
                        <input type="number" min={1} className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.so_ngay} onChange={(e) => updateDrug(i, 'so_ngay', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="input-label text-[10px]">Ghi chú</label>
                        <input className="input py-1.5 text-sm" readOnly={isReadOnly}
                          value={drug.ghi_chu} onChange={(e) => updateDrug(i, 'ghi_chu', e.target.value)}
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

            {!isReadOnly && (
              <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
                <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : (existing ? 'Cập nhật' : 'Lưu kết quả')}
                </button>
              </div>
            )}
            {isReadOnly && (
              <div className="flex justify-end pt-1 border-t border-slate-100">
                <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Reject modal ─────────────────────────────────────────────────────────────
interface RejectModalProps {
  onConfirm: (ly_do: string) => void
  onClose: () => void
}

function RejectModal({ onConfirm, onClose }: RejectModalProps) {
  const [ly_do, setLyDo] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="font-semibold text-slate-800">Từ chối lịch hẹn</p>
        <p className="mt-1 text-sm text-slate-500">Vui lòng nêu lý do từ chối để bệnh nhân được biết.</p>
        <textarea className="input mt-3 resize-none" rows={3} placeholder="Lý do từ chối..."
          value={ly_do} onChange={(e) => setLyDo(e.target.value)} />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button
            onClick={() => { if (ly_do.trim()) onConfirm(ly_do) }}
            disabled={!ly_do.trim()}
            className="btn-primary disabled:opacity-40">Xác nhận từ chối</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DoctorAppointments() {
  const [all, setAll] = useState<DoctorAppointmentDetail[]>([])
  const [tab, setTab] = useState<Tab>('today')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [examAppt, setExamAppt] = useState<DoctorAppointmentDetail | null>(null)

  useEffect(() => {
    doctorAppointmentService.getAll({ tab: 'all' }).then(setAll).finally(() => setLoading(false))
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)

  function getByTab(t: Tab): DoctorAppointmentDetail[] {
    let list = [...all]
    if (t === 'today') list = list.filter((a) => a.ngay_kham === todayStr)
    else if (t === 'upcoming') list = list.filter((a) => a.ngay_kham > todayStr)
    else if (t === 'past') list = list.filter((a) => a.ngay_kham < todayStr)
    if (statusFilter) list = list.filter((a) => a.status === statusFilter)
    return list.sort((a, b) => a.ngay_kham.localeCompare(b.ngay_kham) || a.gio_kham.localeCompare(b.gio_kham))
  }

  const displayed = getByTab(tab)

  function tabCount(t: Tab) {
    let list = [...all]
    if (t === 'today') list = list.filter((a) => a.ngay_kham === todayStr)
    else if (t === 'upcoming') list = list.filter((a) => a.ngay_kham > todayStr)
    else if (t === 'past') list = list.filter((a) => a.ngay_kham < todayStr)
    return list.length
  }

  function updateAppt(id: number, data: Partial<DoctorAppointmentDetail>) {
    setAll((prev) => prev.map((a) => a.id === id ? { ...a, ...data } : a))
  }

  async function handleConfirm(id: number) {
    const updated = await doctorAppointmentService.confirm(id)
    updateAppt(id, { status: updated.status })
  }

  async function handleReject(id: number, ly_do: string) {
    await doctorAppointmentService.reject(id, ly_do)
    updateAppt(id, { status: 'cancelled', ly_do_huy: ly_do })
    setRejectId(null)
  }

  async function handleComplete(id: number) {
    const updated = await doctorAppointmentService.complete(id)
    updateAppt(id, { status: updated.status, da_co_ket_qua: updated.da_co_ket_qua })
  }

  return (
    <div>
      <PageHeader
        title="Lịch hẹn của tôi"
        description="Quản lý và xử lý lịch hẹn từ bệnh nhân."
      />

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
        {TAB_LABELS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
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

      {/* Filter */}
      <div className="mb-4">
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ xác nhận</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : displayed.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="calendar" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">Không có lịch hẹn nào.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Bệnh nhân</th>
                  <th className="px-4 py-3">Ngày / Giờ</th>
                  <th className="px-4 py-3">Hình thức</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Phí</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayed.map((appt) => (
                  <>
                    <tr
                      key={appt.id}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${expandedId === appt.id ? 'bg-brand-50' : ''}`}
                      onClick={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {appt.benh_nhan.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-800">{appt.benh_nhan}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{formatDate(appt.ngay_kham)}</div>
                        <div className="text-xs text-slate-400">{appt.gio_kham}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{LOAI_LABEL[appt.loai_kham]}</td>
                      <td className="px-4 py-3">
                        <Badge color={STATUS_COLOR[appt.status]}>
                          {APPOINTMENT_STATUS_LABEL[appt.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatPrice(appt.gia_kham)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {appt.status === 'pending' && (
                            <>
                              <button onClick={() => handleConfirm(appt.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600 transition-colors hover:bg-green-100">
                                <Icon name="check" className="h-3 w-3" /> Xác nhận
                              </button>
                              <button onClick={() => setRejectId(appt.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100">
                                <Icon name="x" className="h-3 w-3" /> Từ chối
                              </button>
                            </>
                          )}
                          {appt.status === 'confirmed' && (
                            <>
                              <button onClick={() => handleComplete(appt.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100">
                                <Icon name="check" className="h-3 w-3" /> Hoàn thành
                              </button>
                              <button onClick={() => setExamAppt(appt)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100">
                                <Icon name="edit" className="h-3 w-3" /> Kết quả
                              </button>
                            </>
                          )}
                          {appt.status === 'completed' && (
                            <button onClick={() => setExamAppt(appt)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                appt.da_co_ket_qua
                                  ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                                  : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                              }`}>
                              <Icon name={appt.da_co_ket_qua ? 'eye' : 'edit'} className="h-3 w-3" />
                              {appt.da_co_ket_qua ? 'Xem kết quả' : 'Nhập kết quả'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded patient detail row */}
                    {expandedId === appt.id && (
                      <tr key={`${appt.id}-detail`} className="bg-brand-50/40">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Số điện thoại</p>
                              <p className="mt-0.5 text-slate-700">{appt.so_dien_thoai}</p>
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
                                <p className="mt-0.5 text-red-600 font-medium">{appt.di_ung}</p>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {rejectId !== null && (
        <RejectModal
          onConfirm={(ly_do) => handleReject(rejectId, ly_do)}
          onClose={() => setRejectId(null)}
        />
      )}
      {examAppt && (
        <ExamModal
          appt={examAppt}
          onClose={() => setExamAppt(null)}
          onSaved={() => {
            updateAppt(examAppt.id, { da_co_ket_qua: true })
            setExamAppt(null)
          }}
        />
      )}
    </div>
  )
}
