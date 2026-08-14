// ============================================================
// B47 — Cảnh báo dị ứng khi kê thuốc (HÀM THUẦN, không chạm DB)
// ============================================================
// `HoSoBenhNhan.di_ung` / `HangDoi.di_ung` và `DonThuoc.items[].ten_thuoc` đều là văn bản tự
// do (String), không có danh mục hoạt chất hay mã thuốc trong hệ thống — xem
// docs/Hoi-dong/F-Kiem-chung-file-E-va-ke-hoach-nang-cap.md mục 2.1. Vì vậy đây CHỈ là cảnh
// báo MỀM theo so khớp chuỗi con đã chuẩn hóa dấu, KHÔNG thay thế tra cứu tương tác thuốc
// chuyên nghiệp. Bác sĩ luôn được override kèm lý do (xem examSession.service.js bước 'ke_don').

// Cùng công thức chuẩn hóa đã dùng ở models/ChuyenKhoa.js (toSlug) — giữ nhất quán codebase.
function chuanHoa(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh tiếng Việt (Unicode combining marks U+0300–U+036F)
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

const DELIM = /[,;/+\n]+/

/** Tách chuỗi dị ứng tự do thành từ khóa riêng lẻ; bỏ từ khóa quá ngắn (dễ trùng nhầm). */
function tachTuKhoaDiUng(diUng) {
  return chuanHoa(diUng)
    .split(DELIM)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
}

/**
 * Đối chiếu danh sách thuốc kê với dị ứng đã ghi nhận (rule mục B47).
 *
 * So khớp CHUỖI CON hai chiều trên văn bản đã chuẩn hóa:
 *   - tên thuốc CHỨA từ khóa dị ứng ("Amoxicillin + Penicillin" chứa "penicillin")
 *   - từ khóa dị ứng CHỨA tên thuốc, khi dị ứng ghi thành cụm dài không tách được
 *     ("dị ứng nhóm Penicillin" chứa "penicillin" dù dấu phẩy không tách cụm này ra)
 * Đây là cảnh báo MỀM mức chuỗi ký tự — KHÔNG phải tra cứu hoạt chất y khoa.
 *
 * @param {object} params
 * @param {string|null} params.diUng - chuỗi dị ứng tự do từ hồ sơ/hàng đợi
 * @param {Array<{ten_thuoc: string}>} params.thuoc - danh sách thuốc từ payload kê đơn
 * @returns {Array<{ten_thuoc: string, tu_khoa_trung: string[]}>} thuốc khả nghi, rỗng nếu an toàn
 */
export function kiemTraDiUngThuoc({ diUng, thuoc }) {
  const tuKhoa = tachTuKhoaDiUng(diUng)
  if (tuKhoa.length === 0 || !Array.isArray(thuoc)) return []

  const canhBao = []
  for (const item of thuoc) {
    const tenChuanHoa = chuanHoa(item?.ten_thuoc)
    if (tenChuanHoa.length < 2) continue

    const trung = tuKhoa.filter((tk) => (
      tenChuanHoa.includes(tk) || (tenChuanHoa.length >= 3 && tk.includes(tenChuanHoa))
    ))
    if (trung.length > 0) {
      canhBao.push({ ten_thuoc: item.ten_thuoc, tu_khoa_trung: [...new Set(trung)] })
    }
  }
  return canhBao
}
