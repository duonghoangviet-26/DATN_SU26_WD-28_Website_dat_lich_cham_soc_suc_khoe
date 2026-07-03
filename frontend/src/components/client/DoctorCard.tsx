import type { DoctorProfile } from '@/types'

interface Props {
  doctor: DoctorProfile
  onBook: () => void
}

export default function DoctorCard({ doctor, onBook }: Props) {
  const initial = doctor.ho_ten.trim().split(' ').slice(-1)[0]?.[0] ?? 'BS'

  return (
    <div className="card grid gap-4 p-5 sm:grid-cols-2">
      {/* Trái: hồ sơ bác sĩ */}
      <div className="flex gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-100 text-xl font-bold text-brand-600">
          {initial}
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">{doctor.ho_ten}</h3>
          <p className="text-sm text-brand-600">{doctor.chuyen_khoa}</p>
          <p className="mt-1 text-sm text-slate-500">{doctor.so_nam_kinh_nghiem} năm kinh nghiệm</p>
          <p className="text-sm text-slate-500">{doctor.bang_cap}</p>
          {doctor.diem_danh_gia > 0 && (
            <p className="mt-1 text-sm text-amber-600">
              ★ {doctor.diem_danh_gia.toFixed(1)} ({doctor.so_danh_gia} đánh giá)
            </p>
          )}
        </div>
      </div>

      {/* Phải: thông tin đặt lịch */}
      <div className="flex flex-col justify-between border-t border-slate-100 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-slate-800">
            {doctor.gia_kham.toLocaleString('vi-VN')}đ <span className="font-normal text-slate-500">/ 30 phút</span>
          </p>

          {(doctor.bao_hiem?.nha_nuoc || doctor.bao_hiem?.bao_lanh) && (
            <div className="flex flex-wrap gap-1.5">
              {doctor.bao_hiem?.nha_nuoc && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">BHYT nhà nước</span>
              )}
              {doctor.bao_hiem?.bao_lanh && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Bảo lãnh viện phí</span>
              )}
            </div>
          )}

          {doctor.related_services && doctor.related_services.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">Dịch vụ có thể được bác sĩ chỉ định:</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {doctor.related_services.map((s) => (
                  <li key={s.id}>• {s.ten} — {s.gia.toLocaleString('vi-VN')}đ</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button onClick={onBook} className="btn-primary mt-4 w-full text-sm">
          Đặt lịch
        </button>
      </div>
    </div>
  )
}
