import { useEffect, useState } from 'react'
import { DayOverview, DayOverviewDoctor, DayOverviewKhungRow, DoctorDayAppointment, receptionistBookingService } from '@/services/receptionist-booking.service'
import DoctorUnavailableModal from '@/components/receptionist/DoctorUnavailableModal'
import TimelinePanel from '@/components/receptionist/TimelinePanel'

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

const APPT_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  waiting_record: 'Đang khám',
  completed: 'Đã khám xong',
  cancelled: 'Đã huỷ',
  no_show: 'Không đến',
}

function cellTone(row: DayOverviewKhungRow) {
  if (row.khoa_boi_nghi_phep) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (row.con_trong === 0) return 'border-slate-200 bg-slate-100 text-slate-400'
  if (row.con_trong <= 1) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function KhungGrid({ rows, emptyLabel, onSelect }: { rows: DayOverviewKhungRow[]; emptyLabel: string; onSelect: (row: DayOverviewKhungRow) => void }) {
  if (rows.length === 0) {
    return <div className="flex min-h-14 items-center rounded-lg border border-dashed border-slate-200 px-3 text-xs text-slate-400">{emptyLabel}</div>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((row) => (
        <button
          type="button"
          key={row.khung_index}
          onClick={() => onSelect(row)}
          title={row.khoa_boi_nghi_phep ? 'Bị khoá vì bác sĩ nghỉ phép khung này — bấm để xem chi tiết' : `${row.con_trong}/${row.tong_slot} slot còn trống — bấm để xem ai đã đặt`}
          className={`flex min-w-16 flex-col items-center rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition hover:ring-2 hover:ring-brand-300 ${cellTone(row)}`}
        >
          <span>{row.gio_bat_dau}</span>
          <span>{row.khoa_boi_nghi_phep ? 'Khoá' : `${row.con_trong}/${row.tong_slot}`}</span>
        </button>
      ))}
    </div>
  )
}

interface SelectedKhung {
  doctorId: string
  doctorName: string
  row: DayOverviewKhungRow
}

