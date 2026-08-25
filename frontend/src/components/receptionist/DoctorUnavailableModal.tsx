import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DoctorOperationalStatus,
  DoctorUnavailablePreview,
  ReportDoctorUnavailableResult,
  SuddenLeaveSkippedAppointment,
  receptionistBookingService,
} from '@/services/receptionist-booking.service'
import QueueTransferModal, { QueueTransferCandidate } from '@/components/receptionist/QueueTransferModal'
import TimelinePanel from '@/components/receptionist/TimelinePanel'

interface Props {
  doctorId: string
  doctorName: string
  defaultDate: string
  onClose: () => void
  onDone: () => void
}

// Cung dinh nghia voi Dashboard.tsx (E-4) — bac si o cac trang thai nay khong the nhan
// them luot chuyen, khong hien trong danh sach ung vien.
const KHONG_THE_NHAN_CHUYEN = ['khong_co_lich', 'tam_nghi', 'nghi_phep', 'nghi_viec']

function candidatesFor(doctorStatuses: DoctorOperationalStatus[], specialtyId: string | null, currentDoctorId: string): QueueTransferCandidate[] {
  return doctorStatuses
    .filter((doctor) => doctor.doctor_id !== currentDoctorId)
    .filter((doctor) => !KHONG_THE_NHAN_CHUYEN.includes(doctor.trang_thai_van_hanh))
    .filter((doctor) => !specialtyId || (doctor.specialties ?? []).some((specialty) => specialty.id === specialtyId))
    .map((doctor) => ({
      doctor_id: doctor.doctor_id,
      ten_bac_si: doctor.ten_bac_si,
      so_dang_cho: doctor.so_dang_cho,
      phong_kham: doctor.phong_kham,
    }))
}

