// Cấu hình năng lực khám của một chuyên khoa.
// Nghiệp vụ bất biến: .claude/rules/lich-lam-viec-bac-si.md mục 2, 4, 12.
//   CA → KHUNG GIỜ (30') → SLOT.  Ca sáng 7 khung, ca chiều 8 khung.
//   Số slot/khung = floor(30 / thời gian khám), LUÔN làm tròn xuống.
// Dùng chung cho AddSpecialty và EditSpecialty để hai form không phân kỳ.

export const DO_DAI_KHUNG_PHUT = 30
const KHUNG_CA_SANG = 7
const KHUNG_CA_CHIEU = 8

export interface CapacityForm {
  thoi_gian_kham_trung_binh_phut: number
  so_slot_moi_khung: number | '' // '' = để trống = tự tính
  ty_le_online_phan_tram: number
  gia_kham: number
}

export const CAPACITY_MAC_DINH: CapacityForm = {
  thoi_gian_kham_trung_binh_phut: 15,
  so_slot_moi_khung: '',
  ty_le_online_phan_tram: 70,
  gia_kham: 0,
}

export function soSlotToiDa(thoiGianKhamPhut: number): number {
  const phut = Number(thoiGianKhamPhut)
  if (!Number.isFinite(phut) || phut <= 0) return 1
  return Math.max(1, Math.floor(DO_DAI_KHUNG_PHUT / phut))
}

export function soSlotThucDung(form: CapacityForm): number {
  const toiDa = soSlotToiDa(form.thoi_gian_kham_trung_binh_phut)
  const override = Number(form.so_slot_moi_khung)
  if (form.so_slot_moi_khung === '' || !Number.isFinite(override) || override <= 0) return toiDa
  return Math.min(Math.floor(override), toiDa)
}

// Trả về chuỗi lỗi, hoặc null nếu hợp lệ. Khớp với kiemTraCauHinhSlot() ở backend.
export function kiemTraCapacity(form: CapacityForm): string | null {
  const phut = Number(form.thoi_gian_kham_trung_binh_phut)
  if (!Number.isFinite(phut) || phut < 5 || phut > DO_DAI_KHUNG_PHUT) {
    return `Thời gian khám trung bình phải từ 5 đến ${DO_DAI_KHUNG_PHUT} phút`
  }
  const tyLe = Number(form.ty_le_online_phan_tram)
  if (!Number.isFinite(tyLe) || tyLe < 0 || tyLe > 100) {
    return 'Tỷ lệ slot online phải từ 0 đến 100'
  }
  const gia = Number(form.gia_kham)
  if (!Number.isFinite(gia) || gia < 0) {
    return 'Giá khám không được âm'
  }
  if (form.so_slot_moi_khung !== '') {
    const soSlot = Number(form.so_slot_moi_khung)
    const toiDa = soSlotToiDa(phut)
    if (!Number.isInteger(soSlot) || soSlot < 1) {
      return 'Số slot mỗi khung phải là số nguyên từ 1 trở lên'
    }
    if (soSlot > toiDa) {
      return `Với ca khám ${phut} phút, mỗi khung ${DO_DAI_KHUNG_PHUT} phút chứa tối đa ${toiDa} slot. Chỉ được đặt thấp hơn mức này.`
    }
  }
  return null
}

// Payload gửi lên API: '' → null để backend hiểu là "tự tính".
export function capacityPayload(form: CapacityForm) {
  return {
    thoi_gian_kham_trung_binh_phut: Number(form.thoi_gian_kham_trung_binh_phut),
    so_slot_moi_khung: form.so_slot_moi_khung === '' ? null : Number(form.so_slot_moi_khung),
    ty_le_online_phan_tram: Number(form.ty_le_online_phan_tram),
    gia_kham: Number(form.gia_kham),
  }
}

interface Props {
  form: CapacityForm
  onChange: (patch: Partial<CapacityForm>) => void
}

export default function SpecialtyCapacityFields({ form, onChange }: Props) {
  const soSlot = soSlotThucDung(form)
  const toiDa = soSlotToiDa(form.thoi_gian_kham_trung_binh_phut)
  const tyLe = Number(form.ty_le_online_phan_tram) || 0

  const sucChuaSang = KHUNG_CA_SANG * soSlot
  const sucChuaChieu = KHUNG_CA_CHIEU * soSlot
  const onlineSang = Math.round((sucChuaSang * tyLe) / 100)
  const onlineChieu = Math.round((sucChuaChieu * tyLe) / 100)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Năng lực khám</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Quyết định mỗi khung 30 phút nhận được bao nhiêu bệnh nhân và giữ bao nhiêu chỗ cho
          khách đặt online.
        </p>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Thời gian khám trung bình
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={DO_DAI_KHUNG_PHUT}
              value={form.thoi_gian_kham_trung_binh_phut}
              onChange={(e) =>
                onChange({ thoi_gian_kham_trung_binh_phut: Number(e.target.value) })
              }
              className="input w-full"
            />
            <span className="shrink-0 text-sm text-slate-500">phút</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Khung {DO_DAI_KHUNG_PHUT} phút chứa tối đa {toiDa} slot.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Số slot mỗi khung
          </label>
          <input
            type="number"
            min={1}
            max={toiDa}
            placeholder={`Tự tính: ${toiDa}`}
            value={form.so_slot_moi_khung}
            onChange={(e) =>
              onChange({
                so_slot_moi_khung: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
            className="input w-full"
          />
          <p className="mt-1 text-xs text-slate-400">
            Để trống để hệ thống tự tính. Chỉ đặt được thấp hơn {toiDa}.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Chỗ giữ cho khách đặt online
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={form.ty_le_online_phan_tram}
              onChange={(e) => onChange({ ty_le_online_phan_tram: Number(e.target.value) })}
              className="input w-full"
            />
            <span className="shrink-0 text-sm text-slate-500">%</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Phần còn lại ({100 - tyLe}%) dành cho khách tới quầy.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Giá khám</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1000}
              value={form.gia_kham}
              onChange={(e) => onChange({ gia_kham: Number(e.target.value) })}
              className="input w-full"
            />
            <span className="shrink-0 text-sm text-slate-500">đ</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Một giá chung cho cả chuyên khoa, không đổi theo từng bác sĩ.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Một ngày làm việc sẽ thành
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Ca sáng · {KHUNG_CA_SANG} khung</dt>
            <dd className="font-semibold text-slate-800">{sucChuaSang} chỗ</dd>
            <dd className="text-xs text-slate-500">
              {onlineSang} online · {sucChuaSang - onlineSang} tại quầy
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Ca chiều · {KHUNG_CA_CHIEU} khung</dt>
            <dd className="font-semibold text-slate-800">{sucChuaChieu} chỗ</dd>
            <dd className="text-xs text-slate-500">
              {onlineChieu} online · {sucChuaChieu - onlineChieu} tại quầy
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Cả ngày</dt>
            <dd className="font-semibold text-brand-600">{sucChuaSang + sucChuaChieu} chỗ</dd>
            <dd className="text-xs text-slate-500">{soSlot} slot mỗi khung</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
