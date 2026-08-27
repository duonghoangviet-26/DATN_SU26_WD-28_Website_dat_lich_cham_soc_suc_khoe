import { useEffect, useState } from 'react'
import Modal from '@/components/common/Modal'
import Badge from '@/components/common/Badge'
import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { PhienKham } from '@/services/doctor-exam-session.service'
import { formatDateTime, formatPrice, NHAN_KET_CUC_THAT } from '@/utils/format'
import KhoiTomTat, { MAU_AMBER, MAU_BRAND, MAU_EMERALD, MAU_SKY, MAU_SLATE, MAU_VIOLET, nhanBuoiUong } from '@/components/doctor/exam/KhoiThongTin'

interface Props {
  queueId: string
  onClose: () => void
  onAmended: () => void
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

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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

  function inHoSo() {
    if (!phien || !hoSo) return
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return
    const dichVu = hoSo.dich_vu_phat_sinh.length
      ? hoSo.dich_vu_phat_sinh.map((dv) => `<li>${escapeHtml(dv.ten)} x ${dv.so_luong}: ${formatPrice(dv.thanh_tien)}</li>`).join('')
      : '<li>Không có dịch vụ phát sinh</li>'
    const thuoc = phien.thuoc.length
      ? phien.thuoc.map((t) => `<li>${escapeHtml(t.ten_thuoc)} - ${escapeHtml(t.lieu_luong || '-')}, ${escapeHtml(t.tan_suat || '-')}, ${t.so_ngay} ngày</li>`).join('')
      : '<li>Không kê đơn</li>'
    printWindow.document.write(`
      <html>
        <head>
          <title>Hồ sơ khám - ${escapeHtml(phien.queue.ten_benh_nhan)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 28px; line-height: 1.5; }
            h1 { font-size: 22px; margin: 0 0 16px; }
            h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            p { margin: 4px 0; }
            ul { margin: 6px 0 0 20px; padding: 0; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; }
          </style>
        </head>
        <body>
          <h1>Hồ sơ khám bệnh</h1>
          <section class="grid">
            <p><strong>Bệnh nhân:</strong> ${escapeHtml(phien.queue.ten_benh_nhan)}</p>
            <p><strong>Số điện thoại:</strong> ${escapeHtml(phien.queue.so_dien_thoai || '-')}</p>
            <p><strong>Tuổi:</strong> ${phien.queue.tuoi ?? '-'}</p>
            <p><strong>Giới tính:</strong> ${escapeHtml(phien.queue.gioi_tinh || '-')}</p>
          </section>
          <h2>Tiếp nhận</h2>
          <p><strong>Lý do/triệu chứng:</strong> ${escapeHtml(hoSo.trieu_chung_ban_dau || '-')}</p>
          <h2>Chẩn đoán và điều trị</h2>
          <p><strong>Chẩn đoán:</strong> ${escapeHtml(hoSo.chan_doan || '-')}</p>
          <p><strong>Hướng dẫn:</strong> ${escapeHtml(hoSo.huong_dan_dieu_tri || '-')}</p>
          <p><strong>Ghi chú:</strong> ${escapeHtml(hoSo.ghi_chu || '-')}</p>
          <p><strong>Tái khám:</strong> ${hoSo.ngay_tai_kham ? new Date(hoSo.ngay_tai_kham).toLocaleDateString('vi-VN') : '-'}</p>
          <h2>Dịch vụ phát sinh</h2>
          <ul>${dichVu}</ul>
          <h2>Đơn thuốc</h2>
          <ul>${thuoc}</ul>
          <h2>Thanh toán</h2>
          <p><strong>Tiền khám:</strong> ${formatPrice(phien.hoa_don?.tong_tien_kham ?? 0)}</p>
          <p><strong>Dịch vụ phát sinh:</strong> ${formatPrice(phien.hoa_don?.tong_tien_phat_sinh ?? 0)}</p>
          <p><strong>Tổng thanh toán:</strong> ${formatPrice(phien.hoa_don?.tong_thanh_toan ?? 0)}</p>
          <p><strong>Đã thu:</strong> ${formatPrice(phien.hoa_don?.tong_da_thu ?? 0)}</p>
          <p><strong>Còn thiếu:</strong> ${formatPrice(phien.hoa_don?.con_thieu ?? 0)}</p>
          <p><strong>Thu ngân:</strong> ${phien.hoa_don?.da_xac_nhan_thu_ngan ? 'Đã đối chiếu' : 'Chưa đối chiếu'}</p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <Modal isOpen title={phien ? `Hồ sơ khám — ${phien.queue.ten_benh_nhan}` : 'Hồ sơ khám'} onClose={onClose} size="lg">
      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : phien && hoSo ? (
        <div className="space-y-5">
          <KhoiTomTat tieuDe="Thông tin bệnh nhân" icon="user" mau={MAU_SKY}>
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
          </KhoiTomTat>

          {!dinhChinh ? (
            <>
              <KhoiTomTat tieuDe="Chẩn đoán & điều trị" icon="edit" mau={MAU_VIOLET} action={{ label: 'Đính chính', onClick: () => setDinhChinh(true) }}>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-400">Chẩn đoán: </span><span className="text-slate-800">{hoSo.chan_doan || '—'}</span></p>
                  <p><span className="text-slate-400">Hướng dẫn điều trị: </span><span className="text-slate-800">{hoSo.huong_dan_dieu_tri || '—'}</span></p>
                  <p><span className="text-slate-400">Ghi chú: </span><span className="text-slate-800">{hoSo.ghi_chu || '—'}</span></p>
                  <p><span className="text-slate-400">Tái khám: </span><span className="text-slate-800">{hoSo.ngay_tai_kham ? new Date(hoSo.ngay_tai_kham).toLocaleDateString('vi-VN') : '—'}</span></p>
                  <p>
                    <span className="text-slate-400">Kết cục: </span>
                    <span className={hoSo.ket_cuc !== 'dieu_tri_thuong' ? 'font-semibold text-amber-700' : 'text-slate-800'}>
                      {NHAN_KET_CUC_THAT[hoSo.ket_cuc] ?? hoSo.ket_cuc}
                    </span>
                  </p>
                  {hoSo.chuyen_vien_thong_tin && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <p>Nơi chuyển: {hoSo.chuyen_vien_thong_tin.noi_chuyen_den}</p>
                      <p>Lý do: {hoSo.chuyen_vien_thong_tin.ly_do}</p>
                    </div>
                  )}
                </div>
              </KhoiTomTat>

              <KhoiTomTat tieuDe="Dịch vụ phát sinh" icon="service" mau={MAU_AMBER}>
                {hoSo.dich_vu_phat_sinh.length ? (
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
                      <span className="text-base font-bold text-amber-900">{formatPrice(hoSo.dich_vu_phat_sinh.reduce((s, dv) => s + dv.thanh_tien, 0))}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Không có dịch vụ phát sinh</p>
                )}
              </KhoiTomTat>

              <KhoiTomTat tieuDe="Đơn thuốc" icon="receipt" mau={MAU_EMERALD}>
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

              <KhoiTomTat tieuDe="Thanh toán" icon="payment" mau={MAU_BRAND} action={{ label: 'In hồ sơ', onClick: inHoSo }}>
                {phien.hoa_don ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-0.5">
                      <p><span className="text-slate-400">Tiền khám: </span>{formatPrice(phien.hoa_don.tong_tien_kham)}</p>
                      <p><span className="text-slate-400">Dịch vụ phát sinh: </span>{formatPrice(phien.hoa_don.tong_tien_phat_sinh)}</p>
                      <p className="font-semibold text-slate-900">Tổng thanh toán: {formatPrice(phien.hoa_don.tong_thanh_toan)}</p>
                      <p><span className="text-slate-400">Đã thu: </span>{formatPrice(phien.hoa_don.tong_da_thu ?? 0)}</p>
                      <p className={(phien.hoa_don.con_thieu ?? 0) > 0 ? 'font-semibold text-red-700' : 'font-semibold text-green-700'}>
                        Còn thiếu: {formatPrice(phien.hoa_don.con_thieu ?? 0)}
                      </p>
                      <p><span className="text-slate-400">Thu ngân: </span>{phien.hoa_don.da_xac_nhan_thu_ngan ? 'Đã đối chiếu' : 'Chưa đối chiếu'}</p>
                      {phien.hoa_don.tong_tien_phat_sinh > 0 && (phien.hoa_don.con_thieu ?? 0) > 0 && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                          Dịch vụ phát sinh chưa thu đủ. Lễ tân cần thu/đối chiếu trước khi bệnh nhân ra về.
                        </p>
                      )}
                    </div>
                    {payment && <Badge color={payment.color}>{payment.label}</Badge>}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Chưa có hóa đơn (lễ tân chưa lập).</p>
                )}
              </KhoiTomTat>
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
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Ngày tái khám</label>
                  <input type="date" value={ngayTaiKham} onChange={(e) => setNgayTaiKham(e.target.value)} className="input w-full" />
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
            <KhoiTomTat tieuDe="Lịch sử chỉnh sửa" icon="clock" mau={MAU_SLATE}>
              <ul className="space-y-2 text-xs text-slate-600">
                {hoSo.lich_su_sua.map((h, i) => (
                  <li key={i} className="border-l-2 border-slate-200 pl-2">
                    <span className="font-medium text-slate-700">{formatDateTime(h.thoi_diem_sua)}</span> — {h.noi_dung}
                  </li>
                ))}
              </ul>
            </KhoiTomTat>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
