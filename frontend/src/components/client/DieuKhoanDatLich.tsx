import { useState } from 'react'

// Điều khoản đặt lịch — nội dung phải khớp `DIEU_KHOAN_VERSION` ở backend
// (`patient/booking.controller.js`). Đổi nội dung thì PHẢI tăng version ở CẢ HAI nơi,
// nếu không lịch hẹn cũ và mới cùng trỏ về một version mà nội dung lại khác — mất giá
// trị làm bằng chứng khi có tranh chấp.
//
// Nghiệp vụ: .claude/rules/lich-lam-viec-bac-si.md mục 5 và 11.
export const DIEU_KHOAN_VERSION = '2026-07-26.v1'

interface Props {
  daDongY: boolean
  onChange: (daDongY: boolean) => void
  giaKham?: number | null
}

const formatCurrency = (value: number) => `${value.toLocaleString('vi-VN')}₫`

// Bảng tình huống — viết đúng thứ khách sẽ gặp, không né điều bất lợi.
// Khách đọc xong phải biết chính xác khi nào mình mất tiền.
const TINH_HUONG: { khi: string; ketQua: string; mat: boolean }[] = [
  { khi: 'Bạn đến trong vòng 15 phút kể từ giờ hẹn', ketQua: 'Khám bình thường, giữ nguyên thứ tự ưu tiên', mat: false },
  { khi: 'Bạn đến muộn hơn 15 phút nhưng vẫn trong ca', ketQua: 'Vẫn được khám, xếp sau người đến đúng giờ — không mất tiền', mat: false },
  { khi: 'Bạn đã đến quầy nhưng hết ca vẫn chưa được gọi', ketQua: 'Được dời sang buổi khác, không mất tiền, không tính vào số lần dời', mat: false },
  { khi: 'Phòng khám đổi lịch (bác sĩ bận, nghỉ đột xuất)', ketQua: 'Được chọn phương án thay thế, giữ nguyên giá, không tính vào số lần dời', mat: false },
  { khi: 'Bạn xin dời lịch (trước giờ khám ít nhất 30 phút)', ketQua: 'Được dời 1 lần duy nhất, giữ nguyên số tiền đã trả', mat: false },
  { khi: 'Bạn không đến và không báo trước', ketQua: 'Mất toàn bộ số tiền đã thanh toán', mat: true },
  { khi: 'Bạn chủ động huỷ lịch', ketQua: 'Mất toàn bộ số tiền đã thanh toán', mat: true },
]

export default function DieuKhoanDatLich({ daDongY, onChange, giaKham }: Props) {
  const [moRong, setMoRong] = useState(false)

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
      <div className="border-b border-amber-200/70 px-5 py-4">
        <h3 className="text-sm font-bold text-amber-900">Điều khoản đặt lịch</h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          Bạn thanh toán <strong>100% phí khám{giaKham ? ` (${formatCurrency(giaKham)})` : ''}</strong> ngay khi đặt để
          giữ chỗ. Phòng khám <strong>không hoàn tiền</strong> — thay vào đó, nếu có sự cố bạn được{' '}
          <strong>dời lịch mà không mất khoản nào</strong>.
        </p>
      </div>

      <div className="px-5 py-4">
        <button
          type="button"
          onClick={() => setMoRong((v) => !v)}
          aria-expanded={moRong}
          className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-sm font-semibold text-amber-900 hover:text-amber-950"
        >
          <span>Xem đầy đủ 7 tình huống và cách xử lý</span>
          <span aria-hidden className={`transition-transform ${moRong ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {moRong && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-amber-200 text-xs uppercase tracking-wide text-amber-700">
                  <th className="py-2 pr-4 font-semibold">Tình huống</th>
                  <th className="py-2 font-semibold">Cách xử lý</th>
                </tr>
              </thead>
              <tbody>
                {TINH_HUONG.map((item) => (
                  <tr key={item.khi} className="border-b border-amber-200/50 last:border-0 align-top">
                    <td className="py-3 pr-4 text-amber-900">{item.khi}</td>
                    <td className={`py-3 ${item.mat ? 'font-semibold text-red-700' : 'text-amber-800'}`}>
                      {item.ketQua}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-xs leading-relaxed text-amber-700">
              Đặt lịch online đóng trước giờ khám 30 phút. Sau mốc đó bạn vẫn có thể đến quầy lễ tân
              để lấy lượt nếu còn chỗ. Mỗi người chỉ đặt một lượt cho mỗi chuyên khoa trong một ngày.
            </p>
            <p className="mt-2 text-xs text-amber-600">Phiên bản điều khoản: {DIEU_KHOAN_VERSION}</p>
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 border-t border-amber-200/70 bg-white/70 px-5 py-4">
        <input
          type="checkbox"
          checked={daDongY}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-slate-700">
          Tôi đã đọc và đồng ý với điều khoản đặt lịch, bao gồm việc{' '}
          <strong className="text-slate-900">không hoàn tiền</strong> nếu tôi huỷ lịch hoặc không đến khám.
        </span>
      </label>
    </section>
  )
}
