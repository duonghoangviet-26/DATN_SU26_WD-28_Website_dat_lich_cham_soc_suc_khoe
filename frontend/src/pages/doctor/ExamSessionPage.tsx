import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import PageHeader from '@/components/common/PageHeader'
import Modal from '@/components/common/Modal'
import Icon from '@/components/admin/icons'
import StepTiepNhan from '@/components/doctor/exam/StepTiepNhan'
import StepChanDoan from '@/components/doctor/exam/StepChanDoan'
import StepDichVu from '@/components/doctor/exam/StepDichVu'
import StepKeDon from '@/components/doctor/exam/StepKeDon'
import StepXacNhan from '@/components/doctor/exam/StepXacNhan'
import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { BuocKham, CanhBaoDiUngItem, MucDoThongBaoLeTan, PhienKham } from '@/services/doctor-exam-session.service'

// Thứ tự 5 bước — PHẢI khớp CAC_BUOC ở backend (examStepRules.js). Không import được
// file backend vào bundle FE nên khai lại làm hằng số riêng ở đây.
const CAC_BUOC: BuocKham[] = ['tiep_nhan', 'chan_doan', 'dich_vu', 'ke_don', 'hoan_tat']

const TEN_BUOC: Record<BuocKham, string> = {
  tiep_nhan: 'Tiếp nhận',
  chan_doan: 'Chẩn đoán',
  dich_vu: 'Dịch vụ',
  ke_don: 'Kê đơn',
  hoan_tat: 'Xác nhận',
}

function extractApiMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message?.trim() || fallback
}

// B47 — lỗi 409 kèm danh sách thuốc khả nghi trùng dị ứng (xem utils/response.js `fail(..., data)`).
function extractCanhBaoDiUng(err: unknown): CanhBaoDiUngItem[] | null {
  const data = (err as {
    response?: { status?: number; data?: { data?: { canh_bao_di_ung?: CanhBaoDiUngItem[] } } }
  })?.response
  if (data?.status !== 409) return null
  const list = data.data?.data?.canh_bao_di_ung
  return list && list.length > 0 ? list : null
}

function nhanGioiTinh(gioiTinh: string | null) {
  if (gioiTinh === 'nam') return 'Nam'
  if (gioiTinh === 'nu') return 'Nữ'
  if (gioiTinh === 'khac') return 'Khác'
  return null
}

function nhanNguon(nguon: string) {
  return nguon === 'online' ? 'Đặt online' : 'Vãng lai'
}

function dinhDangNgaySinh(ngaySinh: string | null) {
  if (!ngaySinh) return null
  const date = new Date(ngaySinh)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('vi-VN')
}

function coGiaTriYTe(value: string | null) {
  const text = value?.trim()
  if (!text) return false
  return !['không', 'khong', 'không có', 'khong co', 'none', 'n/a'].includes(text.toLowerCase())
}

function dinhDangNgay(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('vi-VN')
}

