import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { nurseService } from '@/services/nurse.service'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import type { NurseAppointmentDetail as NurseAppointmentDetailType } from '@/types'
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'
import { formatDate, formatDateTime } from '@/utils/format'

const KET_QUA_STATUS_LABEL: Record<string, string> = {
  ban_nhap: 'Nháp',
  cho_xac_nhan: 'Chờ bác sĩ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  yeu_cau_chinh_sua: 'Cần chỉnh sửa',
}
const KET_QUA_STATUS_COLOR: Record<string, 'yellow' | 'green' | 'red' | 'gray'> = {
  ban_nhap: 'gray',
  cho_xac_nhan: 'yellow',
  da_xac_nhan: 'green',
  yeu_cau_chinh_sua: 'red',
}

export default function NurseAppointmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [appt, setAppt] = useState<NurseAppointmentDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [showCheckinConfirm, setShowCheckinConfirm] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [chanDoan, setChanDoan] = useState('')
  const [huongDan, setHuongDan] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [trieuChung, setTrieuChung] = useState('')
  const [ghiChuDieuDuong, setGhiChuDieuDuong] = useState('')
  const [ngayTaiKham, setNgayTaiKham] = useState('')
  const [canNang, setCanNang] = useState('')
  const [chieuCao, setChieuCao] = useState('')
  const [huyetAp, setHuyetAp] = useState('')
  const [nhietDo, setNhietDo] = useState('')
  const [nhipTim, setNhipTim] = useState('')
  const [snapshot, setSnapshot] = useState('')      // ảnh chụp form lúc nạp/lưu — để phát hiện "chưa lưu"
  const [chanDoanError, setChanDoanError] = useState('')

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function load() {
    if (!id) return
    setLoading(true)
    setError(false)
    nurseService.getAppointmentById(id)
      .then((a) => {
        setAppt(a)
        // Nạp từ giá trị đã có (hoặc rỗng) — LUÔN set mọi field để không giữ lại dữ liệu cũ khi reload.
        const cd = a.ket_qua?.chan_doan ?? ''
        const hd = a.ket_qua?.huong_dan_dieu_tri ?? ''
        const gc = a.ket_qua?.ghi_chu ?? ''
        const tc = a.ket_qua?.trieu_chung_ban_dau ?? ''
        const gcdd = a.ket_qua?.ghi_chu_dieu_duong ?? ''
        const ntk = a.ket_qua?.ngay_tai_kham ? a.ket_qua.ngay_tai_kham.slice(0, 10) : ''
        const cn = a.sinh_hieu?.can_nang != null ? String(a.sinh_hieu.can_nang) : ''
        const cc = a.sinh_hieu?.chieu_cao != null ? String(a.sinh_hieu.chieu_cao) : ''
        const ha = a.sinh_hieu?.huyet_ap ?? ''
        const nd = a.sinh_hieu?.nhiet_do != null ? String(a.sinh_hieu.nhiet_do) : ''
        const nt = a.sinh_hieu?.nhip_tim != null ? String(a.sinh_hieu.nhip_tim) : ''
        setChanDoan(cd); setHuongDan(hd); setGhiChu(gc); setTrieuChung(tc); setGhiChuDieuDuong(gcdd); setNgayTaiKham(ntk)
        setCanNang(cn); setChieuCao(cc); setHuyetAp(ha); setNhietDo(nd); setNhipTim(nt)
        setChanDoanError('')
        setSnapshot(JSON.stringify([cd, hd, gc, tc, gcdd, ntk, cn, cc, ha, nd, nt]))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Chưa lưu" = form khác ảnh chụp lúc nạp/lưu gần nhất.
  const currentSnap = JSON.stringify([chanDoan, huongDan, ghiChu, trieuChung, ghiChuDieuDuong, ngayTaiKham, canNang, chieuCao, huyetAp, nhietDo, nhipTim])
  const dirty = snapshot !== '' && currentSnap !== snapshot

  // Cảnh báo khi rời trang (đóng tab/reload) lúc còn thay đổi chưa lưu.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function handleBack() {
    if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Rời trang mà không lưu?')) return
    navigate('/nurse/queue')
  }

  if (loading) return <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
  if (error || !appt) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
        <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-600">Không tìm thấy lịch hẹn hoặc không thuộc ca của bạn.</p>
      </div>
    )
  }

  const minNgayTaiKham = (() => {
    const d = new Date(appt.ngay_kham)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const ketQuaStatus = appt.ket_qua?.status ?? null
  const isEditable = !ketQuaStatus || ketQuaStatus === 'ban_nhap' || ketQuaStatus === 'yeu_cau_chinh_sua'
  const canFillForm = !appt.da_co_ket_qua && !['cancelled', 'no_show'].includes(appt.status)

  // Tiếp nhận (check-in) chỉ áp dụng cho lịch HÔM NAY, chưa tiếp nhận, còn ở pending/confirmed.
  // Backend là nơi quyết định cuối cùng (phạm vi ca + ngày + trạng thái + chống trùng).
  const isToday = (() => {
    const d = new Date(appt.ngay_kham); const t = new Date()
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
  })()
  const canCheckin = !appt.da_check_in && ['pending', 'confirmed'].includes(appt.status) && isToday

  function sinhHieuPayload() {
    if (!canNang && !chieuCao && !huyetAp && !nhietDo && !nhipTim) return undefined
    return {
      can_nang: canNang ? Number(canNang) : null,
      chieu_cao: chieuCao ? Number(chieuCao) : null,
      huyet_ap: huyetAp || null,
      nhiet_do: nhietDo ? Number(nhietDo) : null,
      nhip_tim: nhipTim ? Number(nhipTim) : null,
    }
  }

  async function handleSaveDraft() {
    if (!id || !appt || saving) return // chống bấm lưu nhiều lần
    if (!chanDoan.trim()) {
      setChanDoanError('Chẩn đoán là bắt buộc (ghi theo kết luận của bác sĩ).')
      return
    }
    setChanDoanError('')
    setSaving(true)
    try {
      if (!appt.ket_qua) {
        await nurseService.createDraft({
          appointment_id: id,
          chan_doan: chanDoan,
          huong_dan_dieu_tri: huongDan || null,
          ghi_chu: ghiChu || null,
          trieu_chung_ban_dau: trieuChung || null,
          ghi_chu_dieu_duong: ghiChuDieuDuong || null,
          ngay_tai_kham: ngayTaiKham || null,
          sinh_hieu: sinhHieuPayload(),
        })
      } else {
        await nurseService.updateRecord(appt.ket_qua.id, {
          chan_doan: chanDoan,
          huong_dan_dieu_tri: huongDan || null,
          ghi_chu: ghiChu || null,
          trieu_chung_ban_dau: trieuChung || null,
          ghi_chu_dieu_duong: ghiChuDieuDuong || null,
          ngay_tai_kham: ngayTaiKham || null,
          sinh_hieu: sinhHieuPayload(),
        })
      }
      showToast('Đã lưu nháp hồ sơ khám')
      load()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Không thể lưu hồ sơ', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!appt?.ket_qua || saving) return // chống gửi hai lần
    if (dirty) { showToast('Bạn có thay đổi chưa lưu — hãy Lưu nháp trước khi gửi bác sĩ.', 'error'); return }
    setSaving(true)
    try {
      const isResubmit = appt.ket_qua.status === 'yeu_cau_chinh_sua'
      await (isResubmit ? nurseService.resubmit(appt.ket_qua.id) : nurseService.submit(appt.ket_qua.id))
      showToast(isResubmit ? 'Đã gửi lại hồ sơ cho bác sĩ' : 'Đã gửi hồ sơ cho bác sĩ xác nhận')
      load()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Không thể gửi hồ sơ', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckin() {
    if (!id || checkingIn) return // chống bấm lặp
    setCheckingIn(true)
    try {
      await nurseService.checkinQueue({ appointment_id: id })
      showToast('Đã tiếp nhận bệnh nhân — đưa vào hàng đợi khám')
    } catch (err: any) {
      // Trạng thái có thể đã đổi từ nơi khác (đã tiếp nhận / đã hủy / khác ngày / ngoài ca)
      // -> hiển thị lý do từ backend + nạp lại để đồng bộ trạng thái mới nhất.
      showToast(err.response?.data?.message || 'Không thể tiếp nhận bệnh nhân', 'error')
    } finally {
      setShowCheckinConfirm(false)
      setCheckingIn(false)
      load() // refetch đồng bộ dù thành công hay lỗi conflict
    }
  }

  return (
    <div>
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}

      <ConfirmDialog
        open={showCheckinConfirm}
        title="Tiếp nhận bệnh nhân"
        message={`Xác nhận bệnh nhân "${appt.benh_nhan}" đã đến và đưa vào hàng đợi khám?`}
        confirmText={checkingIn ? 'Đang xử lý...' : 'Tiếp nhận'}
        confirmDisabled={checkingIn}
        onConfirm={handleCheckin}
        onCancel={() => setShowCheckinConfirm(false)}
      />

      <button onClick={handleBack} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <Icon name="chevron-down" className="h-3.5 w-3.5 rotate-90" /> Quay lại hàng đợi
      </button>

      <PageHeader
        title={appt.benh_nhan}
        description={`${appt.ma_lich_hen ?? appt.id} · ${formatDate(appt.ngay_kham)} ${appt.gio_kham}`}
      />

      {/* Tiếp nhận bệnh nhân (check-in) — chỉ hiện khi trạng thái/ngày cho phép; backend là chốt chặn cuối */}
      {(canCheckin || appt.da_check_in) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm">
            {appt.da_check_in ? (
              <>
                <Icon name="check" className="h-4 w-4 text-green-500" />
                <span className="font-medium text-green-700">Bệnh nhân đã được tiếp nhận</span>
              </>
            ) : (
              <>
                <Icon name="clock" className="h-4 w-4 text-amber-500" />
                <span className="text-slate-600">Bệnh nhân chưa được tiếp nhận</span>
              </>
            )}
          </div>
          {canCheckin && (
            <button
              onClick={() => setShowCheckinConfirm(true)}
              disabled={checkingIn}
              className="btn-primary disabled:opacity-50"
            >
              {checkingIn ? 'Đang tiếp nhận...' : 'Tiếp nhận bệnh nhân'}
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cột trái: thông tin bệnh nhân + lịch hẹn (chỉ xem) */}
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Thông tin bệnh nhân</p>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-slate-400">Tuổi/Giới tính</dt><dd className="text-slate-700">{[appt.tuoi !== undefined ? `${appt.tuoi} tuổi` : null, appt.gioi_tinh].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">Số điện thoại</dt><dd className="text-slate-700">{appt.so_dien_thoai ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">Bệnh nền</dt><dd className={appt.benh_nen ? 'font-medium text-amber-600' : 'text-slate-400'}>{appt.benh_nen ?? 'Không có'}</dd></div>
              <div><dt className="text-xs text-slate-400">Dị ứng</dt><dd className={appt.di_ung ? 'font-medium text-red-600' : 'text-slate-400'}>{appt.di_ung ?? 'Không có'}</dd></div>
            </dl>
          </div>

          <div className="card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Thông tin lịch hẹn</p>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-slate-400">Bác sĩ phụ trách</dt><dd className="text-slate-700">{appt.bac_si ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">Chuyên khoa</dt><dd className="text-slate-700">{appt.chuyen_khoa ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">Dịch vụ</dt><dd className="text-slate-700">{appt.ten_dich_vu ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">Phòng khám</dt><dd className="text-slate-700">{appt.phong_kham ?? appt.dia_chi_kham ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">Trạng thái</dt><dd><Badge color="blue">{APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status}</Badge></dd></div>
              <div><dt className="text-xs text-slate-400">Thanh toán (chỉ xem)</dt><dd><Badge color="gray">{PAYMENT_STATUS_LABEL[appt.payment_status]}</Badge></dd></div>
            </dl>
          </div>

          {appt.ly_do_kham && (
            <div className="card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Lý do khám</p>
              <p className="text-sm text-slate-700">{appt.ly_do_kham}</p>
            </div>
          )}
        </div>

        {/* Cột phải: tiếp nhận ban đầu + form hồ sơ khám */}
        <div className="space-y-4 lg:col-span-2">
          {ketQuaStatus === 'yeu_cau_chinh_sua' && appt.ket_qua?.doctor_revision_note && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <Icon name="alert-circle" className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Bác sĩ yêu cầu chỉnh sửa</p>
                <p>{appt.ket_qua.doctor_revision_note}</p>
              </div>
            </div>
          )}
          {/* Lịch sử đầy đủ các lần xác nhận/yêu cầu chỉnh sửa — trước đây y tá chỉ thấy lý do
              mới nhất ở trên, không thấy toàn bộ dòng thời gian như bác sĩ (GAP-013). */}
          {appt.ket_qua?.lich_su_sua && appt.ket_qua.lich_su_sua.length > 0 && (
            <div className="card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Lịch sử thay đổi</p>
              <ul className="space-y-2">
                {appt.ket_qua.lich_su_sua.map((h, i) => {
                  const nguoiThucHien = typeof h.nguoi_sua_id === 'object' ? h.nguoi_sua_id?.ho_ten : undefined
                  return (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                      <div>
                        <p className="text-slate-700">{h.noi_dung ?? 'Cập nhật hồ sơ'}</p>
                        <p className="mt-0.5 text-slate-400">
                          {formatDateTime(h.thoi_diem_sua)}
                          {nguoiThucHien && ` · ${nguoiThucHien}`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {ketQuaStatus === 'cho_xac_nhan' && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <Icon name="clock" className="h-4 w-4 shrink-0" /> Hồ sơ đang chờ bác sĩ xác nhận — chỉ xem, không sửa được lúc này.
            </div>
          )}
          {ketQuaStatus === 'da_xac_nhan' && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Hồ sơ đã được bác sĩ xác nhận — chỉ xem, không thể chỉnh sửa.</p>
                {(appt.ket_qua?.nguoi_xac_nhan || appt.ket_qua?.thoi_diem_xac_nhan) && (
                  <p className="mt-0.5 text-green-600">
                    {appt.ket_qua?.nguoi_xac_nhan && `Người xác nhận: ${appt.ket_qua.nguoi_xac_nhan}`}
                    {appt.ket_qua?.nguoi_xac_nhan && appt.ket_qua?.thoi_diem_xac_nhan && ' · '}
                    {appt.ket_qua?.thoi_diem_xac_nhan && `Lúc ${formatDateTime(appt.ket_qua.thoi_diem_xac_nhan)}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {!canFillForm && !appt.ket_qua && (
            <div className="card flex flex-col items-center gap-2 py-10 text-center text-slate-400">
              <Icon name="ban" className="h-8 w-8" />
              <p className="text-sm">Lịch hẹn đã hủy/không đến — không thể nhập hồ sơ khám.</p>
            </div>
          )}

          {(canFillForm || appt.ket_qua) && (
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tiếp nhận ban đầu</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <label className="input-label text-[10px]">Huyết áp</label>
                  <input className="input py-1.5 text-sm" readOnly={!isEditable} value={huyetAp} onChange={(e) => setHuyetAp(e.target.value)} placeholder="120/80" />
                </div>
                <div>
                  <label className="input-label text-[10px]">Mạch (l/p)</label>
                  <input type="number" className="input py-1.5 text-sm" readOnly={!isEditable} value={nhipTim} onChange={(e) => setNhipTim(e.target.value)} />
                </div>
                <div>
                  <label className="input-label text-[10px]">Nhiệt độ (°C)</label>
                  <input type="number" className="input py-1.5 text-sm" readOnly={!isEditable} value={nhietDo} onChange={(e) => setNhietDo(e.target.value)} />
                </div>
                <div>
                  <label className="input-label text-[10px]">Cân nặng (kg)</label>
                  <input type="number" className="input py-1.5 text-sm" readOnly={!isEditable} value={canNang} onChange={(e) => setCanNang(e.target.value)} />
                </div>
                <div>
                  <label className="input-label text-[10px]">Chiều cao (cm)</label>
                  <input type="number" className="input py-1.5 text-sm" readOnly={!isEditable} value={chieuCao} onChange={(e) => setChieuCao(e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <label className="input-label text-[10px]">Triệu chứng ban đầu</label>
                <textarea className="input resize-none" rows={2} readOnly={!isEditable} value={trieuChung} onChange={(e) => setTrieuChung(e.target.value)} placeholder="Bệnh nhân mô tả triệu chứng..." />
              </div>
              <div className="mt-3">
                <label className="input-label text-[10px]">Ghi chú điều dưỡng</label>
                <textarea className="input resize-none" rows={2} readOnly={!isEditable} value={ghiChuDieuDuong} onChange={(e) => setGhiChuDieuDuong(e.target.value)} placeholder="Ghi chú thêm cho bác sĩ..." />
              </div>
            </div>
          )}

          {(canFillForm || appt.ket_qua) && (
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hồ sơ khám</p>
                {ketQuaStatus && <Badge color={KET_QUA_STATUS_COLOR[ketQuaStatus]}>{KET_QUA_STATUS_LABEL[ketQuaStatus]}</Badge>}
              </div>
              {isEditable && (
                <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Icon name="alert-circle" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Nội dung chuyên môn dưới đây là <span className="font-semibold">ghi nhận theo kết luận của bác sĩ</span> — y tá nhập hộ, không phải chẩn đoán do y tá tự đưa ra.
                </p>
              )}

              <div>
                <label className="input-label">Chẩn đoán (theo bác sĩ) <span className="text-red-500">*</span></label>
                <textarea
                  className={`input resize-none ${chanDoanError ? 'border-red-400' : ''}`}
                  rows={2}
                  readOnly={!isEditable}
                  value={chanDoan}
                  onChange={(e) => { setChanDoan(e.target.value); if (chanDoanError) setChanDoanError('') }}
                  placeholder="Ghi lại kết luận chẩn đoán của bác sĩ..."
                />
                {chanDoanError && <p className="mt-1 text-xs font-medium text-red-500">{chanDoanError}</p>}
              </div>
              <div className="mt-3">
                <label className="input-label">Hướng dẫn điều trị</label>
                <textarea className="input resize-none" rows={2} readOnly={!isEditable} value={huongDan} onChange={(e) => setHuongDan(e.target.value)} />
              </div>
              <div className="mt-3">
                <label className="input-label">Ghi chú bổ sung</label>
                <textarea className="input resize-none" rows={2} readOnly={!isEditable} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
              </div>
              <div className="mt-3 sm:w-48">
                <label className="input-label">Ngày tái khám</label>
                <input type="date" className="input" min={minNgayTaiKham} readOnly={!isEditable} value={ngayTaiKham} onChange={(e) => setNgayTaiKham(e.target.value)} />
              </div>

              {isEditable && (
                <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-3">
                  <button onClick={handleSaveDraft} disabled={saving} className="btn-secondary">
                    {saving ? 'Đang lưu...' : (appt.ket_qua ? 'Cập nhật' : 'Lưu nháp')}
                  </button>
                  {appt.ket_qua && (
                    <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                      {saving ? 'Đang gửi...' : (ketQuaStatus === 'yeu_cau_chinh_sua' ? 'Gửi lại bác sĩ' : 'Gửi bác sĩ xác nhận')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
