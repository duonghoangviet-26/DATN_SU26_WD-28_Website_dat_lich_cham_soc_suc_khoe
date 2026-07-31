import { useCallback, useEffect, useState } from 'react'

import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import {
  patientBookingService,
  type RescheduleOptions,
} from '@/services/patient-booking.service'

// Dời lịch khám — rule mục 5 (khách tự xin dời) và mục 14/15 (phòng khám đổi lịch).
//
// ⛔ KHÔNG hoàn tiền trong mọi trường hợp. Tiền của khách được bảo toàn dưới dạng QUYỀN
// DỜI LỊCH, nên màn này phải nói rõ "bạn không mất khoản nào" — nếu không khách sẽ tưởng
// dời lịch là mất tiền và đi khiếu nại.

interface Props {
  appointmentId: string
  onClose: () => void
  onDone: (thongBao: string) => void
}

function fmtNgay(value?: string | null) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString('vi-VN')
}

function fmtHan(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
  })
}

export default function RescheduleModal({ appointmentId, onClose, onDone }: Props) {
  const [options, setOptions] = useState<RescheduleOptions | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState<string | null>(null)
  const [chon, setChon] = useState<number | null>(null)
  const [dangGui, setDangGui] = useState(false)

  const tai = useCallback(async () => {
    try {
      setDangTai(true)
      setLoi(null)
      const data = await patientBookingService.getRescheduleOptions(appointmentId)
      setOptions(data)
      setChon(data.phuong_an.length > 0 ? 0 : null)
    } catch (err: any) {
      setLoi(err.response?.data?.message || 'Không tải được phương án dời lịch')
    } finally {
      setDangTai(false)
    }
  }, [appointmentId])

  useEffect(() => { void tai() }, [tai])

  async function xacNhan() {
    if (chon === null) return
    try {
      setDangGui(true)
      setLoi(null)
      const kq = await patientBookingService.chooseReschedule(appointmentId, chon)
      onDone(`Đã dời lịch sang ${kq.gio_kham} ngày ${fmtNgay(kq.ngay_kham)}. Bạn không mất khoản nào.`)
    } catch (err: any) {
      setLoi(err.response?.data?.message || 'Không dời được lịch, vui lòng thử lại')
    } finally {
      setDangGui(false)
    }
  }

  const laDeXuatCuaPhongKham = options?.loai === 'phong_kham_de_xuat'

  return (
    <Modal isOpen onClose={onClose} title={laDeXuatCuaPhongKham ? 'PHÒNG KHÁM CẦN ĐỔI LỊCH CỦA BẠN' : 'DỜI LỊCH KHÁM'}>
      <div className="space-y-4 text-left">
        {dangTai && <p className="py-6 text-center text-sm text-slate-500">Đang tìm khung giờ thay thế...</p>}

        {!dangTai && loi && !options && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{loi}</div>
            <p className="text-xs leading-relaxed text-slate-500">
              Bạn vẫn giữ nguyên lịch hẹn hiện tại và số tiền đã thanh toán. Nếu cần hỗ trợ thêm,
              vui lòng liên hệ quầy lễ tân.
            </p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>Đóng</Button>
            </div>
          </div>
        )}

        {!dangTai && options && (
          <>
            <div className={`rounded-xl border p-4 text-sm leading-relaxed ${
              laDeXuatCuaPhongKham
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}>
              <p>{options.thong_diep}</p>
              {options.khong_mat_tien && (
                <p className="mt-2 font-semibold">Số tiền bạn đã thanh toán được giữ nguyên.</p>
              )}
              {options.han_phan_hoi && (
                <p className="mt-2 text-xs">
                  Hạn phản hồi: <strong>{fmtHan(options.han_phan_hoi)}</strong>. Quá hạn, chúng tôi
                  giữ sẵn phương án đầu tiên cho bạn.
                </p>
              )}
              {options.han_chot && (
                <p className="mt-2 text-xs">
                  Hạn xin dời: trước <strong>{fmtHan(options.han_chot)}</strong>.
                </p>
              )}
            </div>

            {options.trang_thai === 'cho_admin_duyet' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Phương án đang chờ phòng khám duyệt. Chúng tôi sẽ báo bạn ngay khi có kết quả.
              </div>
            ) : options.phuong_an.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Hiện không còn khung giờ trống phù hợp. Vui lòng liên hệ quầy lễ tân để được xếp lịch —
                bạn không mất khoản nào.
              </div>
            ) : (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Chọn phương án thay thế
                </legend>
                {options.phuong_an.map((pa) => (
                  <label
                    key={pa.index}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      chon === pa.index
                        ? 'border-brand-500 bg-brand-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="phuong-an-doi-lich"
                      checked={chon === pa.index}
                      onChange={() => setChon(pa.index)}
                      className="mt-1 h-4 w-4 shrink-0 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{pa.mo_ta}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {pa.gio_bat_dau} · ngày {fmtNgay(pa.ngay)}
                        {pa.bac_si_ten ? ` · ${pa.bac_si_ten}` : ''}
                      </span>
                      {pa.da_giu_cho && (
                        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Đã giữ sẵn chỗ này cho bạn
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {options.loai === 'khach_tu_doi' && options.con_lai !== undefined && (
              <p className="text-xs text-slate-500">
                Bạn còn <strong>{options.con_lai}</strong> lần dời lịch. Sau khi dời, lịch này sẽ
                không đổi được nữa.
              </p>
            )}

            {loi && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{loi}</div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={dangGui}>Để sau</Button>
              {options.trang_thai !== 'cho_admin_duyet' && options.phuong_an.length > 0 && (
                <Button variant="primary" onClick={xacNhan} loading={dangGui} disabled={chon === null}>
                  Xác nhận dời lịch
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
