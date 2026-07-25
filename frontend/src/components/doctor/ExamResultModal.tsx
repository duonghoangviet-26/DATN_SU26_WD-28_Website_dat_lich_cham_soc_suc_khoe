import React, { useEffect, useRef, useState } from 'react'
import Icon from '@/components/admin/icons'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { examinationService } from '@/services/examination.service'
import { stripEmptyDrugs } from '@/utils/prescription'
import { formatDate, toLocalDateStr } from '@/utils/format'
import type { DoctorAppointmentDetail, ExaminationResult, PrescriptionDrug, AppointmentStatus } from '@/types'

const EMPTY_DRUG: Omit<PrescriptionDrug, 'id'> = {
  ten_thuoc: '', lieu_luong: '', tan_suat: '2 lần/ngày',
  gio_uong: ['07:00'], so_ngay: 7, ghi_chu: '',
}

interface ExamResultModalProps {
  appt: DoctorAppointmentDetail
  // 'edit'   — trang Lịch hẹn: nhập/sửa kết quả (Lưu/Cập nhật).
  // 'confirm'— trang Hồ sơ chờ xác nhận: bác sĩ sửa trực tiếp rồi "Lưu & Xác nhận" 1 thao tác.
  mode?: 'edit' | 'confirm'
  onClose: () => void
  onSaved?: (result: ExaminationResult) => void          // sau khi Lưu (mode edit)
  onConfirmed?: (appointmentStatus: AppointmentStatus) => void // sau khi Lưu & Xác nhận (mode confirm)
  onRevisionRequested?: () => void // sau khi đánh dấu hồ sơ "cần chỉnh sửa" (mode confirm)
}

// Khối thông tin bệnh nhân — bác sĩ cần đủ dữ liệu lâm sàng (nhất là dị ứng/bệnh nền) để chẩn
// đoán & kê thuốc an toàn, không chỉ mỗi tên. Dữ liệu lấy từ chính lịch hẹn (getById).
function PatientInfoBlock({ appt, result }: { appt: DoctorAppointmentDetail; result: ExaminationResult | null }) {
  const canhBao = (label: string, value?: string | null) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {value?.trim()
        ? <p className="mt-0.5 font-medium text-red-600">{value}</p>
        : <p className="mt-0.5 text-slate-400">Không có</p>}
    </div>
  )
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold text-slate-800">{appt.benh_nhan}</p>
        <span className="text-slate-300">·</span>
        <span className="text-sm text-slate-600">{appt.tuoi != null ? `${appt.tuoi} tuổi` : '—'}</span>
        <span className="text-slate-300">·</span>
        <span className="text-sm text-slate-600">{appt.gioi_tinh ?? '—'}</span>
        <span className="text-slate-300">·</span>
        <span className="text-sm text-slate-600">{appt.so_dien_thoai ?? '—'}</span>
      </div>
      {appt.ly_do_kham && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lý do khám</p>
          <p className="mt-0.5 text-slate-700">{appt.ly_do_kham}</p>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {canhBao('Dị ứng', appt.di_ung)}
        {canhBao('Bệnh nền', appt.benh_nen)}
      </div>
      {result?.trieu_chung_ban_dau && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Triệu chứng ban đầu</p>
          <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{result.trieu_chung_ban_dau}</p>
        </div>
      )}
    </div>
  )
}

