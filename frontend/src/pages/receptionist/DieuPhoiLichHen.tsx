import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  receptionistRescheduleApprovalsService,
  type KhachTaiQuay,
  type RescheduleApprovalItem,
  type TongQuanDieuPhoi,
} from '@/services/receptionist-reschedule-approvals.service'
import { receptionistBookingService, type DoctorOperationalStatus } from '@/services/receptionist-booking.service'
import DieuPhoiRow from '@/components/receptionist/DieuPhoiRow'
import ChonKhacPanel from '@/components/receptionist/ChonKhacPanel'
import BulkApproveConfirm from '@/components/receptionist/BulkApproveConfirm'
import QueueTransferModal, { type QueueTransferCandidate } from '@/components/receptionist/QueueTransferModal'
import { EmptyBlock, LoadingBlock, MetricCard, PageShell, Panel, ReceptionistHeader } from '@/components/receptionist/ReceptionistUI'

function ngayVN(value: string) {
  return new Date(value).toLocaleDateString('vi-VN')
}

// Cùng định nghĩa với DoctorUnavailableModal (E-4) — bác sĩ ở các trạng thái này không nhận
// thêm lượt chuyển được, không hiện trong danh sách ứng viên.
const KHONG_THE_NHAN_CHUYEN = ['khong_co_lich', 'tam_nghi', 'nghi_phep', 'nghi_viec']

function candidatesFor(
  doctorStatuses: DoctorOperationalStatus[],
  specialtyId: string | null,
  currentDoctorId: string | null,
): QueueTransferCandidate[] {
  return doctorStatuses
    .filter((doctor) => doctor.doctor_id !== currentDoctorId)
    .filter((doctor) => !KHONG_THE_NHAN_CHUYEN.includes(doctor.trang_thai_van_hanh))
    .filter((doctor) => !specialtyId || (doctor.specialties ?? []).some((specialty) => specialty.id === specialtyId))
    .map((doctor) => ({
      doctor_id: doctor.doctor_id,
      ten_bac_si: doctor.ten_bac_si,
      so_dang_cho: doctor.so_dang_cho,
      phong_kham: doctor.phong_kham,
    }))
}

