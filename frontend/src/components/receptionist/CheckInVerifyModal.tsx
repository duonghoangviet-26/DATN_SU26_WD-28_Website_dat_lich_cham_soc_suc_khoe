import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PatientProfile, receptionistPatientIntakeService } from '@/services/receptionist-patient-intake.service'

function formatDate(value?: string | null) {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleDateString('vi-VN')
}

function calcAge(value?: string | null) {
  if (!value) return null
  const birth = new Date(value)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
  return age
}

function genderLabel(value?: string | null) {
  return ({ nam: 'Nam', nu: 'Nữ', khac: 'Khác' } as Record<string, string>)[value ?? ''] ?? 'Chưa rõ giới tính'
}

interface CheckInVerifyModalProps {
  appointmentId: string
  maLichHen?: string | null
  searchPhone: string
  onClose: () => void
  onCheckedIn: (result: { hang_doi: { phong_kham?: string | null; ma_so_thu_tu?: string | null }; canh_bao: string[]; ten_benh_nhan: string }) => void
}

export default function CheckInVerifyModal({ appointmentId, maLichHen, searchPhone, onClose, onCheckedIn }: CheckInVerifyModalProps) {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<PatientProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchError, setSearchError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSearchError('')
    receptionistPatientIntakeService
      .searchByPhone(searchPhone)
      .then((result) => {
        if (cancelled) return
        setProfiles(result.profiles)
        if (result.profiles.length === 1 && !result.profiles[0].luot_dang_cho_hom_nay) {
          setSelectedId(result.profiles[0].id)
        }
      })
      .catch((requestError) => {
        if (!cancelled) setSearchError(requestError?.response?.data?.message || 'Không thể tra cứu hồ sơ theo số điện thoại này')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchPhone])

  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === selectedId) ?? null, [profiles, selectedId])

  const confirm = async () => {
    if (!selectedProfile) return
    setConfirming(true)
    setConfirmError('')
    setNeedsVerification(false)
    try {
      const result = await receptionistPatientIntakeService.checkInAppointment(appointmentId, {
        ho_so_benh_nhan_id: selectedProfile.id,
        so_dien_thoai: selectedProfile.so_dien_thoai || searchPhone,
        ho_ten: selectedProfile.ho_ten,
      })
      onCheckedIn({ hang_doi: result.hang_doi, canh_bao: result.canh_bao, ten_benh_nhan: selectedProfile.ho_ten })
    } catch (requestError: any) {
      const status = requestError?.response?.status
      const message = requestError?.response?.data?.message || ''
      if (status === 409) {
        setNeedsVerification(true)
        setConfirmError(message || 'Lịch hẹn không thuộc đúng bệnh nhân vừa xác nhận. Vui lòng chọn lại đúng hồ sơ.')
      } else if (status === 404) {
        setConfirmError(message || 'Không tìm thấy hồ sơ bệnh nhân đang hoạt động. Vui lòng tra cứu lại.')
      } else {
        setConfirmError(message || 'Chưa thể ghi nhận người bệnh đến khám.')
      }
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800">Xác nhận đúng người bệnh</h3>
        <p className="mt-1 text-sm text-slate-500">
          {maLichHen ? `Lịch hẹn ${maLichHen} · ` : ''}Số liên hệ tra cứu: {searchPhone || 'không có'}
        </p>

        {loading && <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tra cứu hồ sơ...</div>}

        {!loading && searchError && (
          <p className="mt-6 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{searchError}</p>
        )}

        {!loading && !searchError && profiles.length === 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Cần xác minh</p>
            <p className="mt-1">Không tìm thấy hồ sơ bệnh nhân nào theo số điện thoại này. Hãy sang màn Tiếp nhận tại quầy để tạo hồ sơ trước khi check-in.</p>
            <Link to="/receptionist/patient-intake" className="mt-3 inline-block rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
              Sang Tiếp nhận tại quầy
            </Link>
          </div>
        )}

        {!loading && !searchError && profiles.length > 0 && (
          <div className="mt-5 space-y-2">
            {profiles.map((profile) => {
              const disabled = Boolean(profile.luot_dang_cho_hom_nay)
              const age = calcAge(profile.ngay_sinh)
              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedId(profile.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : selectedId === profile.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{profile.ho_ten}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(profile.ngay_sinh)}{age !== null ? ` · ${age} tuổi` : ''} · {genderLabel(profile.gioi_tinh)} · SĐT: {profile.so_dien_thoai || 'chưa có'}
                      </p>
                      {(profile.quan_he || profile.nhom_gia_dinh) && (
                        <p className="mt-1 text-xs text-slate-500">
                          {profile.quan_he ? `Quan hệ: ${profile.quan_he}` : ''}{profile.quan_he && profile.nhom_gia_dinh ? ' · ' : ''}{profile.nhom_gia_dinh ? `Nhóm gia đình: ${profile.nhom_gia_dinh}` : ''}
                        </p>
                      )}
                    </div>
                    {disabled && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Đã có lượt trong hàng đợi</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {needsVerification && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Cần xác minh</p>
            <p className="mt-1">{confirmError}</p>
          </div>
        )}
        {!needsVerification && confirmError && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{confirmError}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selectedProfile || confirming}
            className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirming ? 'Đang xác nhận...' : 'Xác nhận đã đến'}
          </button>
        </div>
      </div>
    </div>
  )
}
