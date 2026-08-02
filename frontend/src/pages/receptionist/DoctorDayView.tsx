import { useEffect, useState } from 'react'
import { DayOverview, DayOverviewDoctor, DayOverviewKhungRow, receptionistBookingService } from '@/services/receptionist-booking.service'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function dayStatusLabel(status: DayOverviewDoctor['trang_thai_ngay']) {
  return ({
    lam_viec: 'Đang làm việc',
    nghi: 'Nghỉ',
    nghi_phep: 'Nghỉ phép',
    khong_co_lich: 'Không có lịch',
  } as Record<string, string>)[status] ?? status
}

function cellTone(row: DayOverviewKhungRow) {
  if (row.khoa_boi_nghi_phep) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (row.con_trong === 0) return 'border-slate-200 bg-slate-100 text-slate-400'
  if (row.con_trong <= 1) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function KhungGrid({ rows, emptyLabel }: { rows: DayOverviewKhungRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <div className="flex min-h-14 items-center rounded-lg border border-dashed border-slate-200 px-3 text-xs text-slate-400">{emptyLabel}</div>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((row) => (
        <div
          key={row.khung_index}
          title={row.khoa_boi_nghi_phep ? 'Bị khoá vì bác sĩ nghỉ phép khung này' : `${row.con_trong}/${row.tong_slot} slot còn trống`}
          className={`flex min-w-16 flex-col items-center rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${cellTone(row)}`}
        >
          <span>{row.gio_bat_dau}</span>
          <span>{row.khoa_boi_nghi_phep ? 'Khoá' : `${row.con_trong}/${row.tong_slot}`}</span>
        </div>
      ))}
    </div>
  )
}

export default function DoctorDayView() {
  const [date, setDate] = useState(today())
  const [overview, setOverview] = useState<DayOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    receptionistBookingService
      .getDayOverview(date)
      .then((result) => {
        if (!cancelled) setOverview(result)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể tải lịch bác sĩ trong ngày')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date])

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Điều phối · Xem trước khi dời lịch hoặc chuyển bác sĩ</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-800">Lịch bác sĩ trong ngày</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Mỗi ô là 1 khung giờ 30 phút, số hiển thị là số slot còn trống / tổng slot của khung đó.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Ngày
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 block min-h-11 rounded-xl border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </label>
      </div>

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Đang tải lịch bác sĩ...</div>
      ) : !overview || overview.doctors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Không có bác sĩ nào đang hoạt động.</div>
      ) : (
        <div className="space-y-4">
          {overview.doctors.map((doctor) => (
            <div key={doctor.doctor_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-800">{doctor.ten_bac_si}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    doctor.trang_thai_ngay === 'lam_viec'
                      ? 'bg-emerald-100 text-emerald-800'
                      : doctor.trang_thai_ngay === 'nghi_phep'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {dayStatusLabel(doctor.trang_thai_ngay)}
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ca sáng (08:00–11:30)</p>
                  <KhungGrid rows={doctor.ca_sang} emptyLabel={doctor.trang_thai_ngay === 'khong_co_lich' ? 'Không có lịch' : 'Không có khung ca sáng'} />
                </div>
                <div className="border-t border-dashed border-slate-200 pt-4 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ca chiều (13:30–17:30)</p>
                  <KhungGrid rows={doctor.ca_chieu} emptyLabel={doctor.trang_thai_ngay === 'khong_co_lich' ? 'Không có lịch' : 'Không có khung ca chiều'} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
