import Icon from '@/components/admin/icons'
/* eslint-disable react-refresh/only-export-components -- Shift helpers are part of this component module's public API. */
import type { DoctorSlot, DoctorLeaveRequest } from '@/types'
import { findCoveringLeave } from '@/utils/scheduleWeek'

// ============================================================
// BANG CA KHAM TRONG NGAY — hien INLINE ngay duoi lich tuan (khong dung drawer).
//
// Bo cuc: mot THANH GIO lien tuc (ca sang | ca chieu), moi dong = 1 khung 30'.
// Khong dung the long the: 15 khung x 1 the = roi, do la van de cua ban cu.
//
// Ky hieu chiem cho: day o vuong, 1 o = 1 slot (dac = da dat, vien = con trong)
// -> doc duoc 0/2, 1/2, 2/2 bang mat, khong can doc so.
//
// Mau: nen trung tinh, MOT mau nhan (brand) cho "da dat" vi day la bang lich ONLINE.
// Ho phach = dang giu cho (tam thoi), hong = ca nghi. Khong to nen ca dong.
// ============================================================

// CHI 2 trang thai nay hien duoc: findCoveringLeave() da loc san `cho_duyet|da_duyet`.
// Don bi tu choi / da rut KHONG chan khung, nen khong bao gio render den day.
const LEAVE_STATUS_LABEL: Record<string, string> = {
  cho_duyet: 'Chờ duyệt nghỉ',
  da_duyet: 'Đã duyệt nghỉ',
}

export interface KhungGio {
  gio_bat_dau: string
  gio_ket_thuc: string
  slots: DoctorSlot[]
}

export function groupSlotsByKhung(slots: DoctorSlot[]): KhungGio[] {
  const groups: KhungGio[] = []
  const indexByTime = new Map<string, number>()
  slots.forEach((slot) => {
    const key = `${slot.gio_bat_dau}-${slot.gio_ket_thuc}`
    const existing = indexByTime.get(key)
    if (existing === undefined) {
      indexByTime.set(key, groups.length)
      groups.push({ gio_bat_dau: slot.gio_bat_dau, gio_ket_thuc: slot.gio_ket_thuc, slots: [slot] })
    } else {
      groups[existing].slots.push(slot)
    }
  })
  return groups.sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau))
}

// ─── O vuong chiem cho ────────────────────────────────────────────────────────

function Pip({ status, walkIn = false }: { status: DoctorSlot['status']; walkIn?: boolean }) {
  const style =
    status === 'booked' ? 'bg-brand-600 border-brand-600'
      : status === 'pending_payment' ? 'border-amber-500 bg-amber-100'
        : status === 'locked' ? 'border-rose-300 bg-rose-100'
          : status === 'cancelled' || status === 'expired' ? 'border-slate-200 bg-slate-100'
            // Slot walk-in con trong: vien net dut — de phan biet voi cho online, vi day la
            // HAI quota rieng (rule §4), khong duoc cong gop thanh mot con so.
            : walkIn ? 'border-dashed border-slate-400 bg-slate-50'
              : 'border-slate-300 bg-white'
  return <span className={`h-3 w-3 shrink-0 rounded-[3px] border ${style}`} aria-hidden="true" />
}

// ─── Mot dong khung gio ───────────────────────────────────────────────────────

interface KhungRowProps {
  khung: KhungGio
  leaves: DoctorLeaveRequest[]
  daQua: boolean
  chiXem: boolean
  onXinNghi: (slot: DoctorSlot) => void
  onYeuCauHuy: (slot: DoctorSlot) => void
}

