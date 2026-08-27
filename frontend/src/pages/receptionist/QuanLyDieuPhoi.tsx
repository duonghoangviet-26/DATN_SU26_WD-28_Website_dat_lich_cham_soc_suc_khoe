import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { receptionistRescheduleApprovalsService } from '@/services/receptionist-reschedule-approvals.service'
import type { DoctorFilterOption } from '@/services/receptionist-booking.service'
import { PageShell, ReceptionistHeader, Tabs } from '@/components/receptionist/ReceptionistUI'
import DoctorDayView from './DoctorDayView'
import DanhSachDieuPhoi from './DanhSachDieuPhoi'

const TAB_LICH = 'lich-bac-si'
const TAB_DIEU_PHOI = 'dieu-phoi'

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Trang gộp "Quản lý và điều phối" (2026-08-25) — 2 tab trong 1 trang, thay cho 2 mục menu
// rời rạc trước đây. Xem docs/superpowers/specs/2026-08-25-quan-ly-va-dieu-phoi-design.md.
export default function QuanLyDieuPhoi() {
  const location = useLocation()
  const navigate = useNavigate()
  const [canDieuPhoiCount, setCanDieuPhoiCount] = useState(0)
  // C2 (2026-08-25): bộ lọc ngày/bác sĩ của Tab 1 (spec §3.3 — "cùng hàng với bộ lọc hiện
  // có, giữ nguyên DoctorDayView.tsx:203-219") — nâng lên đây vì DoctorDayView giờ LUÔN chạy
  // embedded (không route nào render nó standalone nữa), nên header + bộ lọc riêng của nó
  // không bao giờ vẽ ra được nếu để nguyên ở đó.
  const [date, setDate] = useState(today())
  const [doctorFilter, setDoctorFilter] = useState('')
  const [doctorOptions, setDoctorOptions] = useState<DoctorFilterOption[]>([])

  const dangOTabDieuPhoi = location.pathname.startsWith('/receptionist/quan-ly-dieu-phoi/dieu-phoi')
  const activeTab = dangOTabDieuPhoi ? TAB_DIEU_PHOI : TAB_LICH

  useEffect(() => {
    let cancelled = false
    receptionistRescheduleApprovalsService.danhSachDonNghi()
      .then((danhSach) => {
        if (!cancelled) setCanDieuPhoiCount(danhSach.reduce((tong, don) => tong + don.so_lich_chua_xu_ly, 0))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const onChangeTab = (key: string) => {
    navigate(key === TAB_DIEU_PHOI ? '/receptionist/quan-ly-dieu-phoi/dieu-phoi' : '/receptionist/quan-ly-dieu-phoi')
  }

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Lễ tân"
        title="Quản lý và điều phối"
        description="Quản lý lịch làm việc bác sĩ và điều phối lịch hẹn khi bác sĩ báo nghỉ đột xuất."
        actions={(
          <div className="flex flex-wrap items-end gap-3">
            <Tabs
              items={[
                { key: TAB_LICH, label: 'Lịch bác sĩ' },
                { key: TAB_DIEU_PHOI, label: 'Điều phối lịch hẹn', badge: canDieuPhoiCount },
              ]}
              active={activeTab}
              onChange={onChangeTab}
            />
            {activeTab === TAB_LICH && (
              <>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Lọc theo bác sĩ
                  <select
                    value={doctorFilter}
                    onChange={(event) => setDoctorFilter(event.target.value)}
                    className="min-h-10 rounded-lg border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Tất cả bác sĩ</option>
                    {doctorOptions.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>{doctor.ho_ten}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Ngày
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="min-h-10 rounded-lg border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              </>
            )}
          </div>
        )}
      />

      {activeTab === TAB_LICH ? (
        <DoctorDayView
          embedded
          date={date}
          onDateChange={setDate}
          doctorFilter={doctorFilter}
          onDoctorFilterChange={setDoctorFilter}
          onDoctorsLoaded={setDoctorOptions}
        />
      ) : (
        <DanhSachDieuPhoi embedded />
      )}
    </PageShell>
  )
}
