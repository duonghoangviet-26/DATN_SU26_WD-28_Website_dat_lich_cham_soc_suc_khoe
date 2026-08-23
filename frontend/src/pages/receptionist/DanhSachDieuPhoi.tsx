import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  receptionistRescheduleApprovalsService,
  type DonNghiConViec,
} from '@/services/receptionist-reschedule-approvals.service'
import { EmptyBlock, LoadingBlock, PageShell, Panel, ReceptionistHeader } from '@/components/receptionist/ReceptionistUI'

function ngayVN(value: string) {
  return new Date(value).toLocaleDateString('vi-VN')
}

function moTaKhoangNghi(don: DonNghiConViec) {
  const ngay = don.tu_ngay === don.den_ngay ? ngayVN(don.tu_ngay) : `${ngayVN(don.tu_ngay)} – ${ngayVN(don.den_ngay)}`
  const gio = don.gio_bat_dau && don.gio_ket_thuc ? ` · ${don.gio_bat_dau}–${don.gio_ket_thuc}` : ' · cả ngày'
  return `${ngay}${gio}`
}

// Trang đầu của mục "Điều phối lịch hẹn": mỗi dòng là MỘT đơn nghỉ còn lịch chưa xử lý.
// Bấm vào để mở bảng điều phối của đơn đó.
export default function DanhSachDieuPhoi() {
  const [donNghi, setDonNghi] = useState<DonNghiConViec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    receptionistRescheduleApprovalsService.danhSachDonNghi()
      .then((res) => { if (!cancelled) setDonNghi(res) })
      .catch((requestError: any) => {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể tải danh sách điều phối.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Điều phối · Lịch hẹn"
        title="Điều phối lịch hẹn"
        description="Mỗi dòng là một lần bác sĩ báo nghỉ còn lịch chưa xử lý xong. Mở ra để duyệt phương án dời cho từng khách hoặc duyệt hàng loạt."
      />

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {loading ? (
        <LoadingBlock>Đang tải danh sách...</LoadingBlock>
      ) : donNghi.length === 0 ? (
        <EmptyBlock>Không còn lịch nào cần điều phối. </EmptyBlock>
      ) : (
        <div className="grid gap-3">
          {donNghi.map((don) => (
            <Panel key={don.leave_id} bodyClassName="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">{don.bac_si}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{moTaKhoangNghi(don)}</p>
                  {don.ly_do && <p className="mt-0.5 text-xs italic text-slate-400">&ldquo;{don.ly_do}&rdquo;</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-amber-100 px-2 text-sm font-bold text-amber-900">
                    {don.so_lich_chua_xu_ly}
                  </span>
                  <Link
                    to={`/receptionist/dieu-phoi/${don.leave_id}`}
                    className="inline-flex min-h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Mở bảng điều phối →
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </PageShell>
  )
}