// ─── Banner hồ sơ đợt trước cho ca tái khám ──────────────────────────────────
function HoSoCuBanner({ hoSoCu }: { hoSoCu: NonNullable<PhienKham['ho_so_cu']> }) {
  const [expanded, setExpanded] = useState(true)
  const ngay = dinhDangNgay(hoSoCu.ngay_kham)

  return (
    <div className="card mb-4 overflow-hidden border-l-4 border-violet-500">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between bg-violet-50 px-4 py-3 text-left hover:bg-violet-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📜</span>
          <span className="text-sm font-bold text-violet-800">HỒ SƠ ĐỢT TRƯỚC</span>
          {ngay && <span className="text-xs text-violet-600 font-medium">— Ngày khám: {ngay}</span>}
          {hoSoCu.ten_bac_si && <span className="text-xs text-violet-600">| BS: {hoSoCu.ten_bac_si}</span>}
        </div>
        <span className="text-xs font-semibold text-violet-600">{expanded ? '▲ Thu gọn' : '▼ Xem chi tiết'}</span>
      </button>

      {expanded && (
        <div className="grid gap-4 p-4 lg:grid-cols-3 bg-white">
          {/* Chẩn đoán & hướng dẫn */}
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Chẩn đoán cũ</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{hoSoCu.chan_doan || '—'}</p>
            </div>
            {hoSoCu.huong_dan_dieu_tri && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Hướng dẫn điều trị cũ</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{hoSoCu.huong_dan_dieu_tri}</p>
              </div>
            )}
            {hoSoCu.ghi_chu && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Lưu ý đợt trước</p>
                <p className="text-sm text-slate-600 italic">{hoSoCu.ghi_chu}</p>
              </div>
            )}
          </div>

          {/* Sinh hiệu cũ */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Sinh hiệu đợt trước</p>
            {hoSoCu.sinh_hieu ? (
              <dl className="space-y-1">
                {[
                  { label: 'Cân nặng', value: hoSoCu.sinh_hieu.can_nang ? `${hoSoCu.sinh_hieu.can_nang} kg` : null },
                  { label: 'Chiều cao', value: hoSoCu.sinh_hieu.chieu_cao ? `${hoSoCu.sinh_hieu.chieu_cao} cm` : null },
                  { label: 'Huyết áp', value: hoSoCu.sinh_hieu.huyet_ap },
                  { label: 'Nhiệt độ', value: hoSoCu.sinh_hieu.nhiet_do ? `${hoSoCu.sinh_hieu.nhiet_do} °C` : null },
                  { label: 'Nhịp tim', value: hoSoCu.sinh_hieu.nhip_tim ? `${hoSoCu.sinh_hieu.nhip_tim} bpm` : null },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="flex justify-between text-sm border-b border-slate-100 pb-0.5">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-800">{value}</span>
                  </div>
                ) : null)}
              </dl>
            ) : (
              <p className="text-sm text-slate-400">Chưa có dữ liệu sinh hiệu</p>
            )}
          </div>

          {/* Đơn thuốc cũ */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Đơn thuốc đợt trước</p>
            {hoSoCu.thuoc.length > 0 ? (
              <ul className="space-y-1.5">
                {hoSoCu.thuoc.map((t, i) => (
                  <li key={i} className="rounded-md bg-slate-50 px-3 py-1.5 text-sm">
                    <span className="font-semibold text-slate-800">{t.ten_thuoc}</span>
                    {t.lieu_luong && <span className="text-slate-500"> — {t.lieu_luong}</span>}
                    {t.so_ngay && <span className="text-slate-400 text-xs"> ({t.so_ngay} ngày)</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Không có đơn thuốc đợt trước</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamSessionPage() {
  const { queueId } = useParams<{ queueId: string }>()
  const navigate = useNavigate()

  const [phien, setPhien] = useState<PhienKham | null>(null)
  // buocDangXem là state RIÊNG của UI — cho phép bác sĩ bấm xem lại một bước đã qua
  // mà KHÔNG làm thay đổi tiến độ đã lưu (phien.buoc_hien_tai).
  const [buocDangXem, setBuocDangXem] = useState<BuocKham>('tiep_nhan')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // B47 — khi backend chặn kê đơn vì trùng dị ứng: giữ lại payload đang chờ + danh sách cảnh
  // báo, để bác sĩ xác nhận bất chấp kèm lý do rồi gửi lại đúng payload đó.
  const [canhBaoDiUng, setCanhBaoDiUng] = useState<CanhBaoDiUngItem[] | null>(null)
  const [payloadChoXacNhan, setPayloadChoXacNhan] = useState<Record<string, unknown> | null>(null)
  const [lyDoBatChap, setLyDoBatChap] = useState('')
  const [showNotifyReception, setShowNotifyReception] = useState(false)
  const [notifyPriority, setNotifyPriority] = useState<MucDoThongBaoLeTan>('warning')
  const [notifyContent, setNotifyContent] = useState('')
  const [notifySaving, setNotifySaving] = useState(false)
  const [notifyError, setNotifyError] = useState<string | null>(null)
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null)

  function load() {
    if (!queueId) return
    setLoading(true)
    setError(false)
    doctorExamSessionService
      .get(queueId)
      .then((data) => {
        setPhien(data)
        setBuocDangXem(data.buoc_hien_tai)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [queueId])

  // Lưu bước ĐANG XEM (buocDangXem), không phải buoc_hien_tai — cho phép sửa lại một
  // bước đã qua rồi lưu, đúng nghiệp vụ backend (PATCH .../step/:buoc theo buoc bất kỳ đã tới).
  async function handleNext(payload: Record<string, unknown>) {
    if (!queueId) return
    setSaving(true)
    setSaveError(null)
    try {
      const phienMoi = await doctorExamSessionService.saveStep(queueId, buocDangXem, payload)
      setPhien(phienMoi)
      setCanhBaoDiUng(null)
      setPayloadChoXacNhan(null)
      setLyDoBatChap('')
      // Sau khi lưu, nhảy tới đúng nơi server xác nhận đã tới — không tự suy đoán "bước kế tiếp".
      setBuocDangXem(phienMoi.buoc_hien_tai)
    } catch (e) {
      const canhBao = extractCanhBaoDiUng(e)
      if (canhBao) {
        // Không phải lỗi để hiện đỏ — mở modal xác nhận, giữ nguyên payload để gửi lại.
        setCanhBaoDiUng(canhBao)
        setPayloadChoXacNhan(payload)
      } else {
        setSaveError(extractApiMessage(e, 'Lưu thất bại, vui lòng thử lại'))
      }
    } finally {
      setSaving(false)
    }
  }

  function handleXacNhanBatChapDiUng() {
    if (!payloadChoXacNhan || !lyDoBatChap.trim()) return
    void handleNext({
      ...payloadChoXacNhan,
      xac_nhan_bat_chap_di_ung: true,
      ly_do_bat_chap_di_ung: lyDoBatChap.trim(),
    })
  }

  function handleHuyCanhBaoDiUng() {
    setCanhBaoDiUng(null)
    setPayloadChoXacNhan(null)
    setLyDoBatChap('')
  }

  async function sendReceptionNotice() {
    if (!queueId || !notifyContent.trim()) return
    setNotifySaving(true)
    setNotifyError(null)
    setNotifySuccess(null)
    try {
      await doctorExamSessionService.notifyReception(queueId, {
        muc_do: notifyPriority,
        noi_dung: notifyContent.trim(),
      })
      setNotifyContent('')
      setNotifySuccess('Đã gửi thông báo cho lễ tân')
      window.setTimeout(() => {
        setShowNotifyReception(false)
        setNotifySuccess(null)
      }, 800)
    } catch (e) {
      setNotifyError(extractApiMessage(e, 'Không gửi được thông báo cho lễ tân'))
    } finally {
      setNotifySaving(false)
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Đang tải...</div>
  }

  if (error || !phien) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
        <p className="text-sm font-medium text-red-600">Không tải được phiên khám.</p>
        <Button variant="secondary" size="sm" onClick={load}>
          Thử lại
        </Button>
      </div>
    )
  }

  const buocHienTaiIndex = CAC_BUOC.indexOf(phien.buoc_hien_tai)
  const gioiTinh = nhanGioiTinh(phien.queue.gioi_tinh)
  const ngaySinh = dinhDangNgaySinh(phien.queue.ngay_sinh)
  const thongTinNhanDien = [
    phien.queue.tuoi ? `${phien.queue.tuoi} tuổi` : null,
    ngaySinh ? `Sinh ${ngaySinh}` : null,
    gioiTinh,
    phien.queue.nhom_mau ? `Nhóm máu ${phien.queue.nhom_mau}` : null,
  ].filter(Boolean)
  const coCanhBaoDiUng = coGiaTriYTe(phien.queue.di_ung)
  const coBenhNen = coGiaTriYTe(phien.queue.benh_nen)
  const isTaiKham = phien.is_tai_kham ?? false
  const hoSoCu = phien.ho_so_cu ?? null

  return (
    <div>
      <PageHeader
        title={`Khám bệnh — ${phien.queue.ten_benh_nhan}`}
        description={phien.queue.ma_so_thu_tu ? `Số thứ tự ${phien.queue.ma_so_thu_tu}` : undefined}
      >
        <Button variant="secondary" size="sm" onClick={() => setShowNotifyReception(true)}
          icon={<Icon name="bell" className="h-3.5 w-3.5" />}>
          Báo lễ tân
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/pending-records')}
          icon={<Icon name="chevron-right" className="h-3.5 w-3.5 rotate-180" />}>
          Quay lại hàng đợi
        </Button>
      </PageHeader>

      {/* Tóm tắt bệnh nhân: chỉ giữ thông tin cần cho phiên khám hiện tại. */}
      <section className="card mb-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Icon name="user" className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">{phien.queue.ten_benh_nhan}</h2>
              {phien.queue.ma_so_thu_tu && <Badge color="gray">STT {phien.queue.ma_so_thu_tu}</Badge>}
              <Badge color={phien.queue.nguon === 'online' ? 'blue' : 'yellow'}>{nhanNguon(phien.queue.nguon)}</Badge>
              {isTaiKham ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 border border-violet-200 px-2.5 py-0.5 text-xs font-extrabold text-violet-800">
                  🔁 TÁI KHÁM
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  📋 KHÁM MỚI
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>{thongTinNhanDien.join(' · ') || 'Chưa có tuổi/giới tính/nhóm máu'}</span>
              {phien.queue.so_dien_thoai && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="phone" className="h-3.5 w-3.5 text-slate-400" />
                  {phien.queue.so_dien_thoai}
                </span>
              )}
              {phien.queue.phong_kham && <span>Phòng {phien.queue.phong_kham}</span>}
            </div>
            {phien.queue.ghi_chu?.trim() && (
              <p className="max-w-3xl text-xs leading-5 text-slate-600">
                <span className="font-medium text-slate-700">Ghi chú hồ sơ:</span> {phien.queue.ghi_chu.trim()}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
            {coCanhBaoDiUng ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <Icon name="alert-circle" className="h-3.5 w-3.5" />
                Dị ứng: {phien.queue.di_ung}
              </span>
            ) : (
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Chưa ghi nhận dị ứng
              </span>
            )}
            {coBenhNen ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                <Icon name="clipboard-list" className="h-3.5 w-3.5" />
                Bệnh nền: {phien.queue.benh_nen}
              </span>
            ) : (
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Chưa ghi nhận bệnh nền
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Banner hồ sơ đợt trước — chỉ hiển thị khi là tái khám có dữ liệu cũ */}
      {isTaiKham && hoSoCu && (
        <HoSoCuBanner hoSoCu={hoSoCu} />
      )}
      {isTaiKham && !hoSoCu && (
        <div className="card mb-4 flex items-center gap-3 border-l-4 border-violet-400 bg-violet-50 p-4">
          <span className="text-violet-600 font-medium text-sm">🔁 Đây là ca tái khám — chưa tìm thấy hồ sơ đợt trước đã xác nhận trong hệ thống.</span>
        </div>
      )}

      {/* Thanh 5 bước — chỉ bấm được bước đã tới (không cho nhảy trước, khớp rule backend) */}
      <div className="card mb-4 flex flex-wrap items-center gap-1 p-2">
        {CAC_BUOC.map((buoc, index) => {
          const daToi = index <= buocHienTaiIndex
          const dangXem = buoc === buocDangXem
          return (
            <button
              key={buoc}
              type="button"
              disabled={!daToi}
              onClick={() => setBuocDangXem(buoc)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                dangXem
                  ? 'bg-brand-600 text-white'
                  : daToi
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'cursor-not-allowed text-slate-300'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  dangXem ? 'bg-white/20' : daToi ? 'bg-slate-200 text-slate-600' : 'bg-slate-100'
                }`}
              >
                {index < buocHienTaiIndex ? <Icon name="check" className="h-3 w-3" /> : index + 1}
              </span>
              {TEN_BUOC[buoc]}
            </button>
          )
        })}
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}

      {/* Vùng nội dung theo bước đang xem */}
      <div className="card p-6">
        {buocDangXem === 'tiep_nhan' && <StepTiepNhan phien={phien} saving={saving} onNext={handleNext} />}
        {buocDangXem === 'chan_doan' && <StepChanDoan phien={phien} saving={saving} onNext={handleNext} />}
        {buocDangXem === 'dich_vu' && <StepDichVu phien={phien} saving={saving} onNext={handleNext} />}
        {buocDangXem === 'ke_don' && <StepKeDon phien={phien} saving={saving} onNext={handleNext} />}
        {buocDangXem === 'hoan_tat' && (
          <StepXacNhan phien={phien} saving={saving} onNext={handleNext} onEditStep={setBuocDangXem} />
        )}
      </div>

      {/* Báo lễ tân — nội dung tự do, không giới hạn mẫu cố định (VD: khám nhanh/chậm hơn dự
          kiến, bác sĩ bận về sớm, sẵn sàng nhận bệnh nhân tiếp theo...). */}
      <Modal isOpen={showNotifyReception} onClose={() => setShowNotifyReception(false)} title="Báo lễ tân" size="sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Mức độ ưu tiên</label>
            <select
              value={notifyPriority}
              onChange={(event) => setNotifyPriority(event.target.value as MucDoThongBaoLeTan)}
              className="input w-full"
            >
              <option value="urgent">Khẩn — cần lễ tân xử lý ngay</option>
              <option value="warning">Cần chú ý / điều phối</option>
              <option value="info">Thông tin, không gấp</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nội dung gửi lễ tân</label>
            <textarea
              value={notifyContent}
              onChange={(event) => setNotifyContent(event.target.value)}
              rows={5}
              placeholder="VD: Khám nhanh hơn dự kiến, có thể gọi bệnh nhân tiếp theo sớm. Hoặc: Ca này trễ khoảng 15-20 phút, nhờ báo trước cho người đang chờ. Hoặc: Tôi có việc bận, 17:00 sẽ về sớm — nhờ chuyển các ca sau cho bác sĩ khác."
              className="input w-full"
            />
          </div>
          {notifyError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{notifyError}</p>}
          {notifySuccess && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notifySuccess}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNotifyReception(false)} className="btn-secondary">
              Hủy
            </button>
            <button
              type="button"
              disabled={notifySaving || !notifyContent.trim()}
              onClick={sendReceptionNotice}
              className="btn-primary disabled:opacity-40"
            >
              {notifySaving ? 'Đang gửi...' : 'Gửi lễ tân'}
            </button>
          </div>
        </div>
      </Modal>

      {/* B47 — cảnh báo dị ứng khả nghi: chặn lưu cho tới khi bác sĩ xác nhận bất chấp kèm lý do. */}
      <Modal isOpen={canhBaoDiUng !== null} onClose={handleHuyCanhBaoDiUng} title="Cảnh báo dị ứng thuốc" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Phát hiện thuốc trùng khả nghi với dị ứng đã ghi nhận của bệnh nhân
            {phien.queue.di_ung ? <> (<span className="font-medium text-red-600">{phien.queue.di_ung}</span>)</> : null}.
            Đây là cảnh báo theo từ khóa trùng chữ, không phải tra cứu tương tác thuốc chuyên môn —
            vui lòng xác nhận lại trước khi tiếp tục.
          </p>
          <ul className="space-y-1.5 rounded-lg bg-red-50 p-3 text-sm">
            {(canhBaoDiUng ?? []).map((c) => (
              <li key={c.ten_thuoc} className="text-red-700">
                <span className="font-semibold">{c.ten_thuoc}</span> — trùng từ khóa:{' '}
                {c.tu_khoa_trung.join(', ')}
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              Lý do kê thuốc bất chấp cảnh báo <span className="text-red-500">*</span>
            </span>
            <textarea
              value={lyDoBatChap}
              onChange={(e) => setLyDoBatChap(e.target.value)}
              rows={3}
              placeholder="vd: đã hỏi lại bệnh nhân, dị ứng cũ không còn / chỉ trùng tên chứ khác hoạt chất..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-3">
            <button onClick={handleHuyCanhBaoDiUng} className="btn-secondary">
              Hủy, sửa lại đơn
            </button>
            <button
              onClick={handleXacNhanBatChapDiUng}
              disabled={saving || !lyDoBatChap.trim()}
              className="btn-danger disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Xác nhận vẫn kê đơn'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
