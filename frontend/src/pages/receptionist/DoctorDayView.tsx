import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DayOverview, DayOverviewKhungRow, DoctorDayAppointment, receptionistBookingService } from '@/services/receptionist-booking.service'
import { receptionistDoctorLeavesService, type PendingDoctorLeave } from '@/services/receptionist-doctor-leaves.service'
import DoctorUnavailableModal from '@/components/receptionist/DoctorUnavailableModal'
import DoctorLeaveApprovalModal from '@/components/receptionist/DoctorLeaveApprovalModal'
import ConfirmRestoreModal from '@/components/receptionist/ConfirmRestoreModal'
import TimelinePanel from '@/components/receptionist/TimelinePanel'
import { EmptyBlock, LoadingBlock, PageShell, Panel, ReceptionistHeader, StatusBadge } from '@/components/receptionist/ReceptionistUI'
import { xepTrangThaiTheBacSi } from '@/utils/dieuPhoiHelpers'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function moTaKhoangNghiChoDuyet(leave: PendingDoctorLeave) {
  const gio = leave.gio_bat_dau && leave.gio_ket_thuc ? `${leave.gio_bat_dau}–${leave.gio_ket_thuc}` : 'cả ngày'
  return `${new Date(leave.tu_ngay).toLocaleDateString('vi-VN')} · ${gio}`
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
          className={`flex w-16 h-12 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition hover:ring-2 hover:ring-brand-300 ${cellTone(row)}`}
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

export default function DoctorDayView({ embedded = false }: { embedded?: boolean } = {}) {
  const [date, setDate] = useState(today())
  const [doctorFilter, setDoctorFilter] = useState('')
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
  const [pendingLeaves, setPendingLeaves] = useState<PendingDoctorLeave[]>([])
  const [approvingLeave, setApprovingLeave] = useState<PendingDoctorLeave | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ leaveId: string; name: string } | null>(null)

  const loadPendingLeaves = useCallback(() => {
    receptionistDoctorLeavesService.listPending().then(setPendingLeaves).catch(() => {})
  }, [])

  useEffect(() => {
    loadPendingLeaves()
  }, [loadPendingLeaves])

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

  const visibleDoctors = useMemo(() => {
    const doctors = overview?.doctors ?? []
    return doctorFilter ? doctors.filter((doctor) => doctor.doctor_id === doctorFilter) : doctors
  }, [overview, doctorFilter])

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
    <PageShell>
      {!embedded && (
        <ReceptionistHeader
          eyebrow="Điều phối · Lịch bác sĩ"
          title="Lịch bác sĩ trong ngày"
          description="Mỗi ô là 1 khung giờ 30 phút, số hiển thị là số slot còn trống / tổng slot của khung đó. Bấm vào ô để xem ai đã đặt."
          actions={
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Lọc theo bác sĩ
                <select
                  value={doctorFilter}
                  onChange={(event) => setDoctorFilter(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Tất cả bác sĩ</option>
                  {(overview?.doctors ?? []).map((doctor) => (
                    <option key={doctor.doctor_id} value={doctor.doctor_id}>{doctor.ten_bac_si}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Ngày
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              </label>
            </div>
          }
        />
      )}

      {pendingLeaves.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span aria-hidden="true">⚠</span>
          <span>
            <strong>{pendingLeaves.length}</strong> bác sĩ đang xin nghỉ — chờ bạn duyệt. Xem thẻ bác sĩ có huy hiệu &ldquo;Chờ duyệt&rdquo; bên dưới để xử lý.
          </span>
        </div>
      )}

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {loading ? (
        <LoadingBlock>Đang tải lịch bác sĩ...</LoadingBlock>
      ) : !overview || overview.doctors.length === 0 ? (
        <EmptyBlock>Không có bác sĩ nào đang hoạt động.</EmptyBlock>
      ) : visibleDoctors.length === 0 ? (
        <EmptyBlock>Bác sĩ đã chọn không có lịch trong ngày này.</EmptyBlock>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 xl:auto-rows-fr">
          {visibleDoctors.map((doctor) => {
            const leaveCuaBacSi = pendingLeaves.find((leave) => leave.bac_si_id === doctor.doctor_id)
            const trangThaiThe = xepTrangThaiTheBacSi(doctor, leaveCuaBacSi ?? null)
            return (
            <Panel key={doctor.doctor_id} bodyClassName="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">{doctor.ten_bac_si}</p>
                </div>
                <StatusBadge
                  tone={
                    trangThaiThe === 'lam_viec' ? 'success'
                    : trangThaiThe === 'cho_duyet' ? 'warning'
                    : trangThaiThe === 'con_viec' ? 'warning'
                    : 'success'
                  }
                >
                  {trangThaiThe === 'lam_viec' ? 'Làm việc'
                    : trangThaiThe === 'cho_duyet' ? 'Chờ duyệt'
                    : trangThaiThe === 'con_viec' ? 'Đang nghỉ'
                    : 'Đã điều phối xong'}
                </StatusBadge>
              </div>

              {trangThaiThe === 'lam_viec' && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setUnavailableDoctor({ id: doctor.doctor_id, name: doctor.ten_bac_si })}
                    className="min-h-9 rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Báo nghỉ đột xuất
                  </button>
                </div>
              )}

              {trangThaiThe === 'cho_duyet' && leaveCuaBacSi && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-sm font-semibold text-amber-900">
                    Xin nghỉ {moTaKhoangNghiChoDuyet(leaveCuaBacSi)} · {leaveCuaBacSi.so_lich_se_anh_huong} lịch sẽ bị ảnh hưởng
                  </p>
                  {leaveCuaBacSi.ly_do && <p className="mt-0.5 text-xs italic text-amber-700">&ldquo;{leaveCuaBacSi.ly_do}&rdquo;</p>}
                  <button
                    type="button"
                    onClick={() => setApprovingLeave(leaveCuaBacSi)}
                    className="mt-2 min-h-9 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Duyệt đơn nghỉ
                  </button>
                </div>
              )}

              {(trangThaiThe === 'con_viec' || trangThaiThe === 'da_xong') && doctor.leave_id && (
                <div className={`mt-3 rounded-xl border px-3 py-2.5 ${trangThaiThe === 'con_viec' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <p className={`text-sm font-semibold ${trangThaiThe === 'con_viec' ? 'text-amber-900' : 'text-emerald-900'}`}>
                    {trangThaiThe === 'con_viec'
                      ? `Còn ${doctor.so_lich_chua_xu_ly}/${doctor.so_lich_anh_huong} lịch chưa điều phối`
                      : `Đã điều phối xong ${doctor.so_lich_anh_huong} lịch`}
                  </p>
                  {doctor.ly_do_nghi && <p className="mt-0.5 text-xs text-slate-600">Lý do: {doctor.ly_do_nghi}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      to={`/receptionist/quan-ly-dieu-phoi/dieu-phoi/${doctor.leave_id}`}
                      className="inline-flex min-h-9 items-center rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      {trangThaiThe === 'con_viec' ? 'Tiếp tục điều phối →' : 'Xem lại bảng →'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setRestoreTarget({ leaveId: doctor.leave_id!, name: doctor.ten_bac_si })}
                      className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Huỷ báo nghỉ
                    </button>
                  </div>
                </div>
              )}

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
            </Panel>
            )
          })}
        </div>
      )}

      {selectedKhung && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-lg">
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

      {approvingLeave && (
        <DoctorLeaveApprovalModal
          leave={approvingLeave}
          onClose={() => setApprovingLeave(null)}
          onDone={() => {
            setAppointmentsCache({})
            loadPendingLeaves()
            loadOverview()
          }}
        />
      )}

      {restoreTarget && (
        <ConfirmRestoreModal
          leaveId={restoreTarget.leaveId}
          doctorName={restoreTarget.name}
          onClose={() => setRestoreTarget(null)}
          onDone={() => {
            setAppointmentsCache({})
            loadPendingLeaves()
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
    </PageShell>
  )
}