// Bảng điều phối MỘT đơn nghỉ — nhìn được toàn cục ai đã xử lý, ai chưa, ai không có chỗ.
// Duyệt hàng loạt cho luồng TỰ ĐỘNG; "Chọn khác…" cho luồng TAY khi khách gọi điện yêu cầu.
export default function DieuPhoiLichHen() {
  const { leaveId = '' } = useParams()
  const [tongQuan, setTongQuan] = useState<TongQuanDieuPhoi | null>(null)
  const [items, setItems] = useState<RescheduleApprovalItem[]>([])
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [dangXuLy, setDangXuLy] = useState(false)
  const [error, setError] = useState('')
  const [chonKhacTarget, setChonKhacTarget] = useState<RescheduleApprovalItem | null>(null)
  const [taiQuayTarget, setTaiQuayTarget] = useState<KhachTaiQuay | null>(null)
  const [doctorStatuses, setDoctorStatuses] = useState<DoctorOperationalStatus[]>([])
  const [xacNhanHangLoat, setXacNhanHangLoat] = useState(false)

  useEffect(() => {
    receptionistBookingService.getDoctorOperationalStatuses().then(setDoctorStatuses).catch(() => {})
  }, [])

  const load = useCallback(() => {
    if (!leaveId) return
    setLoading(true)
    setError('')
    Promise.all([
      receptionistRescheduleApprovalsService.tongQuan(leaveId),
      receptionistRescheduleApprovalsService.list({ leave_id: leaveId, trang_thai: 'cho_admin_duyet,cho_khach_chon,da_ap_dung' }),
    ])
      .then(([tq, ds]) => { setTongQuan(tq); setItems(ds); setChon(new Set()) })
      .catch((requestError: any) => setError(requestError?.response?.data?.message || 'Không thể tải dữ liệu điều phối.'))
      .finally(() => setLoading(false))
  }, [leaveId])

  useEffect(() => { load() }, [load])

  const chonDuoc = useMemo(
    () => items.filter((item) => item.de_xuat.trang_thai === 'cho_admin_duyet' && item.de_xuat.phuong_an.length > 0),
    [items],
  )
  const daChonItems = useMemo(() => items.filter((item) => chon.has(item.id)), [items, chon])

  const toggle = (id: string, next: boolean) => {
    setChon((truoc) => {
      const sau = new Set(truoc)
      if (next) sau.add(id)
      else sau.delete(id)
      return sau
    })
  }

  const chonTatCa = (next: boolean) => {
    setChon(next ? new Set(chonDuoc.map((item) => item.id)) : new Set())
  }

  // Duyệt MỘT dòng.
  // - Phương án 1 đã được `giuChoPhuongAn()` giữ chỗ sẵn → chỉ cần `approve()`, khách vẫn giữ
  //   quyền chọn lại trong hạn phản hồi (D3).
  // - Phương án 2–4 CHƯA giữ chỗ → phải đi `chon-tay` để chiếm slot ngay, nếu không slot có
  //   thể bị bán mất trong lúc chờ khách trả lời. `chonPhuongAnTuDo()` áp cùng ràng buộc
  //   (còn trống, cùng chuyên khoa, không quá khứ, không quá sát giờ).
  const duyetMot = async (item: RescheduleApprovalItem, phuongAnIndex: number) => {
    setDangXuLy(true)
    setError('')
    try {
      if (phuongAnIndex === 0) {
        await receptionistRescheduleApprovalsService.approve(item.id)
      } else {
        const pa = item.de_xuat.phuong_an[phuongAnIndex]
        if (!pa?.doctor_id || !pa.schedule_id || !pa.slot_id) {
          setError('Phương án này thiếu thông tin slot — dùng "Chọn khác…" để chọn tay.')
          return
        }
        await receptionistRescheduleApprovalsService.chonTay(item.id, {
          doctor_id: pa.doctor_id,
          schedule_id: pa.schedule_id,
          slot_id: pa.slot_id,
        })
      }
      load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không duyệt được.')
    } finally {
      setDangXuLy(false)
    }
  }

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Điều phối · Lịch hẹn"
        title={tongQuan ? `${tongQuan.bac_si} — nghỉ ${ngayVN(tongQuan.khoang_nghi.tu_ngay)}` : 'Bảng điều phối'}
        description={tongQuan?.ly_do ? `Lý do: ${tongQuan.ly_do}` : 'Duyệt phương án dời cho khách bị ảnh hưởng.'}
        actions={<Link to="/receptionist/dieu-phoi" className="inline-flex min-h-10 items-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">← Danh sách</Link>}
      />

      {tongQuan && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Lịch ảnh hưởng" value={tongQuan.so_lich_anh_huong} />
          <MetricCard label="Chờ duyệt" value={tongQuan.so_cho_duyet} tone={tongQuan.so_cho_duyet ? 'warning' : 'default'} />
          <MetricCard label="Chờ khách chọn" value={tongQuan.so_cho_khach_chon} tone="info" />
          <MetricCard label="Đã dời xong" value={tongQuan.so_da_doi} tone="success" />
          <MetricCard label="Không có chỗ" value={tongQuan.so_khong_co_cho} tone={tongQuan.so_khong_co_cho ? 'warning' : 'default'} />
        </div>
      )}

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <Panel bodyClassName="p-0">
        {loading ? (
          <LoadingBlock>Đang tải bảng điều phối...</LoadingBlock>
        ) : items.length === 0 && (tongQuan?.tai_quay.length ?? 0) === 0 ? (
          <EmptyBlock>Không có lịch hẹn nào thuộc đơn nghỉ này.</EmptyBlock>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={chonDuoc.length > 0 && chon.size === chonDuoc.length}
                      disabled={chonDuoc.length === 0 || dangXuLy}
                      onChange={(event) => chonTatCa(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                      aria-label="Chọn toàn bộ lịch có thể duyệt"
                    />
                  </th>
                  <th className="px-3 py-2.5">Giờ</th>
                  <th className="px-3 py-2.5">Khách</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                  <th className="px-3 py-2.5">Phương án đề xuất</th>
                  <th className="px-3 py-2.5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <DieuPhoiRow
                    key={item.id}
                    item={item}
                    checked={chon.has(item.id)}
                    onToggle={toggle}
                    onChonKhac={setChonKhacTarget}
                    onDuyetMot={(target, index) => void duyetMot(target, index)}
                    dangXuLy={dangXuLy}
                  />
                ))}

                {/* C3 — khách ĐÃ CHECK-IN nằm CHUNG bảng để lễ tân thấy toàn cục, nhưng là
                    hàng riêng: không tick checkbox (không thuộc luồng duyệt hàng loạt), hành
                    động duy nhất là chuyển bác sĩ ngay tại quầy. */}
                {(tongQuan?.tai_quay ?? []).map((khach) => (
                  <tr key={khach.hang_doi_id} className="border-t border-slate-100 bg-sky-50/60">
                    <td className="px-3 py-2.5 text-center text-slate-300" aria-hidden="true">—</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-800">{khach.gio_kham ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-slate-800">{khach.ten_khach || 'Khách'}</p>
                      <p className="text-xs text-slate-500">{khach.so_dien_thoai_khach || 'Chưa có SĐT'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900">
                        🔵 Đang tại quầy{khach.ma_so_thu_tu ? ` · STT ${khach.ma_so_thu_tu}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">
                      Khách đã có mặt — không dời lịch, phải chuyển sang bác sĩ khác cùng chuyên khoa.
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setTaiQuayTarget(khach)}
                        className="min-h-9 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
                      >
                        Chuyển bác sĩ ngay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {chon.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-slate-700">Đã chọn {chon.size} lịch</p>
          {chon.size > 20 && (
            <p className="text-xs font-semibold text-amber-700">
              ⚠ Đang duyệt hơn 20 lịch cùng lúc — kiểm lại danh sách trước khi xác nhận.
            </p>
          )}
          <button
            type="button"
            onClick={() => setXacNhanHangLoat(true)}
            disabled={dangXuLy}
            className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Duyệt phương án đề xuất
          </button>
        </div>
      )}

      {chonKhacTarget && (
        <ChonKhacPanel
          appointmentId={chonKhacTarget.id}
          defaultDate={String(chonKhacTarget.ngay_kham).slice(0, 10)}
          onClose={() => setChonKhacTarget(null)}
          onDone={load}
        />
      )}

      {taiQuayTarget && (
        <QueueTransferModal
          hangDoiId={taiQuayTarget.hang_doi_id}
          tenBenhNhan={taiQuayTarget.ten_khach || 'Khách'}
          maSoThuTu={taiQuayTarget.ma_so_thu_tu}
          candidates={candidatesFor(doctorStatuses, taiQuayTarget.specialty_id, taiQuayTarget.doctor_id)}
          onClose={() => setTaiQuayTarget(null)}
          onTransferred={() => { setTaiQuayTarget(null); load() }}
        />
      )}

      {xacNhanHangLoat && (
        <BulkApproveConfirm
          items={daChonItems}
          onClose={() => setXacNhanHangLoat(false)}
          onDone={load}
        />
      )}
    </PageShell>
  )
}
