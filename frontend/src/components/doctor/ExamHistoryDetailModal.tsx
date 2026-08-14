import { useEffect, useState } from 'react'
import Modal from '@/components/common/Modal'
import Badge from '@/components/common/Badge'
import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { KetCuc, PhienKham } from '@/services/doctor-exam-session.service'
import { formatDateTime, formatPrice } from '@/utils/format'

interface Props {
  queueId: string
  onClose: () => void
  onAmended: () => void
}

const NHAN_KET_CUC: Record<KetCuc, string> = {
  dieu_tri_thuong: 'Điều trị thường',
  chuyen_chuyen_khoa: 'Chuyển chuyên khoa',
  chuyen_vien: 'Chuyển viện',
  cap_cuu_ngoai_vien: 'Cấp cứu ngoài viện',
}

const NHAN_THANH_TOAN: Record<string, { label: string; color: 'green' | 'yellow' | 'red' | 'gray' }> = {
  chua_thanh_toan: { label: 'Chưa thanh toán', color: 'red' },
  da_dat_coc: { label: 'Đã đặt cọc', color: 'yellow' },
  da_thanh_toan_du: { label: 'Đã thanh toán', color: 'green' },
  qua_han: { label: 'Quá hạn', color: 'red' },
}

function extractApiMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message?.trim() || fallback
}

