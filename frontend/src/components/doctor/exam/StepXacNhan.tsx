import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { BuocKham, KetQuaHoanTat, PhienKham } from '@/services/doctor-exam-session.service'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { formatPrice, NHAN_KET_CUC_THAT } from '@/utils/format'

// Props giữ đúng { phien, saving, onNext } như 4 bước còn lại để là component thay thế
// trực tiếp cho ô placeholder trong ExamSessionPage. Thêm DUY NHẤT onEditStep — bắt buộc
// phải có vì nghiệp vụ yêu cầu mỗi khối tóm tắt có nút "Sửa" quay lại đúng bước đó, và
// bước đang xem (buocDangXem) chỉ tồn tại ở state của trang cha.
interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
  onEditStep: (buoc: BuocKham) => void
}

function extractApiMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message?.trim() || fallback
}

function KhoiTomTat({
  tieuDe, onSua, children,
}: {
  tieuDe: string
  onSua: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{tieuDe}</h3>
        <button
          type="button"
          onClick={onSua}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Sửa
        </button>
      </div>
      {children}
    </section>
  )
}

export default function StepXacNhan({ phien, onEditStep }: Props) {
  const navigate = useNavigate()
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [ketQua, setKetQua] = useState<KetQuaHoanTat | null>(null)
  const [calling, setCalling] = useState(false)

  async function hoanTat() {
    setCompleting(true)
    setCompleteError(null)
    try {
      const result = await doctorExamSessionService.complete(phien.queue.id)
      setKetQua(result)
    } catch (e) {
      setCompleteError(extractApiMessage(e, 'Hoàn tất ca khám thất bại, vui lòng thử lại'))
    } finally {
      setCompleting(false)
    }
  }

  async function goiBenhNhanKeTiep(queueId: string) {
    setCalling(true)
    try {
      await doctorAppointmentService.callQueuePatient(queueId)
    } catch {
      // im lặng — dù gọi lỗi (vd bệnh nhân vừa đổi trạng thái) vẫn cho bác sĩ quay về
      // hàng đợi để tự xử lý, không chặn điều hướng.
    } finally {
      setCalling(false)
      navigate('/doctor/pending-records')
    }
  }

  const hoSo = phien.ho_so
  const sinhHieu = phien.sinh_hieu

  // Màn kết quả sau khi hoàn tất — thay hẳn 4 khối tóm tắt.
  if (ketQua) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            ✓
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Đã hoàn tất ca khám cho {ketQua.ten_benh_nhan}</h2>
        </div>

        {ketQua.co_dich_vu_can_thu && (
          <div className="mx-auto max-w-md rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Đã báo lễ tân thu {formatPrice(ketQua.tong_tien_dich_vu)} dịch vụ.
          </div>
        )}

        {ketQua.benh_nhan_ke_tiep ? (
          <div className="mx-auto max-w-md rounded-lg border border-slate-200 p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bệnh nhân kế tiếp</p>
            <p className="text-base font-semibold text-slate-900">{ketQua.benh_nhan_ke_tiep.ten_benh_nhan}</p>
            {ketQua.benh_nhan_ke_tiep.ma_so_thu_tu && (
              <p className="text-sm text-slate-500">Số thứ tự {ketQua.benh_nhan_ke_tiep.ma_so_thu_tu}</p>
            )}
            <button
              type="button"
              disabled={calling}
              onClick={() => goiBenhNhanKeTiep(ketQua.benh_nhan_ke_tiep!.queue_id)}
              className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {calling ? 'Đang gọi...' : 'Gọi bệnh nhân này'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Đã hết bệnh nhân trong hàng đợi.</p>
        )}

        <div>
          <button
            type="button"
            onClick={() => navigate('/doctor/pending-records')}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Quay lại hàng đợi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <KhoiTomTat tieuDe="1. Tiếp nhận" onSua={() => onEditStep('tiep_nhan')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm lg:grid-cols-4">
          <div><dt className="text-slate-400">Cân nặng</dt><dd className="text-slate-800">{sinhHieu?.can_nang ?? '—'} kg</dd></div>
          <div><dt className="text-slate-400">Chiều cao</dt><dd className="text-slate-800">{sinhHieu?.chieu_cao ?? '—'} cm</dd></div>
          <div><dt className="text-slate-400">BMI</dt><dd className="text-slate-800">{phien.bmi ?? '—'}</dd></div>
          <div><dt className="text-slate-400">Huyết áp</dt><dd className="text-slate-800">{sinhHieu?.huyet_ap ?? '—'}</dd></div>
        </dl>
        <p className="mt-2 text-sm">
          <span className="text-slate-400">Triệu chứng: </span>
          <span className="text-slate-800">{hoSo?.trieu_chung_ban_dau || '—'}</span>
        </p>
      </KhoiTomTat>

      <KhoiTomTat tieuDe="2. Chẩn đoán" onSua={() => onEditStep('chan_doan')}>
        <div className="space-y-1 text-sm">
          <p><span className="text-slate-400">Chẩn đoán: </span><span className="text-slate-800">{hoSo?.chan_doan || '—'}</span></p>
          <p><span className="text-slate-400">Hướng dẫn điều trị: </span><span className="text-slate-800">{hoSo?.huong_dan_dieu_tri || '—'}</span></p>
          <p><span className="text-slate-400">Lưu ý: </span><span className="text-slate-800">{hoSo?.ghi_chu || '—'}</span></p>
          <p><span className="text-slate-400">Tái khám: </span><span className="text-slate-800">{hoSo?.ngay_tai_kham ? new Date(hoSo.ngay_tai_kham).toLocaleDateString('vi-VN') : '—'}</span></p>
          <p>
            <span className="text-slate-400">Kết cục: </span>
            <span className={hoSo?.ket_cuc && hoSo.ket_cuc !== 'dieu_tri_thuong' ? 'font-semibold text-amber-700' : 'text-slate-800'}>
              {NHAN_KET_CUC_THAT[hoSo?.ket_cuc ?? 'dieu_tri_thuong'] ?? hoSo?.ket_cuc}
            </span>
          </p>
          {hoSo?.chuyen_vien_thong_tin && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p>Nơi chuyển: {hoSo.chuyen_vien_thong_tin.noi_chuyen_den}</p>
              <p>Lý do: {hoSo.chuyen_vien_thong_tin.ly_do}</p>
              {hoSo.chuyen_vien_thong_tin.tinh_trang_luc_chuyen && (
                <p>Tình trạng: {hoSo.chuyen_vien_thong_tin.tinh_trang_luc_chuyen}</p>
              )}
            </div>
          )}
        </div>
      </KhoiTomTat>

      <KhoiTomTat tieuDe="3. Dịch vụ" onSua={() => onEditStep('dich_vu')}>
        {hoSo?.dich_vu_phat_sinh?.length ? (
          <>
            <ul className="space-y-3 text-sm text-slate-800">
              {hoSo.dich_vu_phat_sinh.map((dv) => (
                <li key={dv.service_id}>
                  <div className="flex justify-between gap-3">
                    <span>{dv.ten} × {dv.so_luong}</span>
                    <span className="text-slate-500">{formatPrice(dv.thanh_tien)}</span>
                  </div>
                  {dv.hinh_anh?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dv.hinh_anh.map((image) => (
                        <a key={image.url} href={image.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                          <img src={image.url} alt={`Ảnh kết quả ${dv.ten}`} className="h-16 w-16 object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-sm font-semibold text-slate-900">
              Tổng: {formatPrice(hoSo.dich_vu_phat_sinh.reduce((s, dv) => s + dv.thanh_tien, 0))}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Không có dịch vụ phát sinh</p>
        )}
      </KhoiTomTat>

      <KhoiTomTat tieuDe="4. Kê đơn" onSua={() => onEditStep('ke_don')}>
        {phien.thuoc.length ? (
          <ul className="space-y-1 text-sm text-slate-800">
            {phien.thuoc.map((t, i) => (
              <li key={i}>
                {t.ten_thuoc} — {t.lieu_luong || '—'}, {t.tan_suat || '—'}, {t.so_ngay} ngày
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">Không kê đơn</p>
        )}
      </KhoiTomTat>

      {completeError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{completeError}</div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={completing}
          onClick={hoanTat}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {completing ? 'Đang hoàn tất...' : 'Hoàn tất ca khám & mời bệnh nhân tiếp theo'}
        </button>
      </div>
    </div>
  )
}
