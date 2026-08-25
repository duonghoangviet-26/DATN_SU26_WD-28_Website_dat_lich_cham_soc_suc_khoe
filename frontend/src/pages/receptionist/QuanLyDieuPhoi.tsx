import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { receptionistRescheduleApprovalsService } from '@/services/receptionist-reschedule-approvals.service'
import { PageShell, ReceptionistHeader, Tabs } from '@/components/receptionist/ReceptionistUI'
import DoctorDayView from './DoctorDayView'
import DanhSachDieuPhoi from './DanhSachDieuPhoi'

const TAB_LICH = 'lich-bac-si'
const TAB_DIEU_PHOI = 'dieu-phoi'

// Trang gộp "Quản lý và điều phối" (2026-08-25) — 2 tab trong 1 trang, thay cho 2 mục menu
// rời rạc trước đây. Xem docs/superpowers/specs/2026-08-25-quan-ly-va-dieu-phoi-design.md.
export default function QuanLyDieuPhoi() {
  const location = useLocation()
  const navigate = useNavigate()
  const [canDieuPhoiCount, setCanDieuPhoiCount] = useState(0)

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
          <Tabs
            items={[
              { key: TAB_LICH, label: 'Lịch bác sĩ' },
              { key: TAB_DIEU_PHOI, label: 'Điều phối lịch hẹn', badge: canDieuPhoiCount },
            ]}
            active={activeTab}
            onChange={onChangeTab}
          />
        )}
      />

      {activeTab === TAB_LICH ? <DoctorDayView embedded /> : <DanhSachDieuPhoi embedded />}
    </PageShell>
  )
}
