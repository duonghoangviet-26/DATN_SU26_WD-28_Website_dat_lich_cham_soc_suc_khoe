import { FormEvent, useState } from 'react'
import Modal from '@/components/common/Modal'
import {
  PatientProfile,
  receptionistPatientIntakeService,
} from '@/services/receptionist-patient-intake.service'

// D81 — Bệnh nhân không có/không nhớ số điện thoại. Modal này CÔ LẬP với toàn bộ state
// tra cứu-theo-SĐT của PatientIntake.tsx (phone/profiles/selectedId...) — không sửa bất kỳ
// hàm nào ở đó. Khi tạo/tra được hồ sơ, chỉ trả về qua onProfileReady để trang cha tự đặt
// vào state `profiles`/`selectedId` sẵn có, rồi toàn bộ luồng chọn chuyên khoa/tiếp nhận vào
// hàng đợi trung tâm phía dưới dùng lại y nguyên, không cần biết hồ sơ đến từ đâu.

interface Props {
  open: boolean
  onClose: () => void
  onProfileReady: (profile: PatientProfile) => void
}

const emptyForm = {
  ho_ten: '',
  ngay_sinh: '',
  gioi_tinh: '' as '' | 'nam' | 'nu' | 'khac',
  ghi_chu: '',
}

function extractApiMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message?.trim() || fallback
}

export default function TempProfileModal({ open, onClose, onProfileReady }: Props) {
  const [tab, setTab] = useState<'create' | 'lookup'>('create')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdProfile, setCreatedProfile] = useState<PatientProfile | null>(null)
  const [copied, setCopied] = useState(false)

  const [maTam, setMaTam] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookupError, setLookupError] = useState('')

  function reset() {
    setTab('create')
    setForm(emptyForm)
    setSaving(false)
    setError('')
    setCreatedProfile(null)
    setCopied(false)
    setMaTam('')
    setLooking(false)
    setLookupError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!form.ho_ten.trim()) return setError('Họ tên là bắt buộc')
    if (!form.ngay_sinh) return setError('Ngày sinh là bắt buộc để nhận diện hồ sơ tạm')
    if (!form.gioi_tinh) return setError('Giới tính là bắt buộc để nhận diện hồ sơ tạm')
    if (!form.ghi_chu.trim()) return setError('Cần ghi chú đặc điểm nhận diện (vd: người đi cùng, đặc điểm ngoại hình)')

    setSaving(true)
    try {
      const profile = await receptionistPatientIntakeService.createTempProfile({
        ho_ten: form.ho_ten.trim(),
        ngay_sinh: form.ngay_sinh,
        gioi_tinh: form.gioi_tinh,
        ghi_chu: form.ghi_chu.trim(),
      })
      setCreatedProfile(profile)
    } catch (e) {
      setError(extractApiMessage(e, 'Tạo hồ sơ tạm thất bại, vui lòng thử lại'))
    } finally {
      setSaving(false)
    }
  }

  async function handleLookup(event: FormEvent) {
    event.preventDefault()
    setLookupError('')
    const code = maTam.trim().toUpperCase()
    if (!code) return setLookupError('Nhập mã tạm khách đưa cho bạn')

    setLooking(true)
    try {
      const profile = await receptionistPatientIntakeService.searchByTempCode(code)
      onProfileReady(profile)
      handleClose()
    } catch (e) {
      setLookupError(extractApiMessage(e, 'Không tìm thấy hồ sơ tạm với mã này'))
    } finally {
      setLooking(false)
    }
  }

  function copyCode() {
    if (!createdProfile?.ma_tam) return
    navigator.clipboard?.writeText(createdProfile.ma_tam).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal isOpen={open} onClose={handleClose} title="Bệnh nhân không có số điện thoại" size="sm">
      {createdProfile ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-600">
            Đã tạo hồ sơ tạm cho <span className="font-semibold text-slate-900">{createdProfile.ho_ten}</span>.
            Ghi mã này ra phiếu giấy đưa cho khách — dùng để tra cứu lại nếu quầy cần tìm hồ sơ sau này.
          </p>
          <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 py-4">
            <p className="text-2xl font-bold tracking-wide text-brand-800">{createdProfile.ma_tam}</p>
          </div>
          <button type="button" onClick={copyCode} className="btn-secondary w-full">
            {copied ? 'Đã sao chép' : 'Sao chép mã'}
          </button>
          <button
            type="button"
            onClick={() => {
              onProfileReady(createdProfile)
              handleClose()
            }}
            className="btn-primary w-full"
          >
            Tiếp tục chọn chuyên khoa cho hồ sơ này
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`flex-1 rounded-md py-1.5 ${tab === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Tạo hồ sơ tạm
            </button>
            <button
              type="button"
              onClick={() => setTab('lookup')}
              className={`flex-1 rounded-md py-1.5 ${tab === 'lookup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Tra cứu bằng mã
            </button>
          </div>

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-3">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Không có SĐT nên bắt buộc đủ 3 thông tin nhận diện dưới đây, tránh tạo hồ sơ trùng
                không kiểm soát được.
              </p>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Họ tên <span className="text-red-500">*</span></span>
                <input
                  value={form.ho_ten}
                  onChange={(e) => setForm((f) => ({ ...f, ho_ten: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Ngày sinh <span className="text-red-500">*</span></span>
                  <input
                    type="date"
                    value={form.ngay_sinh}
                    onChange={(e) => setForm((f) => ({ ...f, ngay_sinh: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Giới tính <span className="text-red-500">*</span></span>
                  <select
                    value={form.gioi_tinh}
                    onChange={(e) => setForm((f) => ({ ...f, gioi_tinh: e.target.value as typeof f.gioi_tinh }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">— Chọn —</option>
                    <option value="nam">Nam</option>
                    <option value="nu">Nữ</option>
                    <option value="khac">Khác</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Ghi chú đặc điểm nhận diện <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={form.ghi_chu}
                  onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))}
                  rows={2}
                  placeholder="vd: đi cùng con gái tên Lan, mặc áo xanh, không nhớ SĐT do mất điện thoại"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
                {saving ? 'Đang tạo...' : 'Tạo hồ sơ tạm'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLookup} className="space-y-3">
              <p className="text-sm text-slate-600">Nhập mã đã in cho khách ở lần tiếp nhận trước.</p>
              <input
                value={maTam}
                onChange={(e) => setMaTam(e.target.value)}
                placeholder="TEMP-20260814-001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
              />
              {lookupError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{lookupError}</p>}
              <button type="submit" disabled={looking} className="btn-primary w-full disabled:opacity-50">
                {looking ? 'Đang tìm...' : 'Tra cứu'}
              </button>
            </form>
          )}
        </div>
      )}
    </Modal>
  )
}
