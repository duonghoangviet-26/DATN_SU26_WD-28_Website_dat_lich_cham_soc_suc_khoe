import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  receptionistRescheduleApprovalsService,
  type DonNghiConViec,
} from '@/services/receptionist-reschedule-approvals.service'
import { EmptyBlock, LoadingBlock, Panel } from '@/components/receptionist/ReceptionistUI'
import { dinhDangDemNguoc } from '@/utils/dieuPhoiHelpers'

function ngayVN(value: string) {
  return new Date(value).toLocaleDateString('vi-VN')
}

function moTaKhoangNghi(don: DonNghiConViec) {
  const ngay = don.tu_ngay === don.den_ngay ? ngayVN(don.tu_ngay) : `${ngayVN(don.tu_ngay)} – ${ngayVN(don.den_ngay)}`
  const gio = don.gio_bat_dau && don.gio_ket_thuc ? ` · ${don.gio_bat_dau}–${don.gio_ket_thuc}` : ' · cả ngày'
  return `${ngay}${gio}`
}

type BoLoc = 'con_viec' | 'da_xong'

interface Props {
  embedded?: boolean
}

// Trang đầu của mục "Điều phối lịch hẹn": mỗi dòng là MỘT đơn nghỉ. Bấm vào để mở bảng
// điều phối của đơn đó. embedded=true khi nhúng dưới dạng tab trong QuanLyDieuPhoi.
export default function DanhSachDieuPhoi({ embedded = false }: Props = {}) {
  const [boLoc, setBoLoc] = useState<BoLoc>('con_viec')
  const [donNghi, setDonNghi] = useState<DonNghiConViec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    receptionistRescheduleApprovalsService.danhSachDonNghi(boLoc)
      .then((res) => { if (!cancelled) setDonNghi(res) })
      .catch((requestError: any) => {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể tải danh sách điều phối.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [boLoc])

  const noiDung = (
    <>
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        {(['con_viec', 'da_xong'] as BoLoc[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setBoLoc(key)}
            className={`min-h-9 rounded-md px-3 text-sm font-semibold transition ${boLoc === key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {key === 'con_viec' ? 'Còn việc' : 'Đã xong'}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {loading ? (
        <LoadingBlock>Đang tải danh sách...</LoadingBlock>
      ) : donNghi.length === 0 ? (
        <EmptyBlock>{boLoc === 'con_viec' ? 'Không còn lịch nào cần điều phối.' : 'Chưa có đơn nào đã xử lý xong.'}</EmptyBlock>
      ) : (
        <div className="grid gap-3">
          {donNghi.map((don) => {
            const demNguoc = boLoc === 'con_viec' ? dinhDangDemNguoc(don.han_phan_hoi_som_nhat) : null
            return (
              <Panel key={don.leave_id} bodyClassName="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-900">{don.bac_si}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{moTaKhoangNghi(don)}</p>
                    {don.ly_do && <p className="mt-0.5 text-xs italic text-slate-400">&ldquo;{don.ly_do}&rdquo;</p>}
                    {demNguoc && (
                      <p className={`mt-1 text-xs font-bold ${demNguoc.quaHan ? 'text-rose-700' : 'text-amber-700'}`}>
                        ⏱ {demNguoc.text}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {boLoc === 'con_viec' && (
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-amber-100 px-2 text-sm font-bold text-amber-900">
                        {don.so_lich_chua_xu_ly}
                      </span>
                    )}
                    <Link
                      to={`/receptionist/quan-ly-dieu-phoi/dieu-phoi/${don.leave_id}`}
                      className="inline-flex min-h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      {boLoc === 'con_viec' ? (demNguoc?.quaHan ? 'Xử lý ngay →' : 'Mở bảng điều phối →') : 'Xem lại →'}
                    </Link>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>
      )}
    </>
  )

  if (embedded) return noiDung

  return (
    <div className="min-h-full bg-slate-50 px-4 py-5 text-slate-900 sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">{noiDung}</div>
    </div>
  )
}
