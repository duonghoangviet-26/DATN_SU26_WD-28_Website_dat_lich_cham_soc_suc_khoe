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
import type { BuocKham, CanhBaoDiUngItem, PhienKham } from '@/services/doctor-exam-session.service'

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

  return (
    <div>
      <PageHeader
        title={`Khám bệnh — ${phien.queue.ten_benh_nhan}`}
        description={phien.queue.ma_so_thu_tu ? `Số thứ tự ${phien.queue.ma_so_thu_tu}` : undefined}
      >
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