// C4/B54-B55 — xem lại toàn bộ nội dung một ca đã khám xong + đính chính khi phát hiện
// nhập nhầm. `dinhChinhHoSo` ở backend chỉ cho sửa các trường phi-lâm-sàng-nhạy-cảm
// (KHÔNG cho sửa dịch vụ/tiền qua form này — đúng whitelist TRUONG_DINH_CHINH_DUOC_PHEP).
export default function ExamHistoryDetailModal({ queueId, onClose, onAmended }: Props) {
  const [phien, setPhien] = useState<PhienKham | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dinhChinh, setDinhChinh] = useState(false)
  const [chanDoan, setChanDoan] = useState('')
  const [huongDan, setHuongDan] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [ngayTaiKham, setNgayTaiKham] = useState('')
  const [ketCuc, setKetCuc] = useState<KetCuc>('dieu_tri_thuong')
  const [lyDo, setLyDo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function load() {
    setLoading(true); setError(null)
    doctorExamSessionService.get(queueId)
      .then((p) => {
        setPhien(p)
        setChanDoan(p.ho_so?.chan_doan ?? '')
        setHuongDan(p.ho_so?.huong_dan_dieu_tri ?? '')
        setGhiChu(p.ho_so?.ghi_chu ?? '')
        setNgayTaiKham(p.ho_so?.ngay_tai_kham ? p.ho_so.ngay_tai_kham.slice(0, 10) : '')
        setKetCuc(p.ho_so?.ket_cuc ?? 'dieu_tri_thuong')
      })
      .catch((e) => setError(extractApiMessage(e, 'Không tải được hồ sơ')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [queueId])

  async function luuDinhChinh() {
    if (!lyDo.trim()) { setSaveError('Cần nhập lý do đính chính'); return }
    setSaving(true); setSaveError(null)
    try {
      await doctorExamSessionService.amend(queueId, {
        chan_doan: chanDoan.trim(),
        huong_dan_dieu_tri: huongDan.trim() || null,
        ghi_chu: ghiChu.trim() || null,
        ngay_tai_kham: ngayTaiKham || null,
        ket_cuc: ketCuc,
      }, lyDo.trim())
      setDinhChinh(false)
      setLyDo('')
      onAmended()
      load()
    } catch (e) {
      setSaveError(extractApiMessage(e, 'Đính chính thất bại, vui lòng thử lại'))
    } finally {
      setSaving(false)
    }
  }

  const hoSo = phien?.ho_so
  const payment = phien?.hoa_don?.trang_thai_hoa_don ? NHAN_THANH_TOAN[phien.hoa_don.trang_thai_hoa_don] : null

  return (
    <Modal isOpen title={phien ? `Hồ sơ khám — ${phien.queue.ten_benh_nhan}` : 'Hồ sơ khám'} onClose={onClose} size="lg">
      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : phien && hoSo ? (
        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Thông tin bệnh nhân</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm lg:grid-cols-3">
              <div><dt className="text-slate-400">Tuổi</dt><dd className="text-slate-800">{phien.queue.tuoi ?? '—'}</dd></div>
              <div><dt className="text-slate-400">Giới tính</dt><dd className="text-slate-800">{phien.queue.gioi_tinh ?? '—'}</dd></div>
              <div><dt className="text-slate-400">Nhóm máu</dt><dd className="text-slate-800">{phien.queue.nhom_mau ?? '—'}</dd></div>
              <div><dt className="text-slate-400">Dị ứng</dt><dd className="text-slate-800">{phien.queue.di_ung ?? '—'}</dd></div>
              <div><dt className="text-slate-400">Bệnh nền</dt><dd className="text-slate-800">{phien.queue.benh_nen ?? '—'}</dd></div>
              <div><dt className="text-slate-400">Nguồn</dt><dd className="text-slate-800">{phien.queue.nguon === 'offline' ? 'Vãng lai' : 'Đặt online'}</dd></div>
            </dl>
            <p className="mt-2 text-sm">
              <span className="text-slate-400">Triệu chứng ban đầu: </span>
              <span className="text-slate-800">{hoSo.trieu_chung_ban_dau || '—'}</span>
            </p>
          </section>

          {!dinhChinh ? (
            <>
              <section className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Chẩn đoán & điều trị</h3>
                  <button type="button" onClick={() => setDinhChinh(true)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Đính chính
                  </button>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-400">Chẩn đoán: </span><span className="text-slate-800">{hoSo.chan_doan || '—'}</span></p>
                  <p><span className="text-slate-400">Hướng dẫn điều trị: </span><span className="text-slate-800">{hoSo.huong_dan_dieu_tri || '—'}</span></p>
                  <p><span className="text-slate-400">Ghi chú: </span><span className="text-slate-800">{hoSo.ghi_chu || '—'}</span></p>
                  <p><span className="text-slate-400">Tái khám: </span><span className="text-slate-800">{hoSo.ngay_tai_kham ? new Date(hoSo.ngay_tai_kham).toLocaleDateString('vi-VN') : '—'}</span></p>
                  <p>
                    <span className="text-slate-400">Kết cục: </span>
                    <span className={hoSo.ket_cuc !== 'dieu_tri_thuong' ? 'font-semibold text-amber-700' : 'text-slate-800'}>
                      {NHAN_KET_CUC[hoSo.ket_cuc]}
                    </span>
                  </p>
                  {hoSo.chuyen_vien_thong_tin && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <p>Nơi chuyển: {hoSo.chuyen_vien_thong_tin.noi_chuyen_den}</p>
                      <p>Lý do: {hoSo.chuyen_vien_thong_tin.ly_do}</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Dịch vụ phát sinh</h3>
                {hoSo.dich_vu_phat_sinh.length ? (
                  <>
                    <ul className="space-y-1 text-sm text-slate-800">
                      {hoSo.dich_vu_phat_sinh.map((dv) => (
                        <li key={dv.service_id} className="flex justify-between">
                          <span>{dv.ten} × {dv.so_luong}</span>
                          <span className="text-slate-500">{formatPrice(dv.thanh_tien)}</span>
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
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Đơn thuốc</h3>
                {phien.thuoc.length ? (
                  <ul className="space-y-1 text-sm text-slate-800">
                    {phien.thuoc.map((t, i) => (
                      <li key={i}>{t.ten_thuoc} — {t.lieu_luong || '—'}, {t.tan_suat || '—'}, {t.so_ngay} ngày</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Không kê đơn</p>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Thanh toán</h3>
                {phien.hoa_don ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-0.5">
                      <p><span className="text-slate-400">Tiền khám: </span>{formatPrice(phien.hoa_don.tong_tien_kham)}</p>
                      <p><span className="text-slate-400">Dịch vụ phát sinh: </span>{formatPrice(phien.hoa_don.tong_tien_phat_sinh)}</p>
                      <p className="font-semibold text-slate-900">Tổng thanh toán: {formatPrice(phien.hoa_don.tong_thanh_toan)}</p>
                    </div>
                    {payment && <Badge color={payment.color}>{payment.label}</Badge>}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Chưa có hóa đơn (lễ tân chưa lập).</p>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Đính chính hồ sơ đã xác nhận</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Chẩn đoán</label>
                  <input value={chanDoan} onChange={(e) => setChanDoan(e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Hướng dẫn điều trị</label>
                  <textarea value={huongDan} onChange={(e) => setHuongDan(e.target.value)} rows={2} className="input w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Ghi chú</label>
                  <textarea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} rows={2} className="input w-full" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Ngày tái khám</label>
                    <input type="date" value={ngayTaiKham} onChange={(e) => setNgayTaiKham(e.target.value)} className="input w-full" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Kết cục</label>
                    <select value={ketCuc} onChange={(e) => setKetCuc(e.target.value as KetCuc)} className="input w-full">
                      {Object.entries(NHAN_KET_CUC).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Lý do đính chính (bắt buộc)</label>
                  <input value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="VD: nhập nhầm chẩn đoán, sửa lại theo yêu cầu bác sĩ..." className="input w-full" />
                </div>
                {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setDinhChinh(false); setSaveError(null) }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Hủy
                  </button>
                  <button type="button" disabled={saving} onClick={luuDinhChinh}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                    {saving ? 'Đang lưu...' : 'Lưu đính chính'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {hoSo.lich_su_sua && hoSo.lich_su_sua.length > 0 && (
            <section className="rounded-lg border border-slate-200 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Lịch sử chỉnh sửa</h3>
              <ul className="space-y-2 text-xs text-slate-600">
                {hoSo.lich_su_sua.map((h, i) => (
                  <li key={i} className="border-l-2 border-slate-200 pl-2">
                    <span className="font-medium text-slate-700">{formatDateTime(h.thoi_diem_sua)}</span> — {h.noi_dung}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