export default function DoctorUnavailableModal({ doctorId, doctorName, defaultDate, onClose, onDone }: Props) {
  const [tuNgay, setTuNgay] = useState(defaultDate)
  const [denNgay, setDenNgay] = useState(defaultDate)
  const [gioBatDau, setGioBatDau] = useState('')
  const [gioKetThuc, setGioKetThuc] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<DoctorUnavailablePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [result, setResult] = useState<ReportDoctorUnavailableResult | null>(null)
  const [doctorStatuses, setDoctorStatuses] = useState<DoctorOperationalStatus[]>([])
  const [transferTarget, setTransferTarget] = useState<{ item: SuddenLeaveSkippedAppointment } | null>(null)
  const [timelineApptId, setTimelineApptId] = useState<string | null>(null)

  useEffect(() => {
    receptionistBookingService.getDoctorOperationalStatuses().then(setDoctorStatuses).catch(() => {})
  }, [])

  const xemAnhHuong = async () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do bác sĩ nghỉ đột xuất.')
      return
    }
    setPreviewLoading(true)
    setPreviewError('')
    setError('')
    try {
      const res = await receptionistBookingService.previewDoctorUnavailable({
        doctor_id: doctorId,
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        gio_bat_dau: gioBatDau || undefined,
        gio_ket_thuc: gioKetThuc || undefined,
      })
      setPreview(res)
    } catch (requestError: any) {
      setPreviewError(requestError?.response?.data?.message || 'Không thể xem trước ảnh hưởng.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const submit = async () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do bác sĩ nghỉ đột xuất.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await receptionistBookingService.reportDoctorUnavailable({
        doctor_id: doctorId,
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        gio_bat_dau: gioBatDau || undefined,
        gio_ket_thuc: gioKetThuc || undefined,
        reason: reason.trim(),
      })
      setResult(res)
      onDone()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể ghi nhận bác sĩ nghỉ đột xuất.')
    } finally {
      setSubmitting(false)
    }
  }

  const canDieuPhoi = result?.can_dieu_phoi_tai_quay.filter((item) => item.ly_do_bo_qua === 'da_checkin_can_dieu_phoi_tai_quay') ?? []
  const dangTrongPhong = result?.can_dieu_phoi_tai_quay.filter((item) => item.ly_do_bo_qua === 'benh_nhan_dang_trong_phong') ?? []
  const canLienHeThuCong = (result?.de_xuat_doi.filter((p) => p.can_lien_he_thu_cong).length ?? 0)
    + (result?.can_dieu_phoi_tai_quay.filter((item) => item.ly_do_bo_qua === 'trang_thai_khong_cho_phep_tao_de_xuat' || item.ly_do_bo_qua === 'de_xuat_doi_da_xu_ly').length ?? 0)
  const daTuDongDeXuat = result?.de_xuat_doi.filter((p) => !p.can_lien_he_thu_cong).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800">Báo bác sĩ nghỉ đột xuất</h3>
        <p className="mt-1 text-sm text-slate-500">{doctorName}</p>

        {!result ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Từ ngày<input type="date" value={tuNgay} disabled={previewLoading} onChange={(event) => { setTuNgay(event.target.value); setPreview(null) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60" /></label>
              <label className="text-sm font-medium text-slate-700">Đến ngày<input type="date" value={denNgay} disabled={previewLoading} onChange={(event) => { setDenNgay(event.target.value); setPreview(null) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60" /></label>
              <label className="text-sm font-medium text-slate-700">Từ giờ (để trống = nghỉ cả ca/ngày)<input type="time" value={gioBatDau} disabled={previewLoading} onChange={(event) => { setGioBatDau(event.target.value); setPreview(null) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60" /></label>
              <label className="text-sm font-medium text-slate-700">Đến giờ<input type="time" value={gioKetThuc} disabled={previewLoading} onChange={(event) => { setGioKetThuc(event.target.value); setPreview(null) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60" /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Lý do *<textarea rows={2} value={reason} disabled={previewLoading} onChange={(event) => { setReason(event.target.value); setPreview(null) }} placeholder="Vd: bác sĩ đột ngột ốm, việc gia đình khẩn cấp..." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60" /></label>
            </div>
            <p className="mt-3 text-xs text-slate-500">Hệ thống sẽ tự tìm phương án dời cho toàn bộ lịch bị ảnh hưởng (bác sĩ khác cùng khung → khung khác trong ngày), giữ nguyên giá, không hoàn tiền theo quy định (chỉ giữ quyền dời lịch).</p>
            {previewError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{previewError}</p>}

            {preview && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <p className="font-bold">Sẽ ảnh hưởng {preview.so_lich_anh_huong} lịch hẹn:</p>
                <ul className="mt-1 list-disc pl-5">
                  <li>{preview.so_da_thanh_toan} đã thanh toán</li>
                  <li>{preview.so_da_checkin} đã check-in (phải chuyển bác sĩ tại quầy, không dời lịch)</li>
                  <li>{preview.so_chua_thanh_toan} chưa thanh toán</li>
                </ul>
                <p className="mt-1">{preview.so_slot_se_khoa} slot sẽ bị khoá.</p>
              </div>
            )}

            {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                {preview ? 'Để sau — chưa xác nhận' : 'Hủy bỏ'}
              </button>
              {!preview ? (
                <button type="button" onClick={() => void xemAnhHuong()} disabled={previewLoading} className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {previewLoading ? 'Đang kiểm tra...' : 'Xem ảnh hưởng'}
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={submitting} className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? 'Đang xử lý...' : 'Xác nhận báo nghỉ'}
                </button>
              )}
            </div>
          </>
        ) : result.can_admin_duyet ? (
          // C1 (2026-08-25): khoảng nghỉ >1 ngày -> BE chỉ TẠO đơn ('cho_duyet'), CHƯA khoá
          // slot / sinh đề xuất nào. Không được hiện như thành công đã xử lý xong (emerald) —
          // dễ hiểu lầm "xong rồi" trong khi mọi việc còn nguyên, chờ Admin.
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-bold">Đã tạo đơn báo nghỉ — CHƯA được xử lý.</p>
              <p className="mt-1">
                Khoảng nghỉ dài hơn 1 ngày nên vượt thẩm quyền lễ tân — đơn cần <strong>Admin duyệt</strong> trước
                khi hệ thống khoá slot và tìm phương án cho khách. Hiện tại chưa có slot nào bị khoá, chưa có
                lịch hẹn nào được xử lý, khách chưa được thông báo gì.
              </p>
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Đóng</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Đã ghi nhận {result.so_lich_bi_anh_huong} lịch bị ảnh hưởng · {daTuDongDeXuat} lịch đã có đề xuất tự động (khách sẽ được thông báo/nhắc gọi) · {result.so_slot_da_khoa} slot cũ đã khoá.
            </div>

            {canDieuPhoi.length > 0 && (
              <div>
                <p className="text-sm font-bold text-slate-800">Cần chuyển bác sĩ ngay tại quầy ({canDieuPhoi.length})</p>
                <p className="text-xs text-slate-500">Khách đã check-in, đang ngồi chờ — không dời lịch được, phải chuyển sang bác sĩ khác cùng chuyên khoa.</p>
                <div className="mt-2 space-y-2">
                  {canDieuPhoi.map((item) => (
                    <div key={item.appointment_id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{item.ten_khach || 'Khách'} · {item.gio_kham}{item.hang_doi?.ma_so_thu_tu ? ` · STT ${item.hang_doi.ma_so_thu_tu}` : ''}</p>
                        <p className="text-xs text-slate-500">{item.ma_lich_hen}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setTimelineApptId(item.appointment_id)} className="min-h-9 rounded-lg bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200">Lịch sử</button>
                        {item.hang_doi && (
                          <button type="button" onClick={() => setTransferTarget({ item })} className="min-h-9 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700">Chuyển bác sĩ</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dangTrongPhong.length > 0 && (
              <p className="text-xs text-slate-500">{dangTrongPhong.length} lịch đang trong phòng khám — không cần điều phối.</p>
            )}

            {canLienHeThuCong > 0 && (
              <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
                {canLienHeThuCong} lượt cần lễ tân liên hệ trực tiếp (khách không có tài khoản, không tìm được phương án, hoặc chờ duyệt ở trên). Xem tại{' '}
                <a href="/receptionist/contact-tasks" className="font-semibold underline">Liên Hệ Khách Hàng</a>.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Đóng</button>
              {/* Modal không phải chỗ để duyệt từng người một — bảng điều phối nhìn được
                  toàn cục và có duyệt hàng loạt (C1). */}
              <Link
                to={`/receptionist/dieu-phoi/${result.leave_id}`}
                onClick={onClose}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Sang trang điều phối →
              </Link>
            </div>
          </div>
        )}
      </div>

      {transferTarget?.item.hang_doi && (
        <QueueTransferModal
          hangDoiId={transferTarget.item.hang_doi.hang_doi_id}
          tenBenhNhan={transferTarget.item.ten_khach || 'Khách'}
          maSoThuTu={transferTarget.item.hang_doi.ma_so_thu_tu}
          candidates={candidatesFor(doctorStatuses, transferTarget.item.specialty_id ?? null, transferTarget.item.doctor_id ?? doctorId)}
          onClose={() => setTransferTarget(null)}
          onTransferred={() => setTransferTarget(null)}
        />
      )}

      {timelineApptId && (
        <TimelinePanel
          loai="lich_hen"
          id={timelineApptId}
          title="Lịch sử thao tác lịch hẹn"
          onClose={() => setTimelineApptId(null)}
        />
      )}
    </div>
  )
}