function KhungRow({ khung, leaves, daQua, chiXem, onXinNghi, onYeuCauHuy }: KhungRowProps) {
  // TACH quota online / walk-in (rule §4: hai quota rieng, khong cong gop). Bang nay la goc
  // nhin ONLINE nen ty le x/y dem cho online; cho walk-in ghi rieng ben canh.
  const laWalkIn = (s: DoctorSlot) => s.loai_slot === 'walk_in'
  const slotOnline = khung.slots.filter((s) => !laWalkIn(s))
  const slotWalkIn = khung.slots.filter(laWalkIn)

  const daDat = khung.slots.filter((s) => s.status === 'booked')
  const giuCho = khung.slots.filter((s) => s.status === 'pending_payment')
  const daKhoa = khung.slots.filter((s) => s.status === 'locked')
  const conTrong = khung.slots.filter((s) => s.status === 'active')
  const walkInTrong = slotWalkIn.filter((s) => s.status === 'active').length

  const tongOnline = slotOnline.length
  const chiemOnline = slotOnline.filter((s) => s.status === 'booked' || s.status === 'pending_payment').length

  // Yeu cau nghi la cap KHUNG (API nhan gio_bat_dau/gio_ket_thuc), khong phai cap slot.
  const nghiPhep = findCoveringLeave(khung.slots[0], leaves)
  const choPhepXinNghi = !daQua && !chiXem && !nghiPhep && conTrong.length > 0

  const dayVien = daKhoa.length > 0 ? 'border-l-rose-400'
    : tongOnline > 0 && chiemOnline === tongOnline ? 'border-l-brand-500'
      : giuCho.length > 0 ? 'border-l-amber-400'
        : 'border-l-transparent'

  return (
    <div className={`group flex items-start gap-3 border-l-2 py-2.5 pl-3 pr-2 ${dayVien} ${daQua ? 'opacity-55' : ''}`}>
      {/* Gio — chu so deu cot */}
      <div className="w-[74px] shrink-0 pt-px">
        <div className="font-semibold tabular-nums tracking-tight text-slate-900">{khung.gio_bat_dau}</div>
        <div className="text-[11px] tabular-nums text-slate-400">đến {khung.gio_ket_thuc}</div>
      </div>

      {/* O vuong + ty le */}
      <div className="w-[86px] shrink-0 pt-1">
        <div className="flex flex-wrap items-center gap-1">
          {khung.slots.map((s) => <Pip key={s.id} status={s.status} walkIn={laWalkIn(s)} />)}
        </div>
        {/* Khung khong co slot online nao -> KHONG in "0/0 cho" (vo nghia), noi thang la khung
            nay chi danh cho khach tai cho. */}
        {tongOnline > 0 ? (
          <>
            <div className="text-[11px] font-medium tabular-nums text-slate-500">
              {chiemOnline}/{tongOnline} chỗ
            </div>
            {walkInTrong > 0 && (
              <div className="text-[11px] tabular-nums text-slate-400">+{walkInTrong} tại chỗ</div>
            )}
          </>
        ) : (
          <div className="text-[11px] text-slate-400">chỉ khách tại chỗ</div>
        )}
      </div>

      {/* Nguoi dat / trang thai — khung trong de TRONG han. O vuong rong + "0/2 cho" da noi
          du; lap lai "Chua co ai dat" tren 13/15 dong chinh la thu gay roi can bo. */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {daDat.map((s) => (
            <span
              key={s.id}
              // max-w + min-w-0 o con: thieu cai nay thi ten dai (DB that co ten 36 ky tu)
              // lam chip gian ra, day nut hanh dong tran khoi dong.
              className="inline-flex min-w-0 max-w-[15rem] items-center gap-1.5 rounded-md bg-brand-50 py-1 pl-2 pr-1 text-sm text-brand-900"
              title={s.benh_nhan ?? undefined}
            >
              <Icon name="user" className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              {s.benh_nhan ? (
                <>
                  <span className="min-w-0 truncate">{s.benh_nhan}</span>
                  {s.nguon_chiem_cho === 'tai_quay' && <span className="shrink-0 text-[11px] text-brand-600">tại quầy</span>}
                </>
              ) : (
                // Slot 'booked' KHONG tra ve ten = khong join duoc LichHen (DB that co 86 ca
                // nhu vay). Noi that la du lieu loi, KHONG bia placeholder "Benh nhan".
                <span className="min-w-0 truncate text-rose-600">Thiếu dữ liệu lịch hẹn</span>
              )}
              {!daQua && !chiXem && (
                s.cancel_requested ? (
                  <span className="shrink-0 px-1 text-[11px] font-medium text-amber-600">chờ duyệt hủy</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onYeuCauHuy(s)}
                    title={`Yêu cầu hủy ca của ${s.benh_nhan ?? 'bệnh nhân'}`}
                    className="shrink-0 rounded p-1 text-brand-400 opacity-0 transition-opacity hover:bg-white hover:text-rose-600 focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500 group-hover:opacity-100"
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                    <span className="sr-only">Yêu cầu hủy</span>
                  </button>
                )
              )}
            </span>
          ))}

          {giuCho.map((s) => (
            <span
              key={s.id}
              className="inline-flex min-w-0 max-w-[15rem] items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900"
              title={`${s.benh_nhan ?? 'Bệnh nhân'} — đang giữ chỗ chờ thanh toán`}
            >
              <Icon name="clock" className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="min-w-0 truncate">{s.benh_nhan ?? 'Chưa rõ'}</span>
              <span className="shrink-0 text-[11px]">giữ chỗ</span>
            </span>
          ))}

          {daKhoa.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-sm text-rose-700">
              <Icon name="alert-circle" className="h-3.5 w-3.5 shrink-0" />
              {daKhoa.length} chỗ tạm nghỉ
            </span>
          )}
        </div>
      </div>

      {/* Hanh dong cap khung — co dinh ben phai, khong bi ten benh nhan day di */}
      <div className="w-[104px] shrink-0 pt-0.5 text-right">
        {nghiPhep ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-600">
            <Icon name="clock" className="h-3 w-3 shrink-0" />
            {LEAVE_STATUS_LABEL[nghiPhep.trang_thai]}
          </span>
        ) : choPhepXinNghi ? (
          <button
            type="button"
            onClick={() => onXinNghi(conTrong[0])}
            title={`Xin nghỉ khung ${khung.gio_bat_dau}–${khung.gio_ket_thuc}`}
            className="rounded-md border border-transparent px-2 py-1 text-[11px] font-medium text-slate-400 opacity-0 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 group-hover:opacity-100"
          >
            Xin nghỉ
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ─── Cot mot ca ───────────────────────────────────────────────────────────────

function CaColumn({
  nhan, khungs, leaves, gioHienTai, chiXem, onXinNghi, onYeuCauHuy,
}: {
  nhan: string
  khungs: KhungGio[]
  leaves: DoctorLeaveRequest[]
  gioHienTai: string | null
  chiXem: boolean
  onXinNghi: (slot: DoctorSlot) => void
  onYeuCauHuy: (slot: DoctorSlot) => void
}) {
  if (khungs.length === 0) return null
  // Dem CUNG MOT MAU SO voi tung dong ben duoi (chi slot online) — truoc day dau cot dem ca
  // slot walk-in nen ra "4/11" trong khi cong cac dong chi ra "4/9".
  const slotOnline = khungs.flatMap((k) => k.slots.filter((s) => s.loai_slot !== 'walk_in'))
  const tongCho = slotOnline.length
  const daChiem = slotOnline.filter((s) => s.status === 'booked' || s.status === 'pending_payment').length

  return (
    <section className="min-w-0">
      <header className="flex items-baseline justify-between border-b border-slate-200 pb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{nhan}</h3>
        {/* Ghi ro "cho online" — o lich tuan ben tren dem TAT CA slot (ke ca tai cho) nen mau so
            khac; khong ghi ro thi hai con so trong nhu mau thuan. */}
        <span className="text-[11px] tabular-nums text-slate-400">{daChiem}/{tongCho} chỗ online</span>
      </header>
      <div className="divide-y divide-slate-100">
        {khungs.map((k) => (
          <KhungRow
            key={k.gio_bat_dau}
            khung={k}
            leaves={leaves}
            daQua={gioHienTai !== null && k.gio_ket_thuc <= gioHienTai}
            chiXem={chiXem}
            onXinNghi={onXinNghi}
            onYeuCauHuy={onYeuCauHuy}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Bang chinh ───────────────────────────────────────────────────────────────

export interface DayShiftBoardProps {
  tieuDe: string
  slots: DoctorSlot[]
  leaves: DoctorLeaveRequest[]
  phongKham: string | null
  /** 'HH:MM' neu la hom nay (de mo khung da troi qua), null neu ngay khac. */
  gioHienTai: string | null
  /** Ngay qua khu / ngay nghi — chi xem, an moi hanh dong. */
  chiXem: boolean
  ghiChu?: string | null
  onXinNghi: (slot: DoctorSlot) => void
  onYeuCauHuy: (slot: DoctorSlot) => void
  onXemChiTiet?: () => void
}

export default function DayShiftBoard({
  tieuDe, slots, leaves, phongKham, gioHienTai, chiXem, ghiChu,
  onXinNghi, onYeuCauHuy, onXemChiTiet,
}: DayShiftBoardProps) {
  const khungs = groupSlotsByKhung(slots)
  const caSang = khungs.filter((k) => k.gio_bat_dau < '12:00')
  const caChieu = khungs.filter((k) => k.gio_bat_dau >= '12:00' && k.gio_bat_dau < '18:00')
  const caToi = khungs.filter((k) => k.gio_bat_dau >= '18:00')

  const tong = slots.length
  const daDat = slots.filter((s) => s.status === 'booked').length
  const giuCho = slots.filter((s) => s.status === 'pending_payment').length
  const tamNghi = slots.filter((s) => s.status === 'locked').length
  // Tach 2 quota (rule §4) — khong cong gop thanh mot con so "con trong" gay hieu nham.
  const trong = slots.filter((s) => s.status === 'active')
  const trongOnline = trong.filter((s) => s.loai_slot !== 'walk_in').length
  const trongWalkIn = trong.filter((s) => s.loai_slot === 'walk_in').length
  const thieuDuLieu = slots.filter((s) => s.status === 'booked' && !s.benh_nhan).length

  return (
    <section className="card mt-4 overflow-hidden" aria-label={`Ca khám ${tieuDe}`}>
      <header className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold capitalize text-slate-900">{tieuDe}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              {phongKham ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="map-pin" className="h-3.5 w-3.5 text-slate-400" />
                  {phongKham}
                </span>
              ) : (
                <span className="text-amber-600">Chưa phân phòng</span>
              )}
              {tong > 0 && <span className="tabular-nums">{tong} khung giờ</span>}
            </p>
          </div>
          {onXemChiTiet && tong > 0 && (
            <button type="button" onClick={onXemChiTiet} className="btn-secondary min-h-9 px-3 text-sm">
              <Icon name="file-text" className="h-4 w-4" /> Lịch hẹn &amp; thanh toán
            </button>
          )}
        </div>

        {ghiChu && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{ghiChu}</p>
        )}

        {tong > 0 && (
          <>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {[
                { nhan: 'Trống — online', gt: trongOnline, mau: 'text-slate-900' },
                ...(trongWalkIn > 0 ? [{ nhan: 'Trống — tại chỗ', gt: trongWalkIn, mau: 'text-slate-500' }] : []),
                { nhan: 'Đã đặt', gt: daDat, mau: 'text-brand-700' },
                { nhan: 'Giữ chỗ', gt: giuCho, mau: 'text-amber-700' },
                ...(tamNghi > 0 ? [{ nhan: 'Tạm nghỉ', gt: tamNghi, mau: 'text-rose-700' }] : []),
              ].map((o) => (
                <div key={o.nhan} className="flex items-baseline gap-1.5">
                  <dd className={`text-xl font-bold tabular-nums ${o.mau}`}>{o.gt}</dd>
                  <dt className="text-sm text-slate-500">{o.nhan}</dt>
                </div>
              ))}
            </dl>
            {thieuDuLieu > 0 && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {thieuDuLieu} chỗ được đánh dấu đã đặt nhưng không tìm thấy lịch hẹn tương ứng. Liên hệ Admin kiểm tra dữ liệu.
              </p>
            )}
          </>
        )}
      </header>

      {tong === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
          <Icon name="calendar" className="h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">Chưa có lịch làm việc</p>
          <p className="mt-1 text-sm text-slate-500">Ngày này chưa được Admin tạo ca. Liên hệ Admin nếu bạn có đăng ký.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-x-8 gap-y-6 px-5 py-4 lg:grid-cols-3">
            <CaColumn
              nhan="Ca sáng" khungs={caSang} leaves={leaves} gioHienTai={gioHienTai}
              chiXem={chiXem} onXinNghi={onXinNghi} onYeuCauHuy={onYeuCauHuy}
            />
            <CaColumn
              nhan="Ca chiều" khungs={caChieu} leaves={leaves} gioHienTai={gioHienTai}
              chiXem={chiXem} onXinNghi={onXinNghi} onYeuCauHuy={onYeuCauHuy}
            />
            <CaColumn
              nhan="Ca tối" khungs={caToi} leaves={leaves} gioHienTai={gioHienTai}
              chiXem={chiXem} onXinNghi={onXinNghi} onYeuCauHuy={onYeuCauHuy}
            />
          </div>

          <footer className="border-t border-slate-200 bg-slate-50/60 px-5 py-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5"><Pip status="booked" /> Đã đặt</span>
              <span className="flex items-center gap-1.5"><Pip status="pending_payment" /> Giữ chỗ chờ thanh toán</span>
              <span className="flex items-center gap-1.5"><Pip status="active" /> Trống — đặt online</span>
              <span className="flex items-center gap-1.5"><Pip status="active" walkIn /> Trống — dành khách tại chỗ</span>
              <span className="flex items-center gap-1.5"><Pip status="locked" /> Tạm nghỉ</span>
            </div>
            {/* Cau nay truoc day ghi "bang chi hien khach online" — SAI, vi bang van hien slot
                walk-in va le tan co the dat vao slot. Noi dung dung theo rule §4 + §6. */}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Tỷ lệ chỗ tính theo quota đặt online. Chỗ dành khách tại chỗ là quota riêng, ghi tách bên dưới.
              Danh sách bệnh nhân thực tế đã đến — cả online và tại chỗ — nằm ở Hồ sơ chờ khám sau khi check-in.
            </p>
          </footer>
        </>
      )}
    </section>
  )
}
