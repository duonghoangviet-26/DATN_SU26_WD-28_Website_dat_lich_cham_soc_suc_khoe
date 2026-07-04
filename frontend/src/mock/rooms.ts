// Danh sách phòng khám — do Admin quản lý qua C3 (collection phong_kham trong MongoDB).
// Model: backend/src/models/PhongKham.js | Seed: backend/src/scripts/seed-all.js
// Khi gắn DB: thay bằng GET /api/phong-kham (trả full_name virtual = "{ten}, Tầng {tang}, Tòa {toa}").
// full_name khớp 1-1 với DoctorSlot.phong_kham và LichHen.phong_kham (String snapshot).

export interface Room {
  id: number
  ten: string     // "Phòng 201"
  tang: number    // Tầng 2
  toa: string     // "A" | "B"
  loai: string    // "Khám thông thường" | "Khám chuyên khoa" | ...
  full_name: string // "Phòng 201, Tầng 2, Tòa A" — khớp với DoctorSlot.phong_kham
}

export const mockRooms: Room[] = [
  { id: 1, ten: 'Phòng 101', tang: 1, toa: 'A', loai: 'Khám thông thường',  full_name: 'Phòng 101, Tầng 1, Tòa A' },
  { id: 2, ten: 'Phòng 102', tang: 1, toa: 'A', loai: 'Khám thông thường',  full_name: 'Phòng 102, Tầng 1, Tòa A' },
  { id: 3, ten: 'Phòng 201', tang: 2, toa: 'A', loai: 'Khám chuyên khoa',   full_name: 'Phòng 201, Tầng 2, Tòa A' },
  { id: 4, ten: 'Phòng 202', tang: 2, toa: 'A', loai: 'Khám chuyên khoa',   full_name: 'Phòng 202, Tầng 2, Tòa A' },
  { id: 5, ten: 'Phòng 305', tang: 3, toa: 'B', loai: 'Siêu âm / Nội soi',  full_name: 'Phòng 305, Tầng 3, Tòa B' },
  { id: 6, ten: 'Phòng 306', tang: 3, toa: 'B', loai: 'Siêu âm / Nội soi',  full_name: 'Phòng 306, Tầng 3, Tòa B' },
  { id: 7, ten: 'Phòng 401', tang: 4, toa: 'B', loai: 'Xét nghiệm',          full_name: 'Phòng 401, Tầng 4, Tòa B' },
  { id: 8, ten: 'Phòng 402', tang: 4, toa: 'B', loai: 'Xét nghiệm',          full_name: 'Phòng 402, Tầng 4, Tòa B' },
]
