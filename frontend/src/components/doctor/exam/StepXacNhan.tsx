import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { BuocKham, KetQuaHoanTat, PhienKham } from '@/services/doctor-exam-session.service'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { formatPrice, NHAN_KET_CUC_THAT } from '@/utils/format'
import KhoiTomTat, { MAU_AMBER, MAU_EMERALD, MAU_SKY, MAU_VIOLET, nhanBuoiUong } from '@/components/doctor/exam/KhoiThongTin'

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

  const tongTienDichVu = hoSo?.dich_vu_phat_sinh?.reduce((s, dv) => s + dv.thanh_tien, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Tổng kết hồ sơ khám</h2>
        <p className="mt-0.5 text-xs text-slate-500">Kiểm tra lại 4 bước trước khi hoàn tất — bấm "Sửa" ở khối nào để quay lại đúng bước đó.</p>
      </div>

      <KhoiTomTat buoc={1} tieuDe="Tiếp nhận" icon="stethoscope" mau={MAU_SKY} action={{ label: 'Sửa', onClick: () => onEditStep('tiep_nhan') }}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { nhan: 'Cân nặng', gt: sinhHieu?.can_nang, dv: 'kg' },
            { nhan: 'Chiều cao', gt: sinhHieu?.chieu_cao, dv: 'cm' },
            { nhan: 'BMI', gt: phien.bmi, dv: '' },
            { nhan: 'Huyết áp', gt: sinhHieu?.huyet_ap, dv: '' },
          ].map((o) => (
            <div key={o.nhan} className="rounded-lg bg-sky-50 px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-slate-900">
                {o.gt ?? '—'}
                {o.gt && o.dv ? <span className="ml-0.5 text-xs font-medium text-slate-400">{o.dv}</span> : null}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">{o.nhan}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          <span className="text-slate-400">Triệu chứng: </span>
          <span className="text-slate-800">{hoSo?.trieu_chung_ban_dau || '—'}</span>
        </p>
      </KhoiTomTat>

      <KhoiTomTat buoc={2} tieuDe="Chẩn đoán" icon="edit" mau={MAU_VIOLET} action={{ label: 'Sửa', onClick: () => onEditStep('chan_doan') }}>
        <div className="space-y-2 divide-y divide-slate-100 text-sm">
          <p className="pb-2"><span className="text-slate-400">Chẩn đoán: </span><span className="font-medium text-slate-800">{hoSo?.chan_doan || '—'}</span></p>
          <p className="pt-2"><span className="text-slate-400">Hướng dẫn điều trị: </span><span className="text-slate-800">{hoSo?.huong_dan_dieu_tri || '—'}</span></p>
          <p className="pt-2"><span className="text-slate-400">Lưu ý: </span><span className="text-slate-800">{hoSo?.ghi_chu || '—'}</span></p>
          <p className="pt-2"><span className="text-slate-400">Tái khám: </span><span className="text-slate-800">{hoSo?.ngay_tai_kham ? new Date(hoSo.ngay_tai_kham).toLocaleDateString('vi-VN') : '—'}</span></p>
          <p className="pt-2">
            <span className="text-slate-400">Kết cục: </span>
            <span className={hoSo?.ket_cuc && hoSo.ket_cuc !== 'dieu_tri_thuong' ? 'font-semibold text-amber-700' : 'text-slate-800'}>
              {NHAN_KET_CUC_THAT[hoSo?.ket_cuc ?? 'dieu_tri_thuong'] ?? hoSo?.ket_cuc}
            </span>
          </p>
        </div>
        {hoSo?.chuyen_vien_thong_tin && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p>Nơi chuyển: {hoSo.chuyen_vien_thong_tin.noi_chuyen_den}</p>
            <p>Lý do: {hoSo.chuyen_vien_thong_tin.ly_do}</p>
            {hoSo.chuyen_vien_thong_tin.tinh_trang_luc_chuyen && (
              <p>Tình trạng: {hoSo.chuyen_vien_thong_tin.tinh_trang_luc_chuyen}</p>
            )}
          </div>
        )}
      </KhoiTomTat>

      <KhoiTomTat buoc={3} tieuDe="Dịch vụ" icon="service" mau={MAU_AMBER} action={{ label: 'Sửa', onClick: () => onEditStep('dich_vu') }}>
        {hoSo?.dich_vu_phat_sinh?.length ? (
          <>
            <ul className="divide-y divide-slate-100 text-sm text-slate-800">
              {hoSo.dich_vu_phat_sinh.map((dv) => (
                <li key={dv.service_id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex justify-between gap-3">
                    <span>{dv.ten} × {dv.so_luong}</span>
                    <span className="font-medium text-slate-600">{formatPrice(dv.thanh_tien)}</span>
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
            <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
              <span className="text-sm font-semibold text-amber-900">Tổng tiền dịch vụ</span>
              <span className="text-base font-bold text-amber-900">{formatPrice(tongTienDichVu)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">Không có dịch vụ phát sinh</p>
        )}
      </KhoiTomTat>

      <KhoiTomTat buoc={4} tieuDe="Kê đơn" icon="receipt" mau={MAU_EMERALD} action={{ label: 'Sửa', onClick: () => onEditStep('ke_don') }}>
        {phien.thuoc.length ? (
          <div className="space-y-2">
            {phien.thuoc.map((t, i) => (
              <div key={i} className="rounded-lg bg-emerald-50 px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-semibold text-slate-900">{t.ten_thuoc}</span>
                  <span className="text-xs text-slate-500">{t.so_ngay} ngày</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  {[t.lieu_luong, t.tan_suat].filter(Boolean).join(' · ') || '—'}
                </p>
                {t.gio_uong?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {t.gio_uong.map((g) => (
                      <span key={g} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {nhanBuoiUong(g)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
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
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card-md disabled:opacity-40"
        >
          {completing ? 'Đang hoàn tất...' : 'Hoàn tất ca khám & mời bệnh nhân tiếp theo'}
        </button>
      </div>
    </div>
  )
}