export default function DoctorDayView() {
  const [date, setDate] = useState(today())
  const [overview, setOverview] = useState<DayOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedKhung, setSelectedKhung] = useState<SelectedKhung | null>(null)
  const [khungAppointments, setKhungAppointments] = useState<DoctorDayAppointment[]>([])
  const [khungLoading, setKhungLoading] = useState(false)
  // Cache theo "doctorId_date" — bam vao nhieu khung cua cung 1 bac si chi goi API 1 lan.
  const [appointmentsCache, setAppointmentsCache] = useState<Record<string, DoctorDayAppointment[]>>({})
  const [unavailableDoctor, setUnavailableDoctor] = useState<{ id: string; name: string } | null>(null)
  const [timelineApptId, setTimelineApptId] = useState<string | null>(null)

  const loadOverview = (onCancelledCheck?: () => boolean) => {
    setLoading(true)
    setError('')
    receptionistBookingService
      .getDayOverview(date)
      .then((result) => {
        if (!onCancelledCheck || !onCancelledCheck()) setOverview(result)
      })
      .catch((requestError) => {
        if (!onCancelledCheck || !onCancelledCheck()) setError(requestError?.response?.data?.message || 'Không thể tải lịch bác sĩ trong ngày')
      })
      .finally(() => {
        if (!onCancelledCheck || !onCancelledCheck()) setLoading(false)
      })
  }

  useEffect(() => {
    let cancelled = false
    loadOverview(() => cancelled)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const openKhung = async (doctorId: string, doctorName: string, row: DayOverviewKhungRow) => {
    setSelectedKhung({ doctorId, doctorName, row })
    const cacheKey = `${doctorId}_${date}`
    const cached = appointmentsCache[cacheKey]
    if (cached) {
      setKhungAppointments(cached.filter((appt) => appt.gio_kham === row.gio_bat_dau))
      return
    }
    setKhungLoading(true)
    setKhungAppointments([])
    try {
      const list = await receptionistBookingService.getAppointmentsForDoctorDay(doctorId, date)
      setAppointmentsCache((prev) => ({ ...prev, [cacheKey]: list }))
      setKhungAppointments(list.filter((appt) => appt.gio_kham === row.gio_bat_dau))
    } catch {
      setKhungAppointments([])
    } finally {
      setKhungLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Điều phối · Xem lịch, xử lý bác sĩ nghỉ đột xuất</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-800">Lịch bác sĩ trong ngày</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Mỗi ô là 1 khung giờ 30 phút, số hiển thị là số slot còn trống / tổng slot của khung đó. Bấm vào ô để xem ai đã đặt.</p>
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
                <div className="flex items-center gap-2">
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
                  {doctor.trang_thai_ngay === 'lam_viec' && (
                    <button
                      type="button"
                      onClick={() => setUnavailableDoctor({ id: doctor.doctor_id, name: doctor.ten_bac_si })}
                      className="min-h-9 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                    >
                      Báo nghỉ đột xuất
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ca sáng (08:00–11:30)</p>
                  <KhungGrid
                    rows={doctor.ca_sang}
                    emptyLabel={doctor.trang_thai_ngay === 'khong_co_lich' ? 'Không có lịch' : 'Không có khung ca sáng'}
                    onSelect={(row) => void openKhung(doctor.doctor_id, doctor.ten_bac_si, row)}
                  />
                </div>
                <div className="border-t border-dashed border-slate-200 pt-4 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ca chiều (13:30–17:30)</p>
                  <KhungGrid
                    rows={doctor.ca_chieu}
                    emptyLabel={doctor.trang_thai_ngay === 'khong_co_lich' ? 'Không có lịch' : 'Không có khung ca chiều'}
                    onSelect={(row) => void openKhung(doctor.doctor_id, doctor.ten_bac_si, row)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedKhung && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-800">{selectedKhung.doctorName} · {selectedKhung.row.gio_bat_dau}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {selectedKhung.row.khoa_boi_nghi_phep ? 'Khung này đang bị khoá vì bác sĩ nghỉ phép.' : `${selectedKhung.row.con_trong}/${selectedKhung.row.tong_slot} slot còn trống.`}
            </p>

            <div className="mt-4 space-y-2">
              {khungLoading ? (
                <p className="text-sm text-slate-400">Đang tải...</p>
              ) : khungAppointments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">Chưa có ai đặt khung này.</p>
              ) : (
                khungAppointments.map((appt) => (
                  <div key={appt._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">{appt.ten_khach || appt.user_id?.ho_ten || 'Khách'}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">{APPT_STATUS_LABEL[appt.status] ?? appt.status}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{appt.so_dien_thoai_khach || appt.user_id?.so_dien_thoai || 'Chưa có SĐT'}{appt.ma_lich_hen ? ` · ${appt.ma_lich_hen}` : ''}</p>
                    <button type="button" onClick={() => setTimelineApptId(appt._id)} className="mt-1.5 text-xs font-semibold text-brand-600 hover:underline">Xem lịch sử thao tác</button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setSelectedKhung(null)} className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {unavailableDoctor && (
        <DoctorUnavailableModal
          doctorId={unavailableDoctor.id}
          doctorName={unavailableDoctor.name}
          defaultDate={date}
          onClose={() => setUnavailableDoctor(null)}
          onDone={() => {
            // Cac slot vua bi khoa/doi — bo cache de lan bam khung ke tiep lay du lieu moi.
            setAppointmentsCache({})
            loadOverview()
          }}
        />
      )}

      {timelineApptId && (
        <TimelinePanel
          loai="lich_hen"
          id={timelineApptId}
          title="Lịch sử thao tác lịch hẹn"
          onClose={() => setTimelineApptId(null)}
        />
      )}
    </div>
  )
}
