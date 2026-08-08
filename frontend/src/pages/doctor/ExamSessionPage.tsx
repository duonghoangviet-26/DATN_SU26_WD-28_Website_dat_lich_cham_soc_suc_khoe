import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import StepTiepNhan from '@/components/doctor/exam/StepTiepNhan'
import StepChanDoan from '@/components/doctor/exam/StepChanDoan'
import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { BuocKham, PhienKham } from '@/services/doctor-exam-session.service'

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

function nhanGioiTinh(gioiTinh: string | null) {
  if (gioiTinh === 'nam') return 'Nam'
  if (gioiTinh === 'nu') return 'Nữ'
  if (gioiTinh === 'khac') return 'Khác'
  return null
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
      // Sau khi lưu, nhảy tới đúng nơi server xác nhận đã tới — không tự suy đoán "bước kế tiếp".
      setBuocDangXem(phienMoi.buoc_hien_tai)
    } catch (e) {
      setSaveError(extractApiMessage(e, 'Lưu thất bại, vui lòng thử lại'))
    } finally {
      setSaving(false)
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

      {/* Header thông tin bệnh nhân */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <Icon name="user" className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">{phien.queue.ten_benh_nhan}</span>
        </div>
        <span className="text-xs text-slate-400">
          {[phien.queue.tuoi ? `${phien.queue.tuoi} tuổi` : null, gioiTinh, phien.queue.nhom_mau ? `Nhóm máu ${phien.queue.nhom_mau}` : null]
            .filter(Boolean)
            .join(' · ') || '—'}
        </span>
        <Badge color={phien.queue.nguon === 'online' ? 'blue' : 'yellow'}>
          {phien.queue.nguon === 'online' ? 'Đặt online' : 'Vãng lai'}
        </Badge>
        {phien.queue.phong_kham && <span className="text-xs text-slate-400">Phòng {phien.queue.phong_kham}</span>}
        {(phien.queue.di_ung || phien.queue.benh_nen) && (
          <div className="ml-auto flex flex-wrap gap-2">
            {phien.queue.di_ung && (
              <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                Dị ứng: {phien.queue.di_ung}
              </span>
            )}
            {phien.queue.benh_nen && (
              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                Bệnh nền: {phien.queue.benh_nen}
              </span>
            )}
          </div>
        )}
      </div>

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
        {(buocDangXem === 'dich_vu' || buocDangXem === 'ke_don' || buocDangXem === 'hoan_tat') && (
          <p className="text-sm text-slate-500">Đang xây dựng</p>
        )}
      </div>
    </div>
  )
}