export default function ExamResultModal({ appt, mode = 'edit', onClose, onSaved, onConfirmed, onRevisionRequested }: ExamResultModalProps) {
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<ExaminationResult | null>(null)
  const [revisionReason, setRevisionReason] = useState('') // lý do đánh dấu hồ sơ "cần chỉnh sửa"
  const [chan_doan, setChanDoan] = useState('')
  const [huong_dan, setHuongDan] = useState('')
  const [ghi_chu, setGhiChu] = useState('')
  const [ngay_tai_kham, setNgayTaiKham] = useState('')
  // Sinh hiệu ban đầu — bác sĩ tự đo/nhập ngay khi khám (không có API đọc lại nên để trống,
  // gửi lên chỉ khi bác sĩ thực sự điền field nào đó).
  const [can_nang, setCanNang] = useState('')
  const [chieu_cao, setChieuCao] = useState('')
  const [huyet_ap, setHuyetAp] = useState('')
  const [nhiet_do, setNhietDo] = useState('')
  const [nhip_tim, setNhipTim] = useState('')
  // Đơn thuốc không bắt buộc — mặc định rỗng, bác sĩ bấm "Thêm thuốc" khi cần (2026-07-16).
  const [drugs, setDrugs] = useState<Omit<PrescriptionDrug, 'id'>[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    examinationService.getByAppointment(appt.id).then((res) => {
      if (res) {
        setExisting(res)
        setChanDoan(res.chan_doan)
        setHuongDan(res.huong_dan_dieu_tri)
        setGhiChu(res.ghi_chu ?? '')
        // res.ngay_tai_kham là ISO datetime đầy đủ; <input type="date"> chỉ nhận YYYY-MM-DD.
        setNgayTaiKham(res.ngay_tai_kham ? res.ngay_tai_kham.slice(0, 10) : '')
        setDrugs(res.thuoc.map(({ ten_thuoc, lieu_luong, tan_suat, gio_uong, so_ngay, ghi_chu }) => ({
          ten_thuoc, lieu_luong, tan_suat, gio_uong, so_ngay, ghi_chu,
        })))
      }
    }).finally(() => setLoading(false))
  }, [appt.id])

  // Hồ sơ đã xác nhận là CHỐT — khóa ngay lập tức (khớp backend updateResult, GAP-001).
  const isReadOnly = existing !== null && (existing.status === 'da_xac_nhan' || !existing.co_the_sua)
  // Chế độ xác nhận chỉ áp dụng khi hồ sơ đang chờ xác nhận.
  const canConfirm = mode === 'confirm' && existing?.status === 'cho_xac_nhan' && !isReadOnly

  // Ngày tái khám bắt buộc từ ngày tiếp theo trở đi — không được trùng ngày khám hoặc quá khứ.
  const minNgayTaiKham = (() => {
    const d = new Date(appt.ngay_kham)
    d.setDate(d.getDate() + 1)
    return toLocalDateStr(d)
  })()

  function buildPayload() {
    const coSinhHieu = [can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim].some((v) => v.trim() !== '')
    return {
      chan_doan,
      huong_dan_dieu_tri: huong_dan || null,
      ghi_chu: ghi_chu || null,
      ngay_tai_kham,
      thuoc: stripEmptyDrugs(drugs), // H2 — loại dòng thuốc rỗng trước khi gửi
      ...(coSinhHieu ? {
        sinh_hieu: {
          can_nang: can_nang.trim() ? Number(can_nang) : null,
          chieu_cao: chieu_cao.trim() ? Number(chieu_cao) : null,
          huyet_ap: huyet_ap.trim() || null,
          nhiet_do: nhiet_do.trim() ? Number(nhiet_do) : null,
          nhip_tim: nhip_tim.trim() ? Number(nhip_tim) : null,
        },
      } : {}),
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await examinationService.save({ appointment_id: appt.id, ...buildPayload() })
      onSaved?.(result)
    } catch {
      setError('Không lưu được kết quả khám. Vui lòng kiểm tra lại đơn thuốc và thử lại.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const updated = await doctorAppointmentService.confirmResult(appt.id, buildPayload())
      onConfirmed?.(updated.appointment_status)
    } catch {
      setError('Không thể lưu & xác nhận. Kiểm tra chẩn đoán/đơn thuốc (số ngày 1–90, giờ uống HH:MM) rồi thử lại.')
    } finally {
      setSaving(false)
    }
  }

  // "Yêu cầu chỉnh sửa" — đánh dấu hồ sơ cần sửa lại kèm lý do (thay vì xác nhận luôn).
  async function handleRequestRevision() {
    if (!revisionReason.trim()) {
      setError('Cần nêu lý do cần chỉnh sửa gì.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await doctorAppointmentService.requestRevision(appt.id, revisionReason.trim())
      onRevisionRequested?.()
    } catch {
      setError('Không gửi được yêu cầu chỉnh sửa. Vui lòng thử lại.')
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

  const primaryLabel = canConfirm
    ? (saving ? 'Đang lưu & xác nhận...' : 'Lưu & Xác nhận')
    : (saving ? 'Đang lưu...' : (existing ? 'Cập nhật' : 'Lưu kết quả'))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div ref={topRef} className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="font-semibold text-slate-800">{canConfirm ? 'Xác nhận hồ sơ khám' : 'Kết quả khám'}</p>
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
          <form onSubmit={canConfirm ? handleConfirm : handleSave} className="space-y-5 px-6 py-5">
            <PatientInfoBlock appt={appt} result={existing} />

            {isReadOnly && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <Icon name="clock" className="h-4 w-4 shrink-0" />
                Hồ sơ đã được xác nhận — không thể chỉnh sửa.
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!isReadOnly && (
              <div>
                <label className="input-label mb-2">Sinh hiệu ban đầu <span className="font-normal text-slate-400">(tùy chọn)</span></label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div>
                    <label className="input-label text-[10px]">Cân nặng (kg)</label>
                    <input type="number" min={0} step="0.1" className="input py-1.5 text-sm"
                      value={can_nang} onChange={(e) => setCanNang(e.target.value)} placeholder="VD: 60" />
                  </div>
                  <div>
                    <label className="input-label text-[10px]">Chiều cao (cm)</label>
                    <input type="number" min={0} step="0.1" className="input py-1.5 text-sm"
                      value={chieu_cao} onChange={(e) => setChieuCao(e.target.value)} placeholder="VD: 165" />
                  </div>
                  <div>
                    <label className="input-label text-[10px]">Huyết áp</label>
                    <input className="input py-1.5 text-sm"
                      value={huyet_ap} onChange={(e) => setHuyetAp(e.target.value)} placeholder="VD: 120/80" />
                  </div>
                  <div>
                    <label className="input-label text-[10px]">Nhiệt độ (°C)</label>
                    <input type="number" min={0} step="0.1" className="input py-1.5 text-sm"
                      value={nhiet_do} onChange={(e) => setNhietDo(e.target.value)} placeholder="VD: 37" />
                  </div>
                  <div>
                    <label className="input-label text-[10px]">Nhịp tim (bpm)</label>
                    <input type="number" min={0} className="input py-1.5 text-sm"
                      value={nhip_tim} onChange={(e) => setNhipTim(e.target.value)} placeholder="VD: 75" />
                  </div>
                </div>
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
                {drugs.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
                    Chưa kê đơn thuốc nào
                  </p>
                )}
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
                      {!isReadOnly && (
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

            {/* Yêu cầu chỉnh sửa: đánh dấu hồ sơ cần sửa lại kèm lý do (song song với "Lưu & Xác nhận"). */}
            {canConfirm && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                <label className="input-label text-xs">Lý do cần chỉnh sửa <span className="font-normal text-slate-400">(điền nếu muốn đánh dấu hồ sơ này cần sửa lại)</span></label>
                <textarea className="input resize-none bg-white" rows={2}
                  value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="VD: Bổ sung sinh hiệu, ghi rõ liều thuốc..." />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-3">
              <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
              {canConfirm && (
                <button type="button" onClick={handleRequestRevision} disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors">
                  {saving ? 'Đang gửi...' : 'Yêu cầu chỉnh sửa'}
                </button>
              )}
              {!isReadOnly && (
                <button type="submit" className="btn-primary" disabled={saving}>
                  {primaryLabel}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
