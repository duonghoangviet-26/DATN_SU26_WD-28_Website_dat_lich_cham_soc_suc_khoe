import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

import * as models from '../models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI

if (!uri) {
  console.error('❌ Lỗi: Chưa có MONGODB_URI trong file .env')
  process.exit(1)
}

function roomFullName(room) {
  return `${room.ten}, Tầng ${room.tang}, Tòa ${room.toa}`
}

function addDays(baseDate, diffDays) {
  const next = new Date(baseDate)
  next.setUTCDate(next.getUTCDate() + diffDays)
  return next
}

function dateOnlyUtc(date) {
  const next = new Date(date)
  next.setUTCHours(0, 0, 0, 0)
  return next
}

function isoDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10)
}

async function seedAll() {
  try {
    console.log('⏳ Đang kết nối MongoDB Cloud...')
    await mongoose.connect(uri)
    console.log('✅ Kết nối thành công!')

    const {
      NguoiDung,
      DatLaiMatKhau,
      ThongTinPhongKham,
      CauHinhPhongKham,
      ChuyenKhoa,
      DichVu,
      CaiDatThanhToan,
      GiaDinh,
      ThanhVien,
      KhachVangLai,
      BacSi,
      NghiPhepBacSi,
      HoSoChiTietBacSi,
      LichLamViec,
      PhongKham,
      LichHen,
      HoaDon,
      ThanhToan,
      HoanTien,
      HoSoYTe,
      KetQuaKham,
      KetQuaKhamTai,
      KetQuaKhamMui,
      KetQuaKhamHong,
      SinhHieuKham,
      DonThuoc,
      NhacNho,
      DanhGia,
      ThongBao,
      ThongBaoHeThong,
      PhienChat,
      TinNhanChat,
      LichSuLichHen,
      NhatKyThaoTac,
      Counter,
    } = models

    console.log('\n🗑️  Đang dọn dẹp dữ liệu cũ (reset toàn bộ collections)...')
    for (const [name, model] of Object.entries(models)) {
      if (model && typeof model.deleteMany === 'function') {
        await model.deleteMany({})
      } else {
        console.log(`ℹ️  Bỏ qua ${name} vì không phải mongoose model`)
      }
    }
    console.log('✅ Đã dọn dẹp xong dữ liệu cũ.')

    const passwordHash = await bcrypt.hash('123456', 10)
    const today = dateOnlyUtc(new Date())
    const yesterday = addDays(today, -1)
    const twoDaysAgo = addDays(today, -2)
    const tomorrow = addDays(today, 1)
    const nextWeek = addDays(today, 7)

    console.log('\n🌱 Đang chèn dữ liệu nền...')

    const clinic = await ThongTinPhongKham.create({
      ten: 'Phòng khám đa khoa VitaFamily',
      trang_thai: 'active',
      dia_chi: '12 Nguyễn Văn Bảo, Gò Vấp, TP. Hồ Chí Minh',
      so_dien_thoai: '19001515',
      email: 'contact@vitafamily.vn',
      gio_lam_viec: '08:00-20:00 Thứ 2-Chủ Nhật',
      mo_ta: 'Phòng khám tư một cơ sở, tập trung quản lý lịch khám, bác sĩ và dịch vụ.',
      logo_url: 'https://example.com/vitafamily-logo.png',
      ban_do_url: 'https://maps.google.com/?q=VitaFamily',
      bao_hiem: {
        nha_nuoc: true,
        bao_lanh: true,
      },
    })

    await CauHinhPhongKham.create({
      singleton_key: 'CAU_HINH_PHONG_KHAM',
      thoi_gian_giu_slot_phut: 15,
      so_lan_doi_lich_toi_da: 3,
      thoi_gian_toi_thieu_truoc_kham_de_doi_lich_gio: 24,
      nguong_huy_lich_trong_thang: 3,
      chinh_sach_hoan_tien: [
        { thoi_gian_toi_thieu_gio: 24, ti_le_hoan: 100, phi_huy_co_dinh: 0 },
        { thoi_gian_toi_thieu_gio: 2, ti_le_hoan: 50, phi_huy_co_dinh: 20000 },
      ],
      cau_hinh_nhac_lich: {
        bat_cho_nhac: true,
        so_gio_truoc_kham: 24,
        kenh_gui_mac_dinh: ['in_app', 'email'],
      },
      cau_hinh_nhac_tai_kham: {
        bat_cho_nhac: true,
        so_ngay_nhac_truoc: 3,
      },
    })

    await CaiDatThanhToan.create([
      { ten_cai_dat: 'hoan_tien_truoc_24h', gia_tri: '100', mo_ta: 'Hoàn 100% nếu hủy trước 24 giờ.' },
      { ten_cai_dat: 'hoan_tien_truoc_2h', gia_tri: '50', mo_ta: 'Hoàn 50% nếu hủy trước 2 giờ.' },
      { ten_cai_dat: 'khong_hoan_tien_sau_2h', gia_tri: '0', mo_ta: 'Không hoàn tiền nếu hủy quá sát giờ khám.' },
      { ten_cai_dat: 'hoan_tien_admin_huy', gia_tri: '100', mo_ta: 'Admin hủy lịch được hoàn 100%.' },
    ])

    const specialties = await ChuyenKhoa.create([
      {
        phong_kham_id: clinic._id,
        ten: 'Nhi khoa',
        mo_ta: 'Theo dõi và điều trị sức khỏe trẻ em.',
        icon_url: 'https://example.com/icons/nhi-khoa.png',
        slug: 'nhi-khoa',
        thu_tu: 1,
        status: 'active',
      },
      {
        phong_kham_id: clinic._id,
        ten: 'Da liễu',
        mo_ta: 'Khám và chăm sóc các bệnh lý da liễu.',
        icon_url: 'https://example.com/icons/da-lieu.png',
        slug: 'da-lieu',
        thu_tu: 2,
        status: 'active',
      },
      {
        phong_kham_id: clinic._id,
        ten: 'Tai Mũi Họng',
        mo_ta: 'Khám TMH, nội soi tai mũi họng và tư vấn điều trị.',
        icon_url: 'https://example.com/icons/tmh.png',
        slug: 'tai-mui-hong',
        thu_tu: 3,
        status: 'active',
      },
    ])

    const rooms = await PhongKham.create([
      { ten: 'Phòng 101', tang: 1, toa: 'A', loai: 'Khám tổng quát', trang_thai: 'active' },
      { ten: 'Phòng 102', tang: 1, toa: 'A', loai: 'Khám tổng quát', trang_thai: 'active' },
      { ten: 'Phòng 201', tang: 2, toa: 'A', loai: 'Khám chuyên khoa', trang_thai: 'active' },
      { ten: 'Phòng 202', tang: 2, toa: 'A', loai: 'Khám chuyên khoa', trang_thai: 'active' },
      { ten: 'Phòng 301', tang: 3, toa: 'B', loai: 'Nội soi TMH', trang_thai: 'active' },
      { ten: 'Phòng 302', tang: 3, toa: 'B', loai: 'Da liễu', trang_thai: 'active' },
      { ten: 'Phòng 401', tang: 4, toa: 'B', loai: 'Xét nghiệm', trang_thai: 'active' },
      { ten: 'Phòng 402', tang: 4, toa: 'B', loai: 'Xét nghiệm', trang_thai: 'inactive' },
    ])

    const users = await NguoiDung.create([
      {
        ho_ten: 'Admin VitaFamily',
        email: 'admin@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000000',
        role: 'admin',
        status: 'active',
      },
      {
        ho_ten: 'Lễ tân Hoàng Anh',
        email: 'reception@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000009',
        role: 'receptionist',
        status: 'active',
      },
      {
        ho_ten: 'Điều dưỡng Thanh Hà',
        email: 'nurse@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000010',
        role: 'nurse',
        status: 'active',
      },
      {
        ho_ten: 'BS. Trần Minh Khang',
        email: 'doctor.khang@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000001',
        role: 'doctor',
        status: 'active',
      },
      {
        ho_ten: 'BS. Nguyễn Thu An',
        email: 'doctor.an@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000002',
        role: 'doctor',
        status: 'active',
      },
      {
        ho_ten: 'BS. Lê Quốc Bảo',
        email: 'doctor.bao@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000003',
        role: 'doctor',
        status: 'active',
      },
      {
        ho_ten: 'Nguyễn Minh An',
        email: 'patient01.demo@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000004',
        role: 'user',
        status: 'active',
      },
      {
        ho_ten: 'Phạm Thị Hồng',
        email: 'patient02.demo@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000005',
        role: 'user',
        status: 'active',
      },
      {
        ho_ten: 'Lê Văn Nam',
        email: 'patient03.demo@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000006',
        role: 'user',
        status: 'active',
      },
      {
        ho_ten: 'Tài khoản Khóa Mẫu',
        email: 'locked.demo@vitafamily.vn',
        mat_khau: passwordHash,
        so_dien_thoai: '0901000007',
        role: 'user',
        status: 'locked',
        bi_han_che_dat_lich: true,
        tong_so_lan_huy_lich_su: 4,
      },
    ])

    const admin = users[0]
    const receptionist = users[1]
    const nurse = users[2]
    const doctorUserA = users[3]
    const doctorUserB = users[4]
    const doctorUserC = users[5]
    const patientA = users[6]
    const patientB = users[7]
    const patientC = users[8]

    const services = await DichVu.create([
      {
        ten: 'Lấy mẫu xét nghiệm tại nhà cơ bản',
        loai: 'home',
        gia: 180000,
        mo_ta_ngan: 'Nhân viên đến nhà lấy mẫu xét nghiệm cơ bản.',
        mo_ta: 'Dịch vụ lấy mẫu máu tại nhà cho các xét nghiệm cơ bản.',
        gio_dat_truoc_toi_thieu: 4,
        khu_vuc: ['Gò Vấp', 'Bình Thạnh', 'Phú Nhuận'],
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Lấy mẫu xét nghiệm nhi khoa tại nhà',
        loai: 'home',
        gia: 220000,
        mo_ta_ngan: 'Hỗ trợ lấy mẫu tại nhà cho trẻ em.',
        mo_ta: 'Dịch vụ lấy mẫu tại nhà ưu tiên trẻ nhỏ, có điều dưỡng hỗ trợ.',
        gio_dat_truoc_toi_thieu: 6,
        khu_vuc: ['Gò Vấp', 'Tân Bình'],
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Lấy mẫu xét nghiệm tổng quát cho gia đình',
        loai: 'home',
        gia: 350000,
        mo_ta_ngan: 'Lấy mẫu cùng lúc cho nhiều thành viên trong gia đình.',
        mo_ta: 'Phù hợp cho gia đình có nhu cầu kiểm tra sức khỏe định kỳ tại nhà.',
        gio_dat_truoc_toi_thieu: 8,
        khu_vuc: ['Gò Vấp', 'Bình Thạnh', 'Quận 12'],
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Kh??m da li???u c?? b???n',
        loai: 'related',
        gia: 200000,
        mo_ta_ngan: 'Kh??m da li???u c?? b???n theo ch??? ?????nh b??c s??.',
        mo_ta: 'D???ch v??? li??n quan cho kh??m da li???u t???i ph??ng kh??m.',
        chuan_bi_truoc: 'Kh??ng b??i thu???c ngo??i da tr?????c khi kh??m n???u c?? th???.',
        specialty_id: specialties[0]._id,
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Khám tổng quát trẻ kết hợp TMH',
        loai: 'related',
        gia: 280000,
        mo_ta_ngan: 'Khám tổng quát cho trẻ có kết hợp đánh giá TMH.',
        mo_ta: 'Gói khám phù hợp cho trẻ em cần kiểm tra tổng quát định kỳ.',
        chuan_bi_truoc: 'Cho trẻ nghỉ ngơi đầy đủ trước khi đến khám.',
        specialty_id: specialties[0]._id,
        la_goi: true,
        doi_tuong_ap_dung: 'tre_em',
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Theo dõi định kỳ da liễu cơ bản',
        loai: 'related',
        gia: 260000,
        mo_ta_ngan: 'Theo dõi da liễu cơ bản theo lịch hẹn định kỳ.',
        mo_ta: 'Phù hợp cho khách hàng theo dõi mụn, viêm da, kích ứng da.',
        chuan_bi_truoc: 'Không bôi thuốc ngoài da trước khi khám 12 giờ.',
        specialty_id: specialties[0]._id,
        la_goi: true,
        doi_tuong_ap_dung: 'khong_gioi_han',
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Chăm sóc giọng nói',
        loai: 'related',
        gia: 320000,
        mo_ta_ngan: 'Đánh giá và tư vấn chăm sóc giọng nói.',
        mo_ta: 'Dành cho giáo viên, ca sĩ hoặc người sử dụng giọng nói thường xuyên.',
        chuan_bi_truoc: 'Hạn chế nước lạnh và không dùng chất kích thích trước khám.',
        specialty_id: specialties[0]._id,
        la_goi: true,
        doi_tuong_ap_dung: 'nguoi_lon',
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'T???m so??t vi??m m??i xoang theo m??a',
        loai: 'related',
        gia: 1000000,
        mo_ta_ngan: 'G??i t???m so??t TMH d??nh cho giai ??o???n giao m??a.',
        mo_ta: '????nh gi?? tri???u ch???ng vi??m m??i xoang v?? t?? v???n ??i???u tr??? theo m??a.',
        chuan_bi_truoc: 'Tr??nh d??ng thu???c co m???ch m??i ngay tr?????c khi kh??m.',
        specialty_id: specialties[1]._id,
        nguoi_tao_id: admin._id,
        la_goi: true,
        doi_tuong_ap_dung: 'khong_gioi_han',
        status: 'active',
      },
    ])

    const doctors = await BacSi.create([
      {
        tieu_su: 'B??c s?? da li???u v???i h??n 10 n??m kinh nghi???m ??i???u tr??? v?? theo d??i ?????nh k???.',
        bang_cap: 'BSCKI Da li???u',
        tieu_su: 'Bác sĩ nội khoa với hơn 10 năm kinh nghiệm.',
        bang_cap: 'BSCKI Nội khoa',
        kinh_nghiem: 'Từng công tác tại bệnh viện đa khoa tuyến tỉnh.',
        so_nam_kinh_nghiem: 10,
        gia_kham: 200000,
        phi_kham: 200000,
        tuoi_nhan_kham_tu: 15,
        trang_thai_duyet: 'approved',
        trang_thai: 'active',
        so_lan_nop: 1,
        la_hien: true,
        diem_danh_gia: 4.8,
        tong_danh_gia: 15,
        phong_kham_mac_dinh: roomFullName(rooms[0]),
        specialties: [specialties[0]._id],
        services: [services[0]._id],
        bao_hiem: { nha_nuoc: true, bao_lanh: true },
        related_services: [services[3]._id],
        loai: 'specialist',
      },
      {
        user_id: doctorUserB._id,
        chi_nhanh_id: clinic._id,
        tieu_su: 'Bác sĩ nhi khoa chuyên theo dõi trẻ nhỏ và trẻ sơ sinh.',
        bang_cap: 'ThS.BS Nhi khoa',
        kinh_nghiem: 'Có kinh nghiệm tại khoa Nhi bệnh viện thành phố.',
        so_nam_kinh_nghiem: 7,
        gia_kham: 250000,
        phi_kham: 250000,
        tuoi_nhan_kham_tu: 0,
        trang_thai_duyet: 'approved',
        trang_thai: 'active',
        so_lan_nop: 1,
        la_hien: true,
        diem_danh_gia: 4.9,
        tong_danh_gia: 18,
        phong_kham_mac_dinh: roomFullName(rooms[2]),
        specialties: [specialties[0]._id],
        services: [services[1]._id],
        bao_hiem: { nha_nuoc: false, bao_lanh: true },
        related_services: [services[4]._id],
        loai: 'specialist',
      },
      {
        user_id: doctorUserC._id,
        chi_nhanh_id: clinic._id,
        tieu_su: 'Bác sĩ Tai Mũi Họng kết hợp theo dõi dịch vụ tại nhà.',
        bang_cap: 'BSCKI Tai Mũi Họng',
        kinh_nghiem: 'Khám TMH, nội soi và chăm sóc giọng nói.',
        so_nam_kinh_nghiem: 9,
        gia_kham: 300000,
        phi_kham: 300000,
        tuoi_nhan_kham_tu: 3,
        trang_thai_duyet: 'approved',
        trang_thai: 'active',
        so_lan_nop: 1,
        la_hien: true,
        diem_danh_gia: 4.7,
        tong_danh_gia: 9,
        phong_kham_mac_dinh: roomFullName(rooms[4]),
        specialties: [specialties[2]._id],
        services: [services[2]._id],
        bao_hiem: { nha_nuoc: true, bao_lanh: false },
        related_services: [services[6]._id],
        loai: 'specialist',
      },
    ])

    await HoSoChiTietBacSi.create([
      {
        chuc_vu: 'B??c s?? Da li???u',
        chuc_danh: 'BSCKI',
        chuc_vu: 'Bác sĩ Nội khoa',
        benh_ly_dieu_tri: ['Tăng huyết áp', 'Rối loạn tiêu hóa', 'Tiểu đường'],
          { noi_cong_tac: 'VitaFamily', chuc_vu: 'B??c s?? Da li???u', tu_nam: 2020, den_nam: null },
          { noi_cong_tac: 'Bệnh viện Đa khoa Tỉnh A', chuc_vu: 'Bác sĩ điều trị', tu_nam: 2014, den_nam: 2019 },
          { noi_cong_tac: 'VitaFamily', chuc_vu: 'Bác sĩ Nội khoa', tu_nam: 2020, den_nam: null },
        ],
        qua_trinh_dao_tao: [
        thanh_vien_hoi: ['H???i Da li???u Vi???t Nam'],
        ],
        thanh_vien_hoi: ['Hội Nội khoa Việt Nam'],
        giai_thuong: [{ ten: 'Bác sĩ tận tâm', nam: 2022 }],
      },
      {
        doctor_id: doctors[1]._id,
        chuc_danh: 'ThS.BS',
        chuc_vu: 'Bác sĩ Nhi khoa',
        benh_ly_dieu_tri: ['Sốt siêu vi', 'Hen trẻ em', 'Viêm tai giữa'],
        qua_trinh_cong_tac: [
          { noi_cong_tac: 'Bệnh viện Nhi Đồng', chuc_vu: 'Bác sĩ Nội trú', tu_nam: 2017, den_nam: 2021 },
          { noi_cong_tac: 'VitaFamily', chuc_vu: 'Bác sĩ Nhi khoa', tu_nam: 2022, den_nam: null },
        ],
        qua_trinh_dao_tao: [
          { ten_bang: 'Thạc sĩ Nhi khoa', truong: 'ĐH Y Hà Nội', tu_nam: 2019, den_nam: 2021 },
        ],
        thanh_vien_hoi: ['Hội Nhi khoa TP.HCM'],
        giai_thuong: [{ ten: 'Bác sĩ Nhi được yêu thích', nam: 2023 }],
      },
      {
        doctor_id: doctors[2]._id,
        chuc_danh: 'BSCKI',
        chuc_vu: 'Bác sĩ Tai Mũi Họng',
        benh_ly_dieu_tri: ['Viêm mũi xoang', 'Khàn tiếng', 'Ù tai'],
        qua_trinh_cong_tac: [
          { noi_cong_tac: 'Trung tâm TMH', chuc_vu: 'Bác sĩ TMH', tu_nam: 2015, den_nam: 2020 },
          { noi_cong_tac: 'VitaFamily', chuc_vu: 'Bác sĩ TMH', tu_nam: 2021, den_nam: null },
        ],
        qua_trinh_dao_tao: [
          { ten_bang: 'Chuyên khoa I Tai Mũi Họng', truong: 'ĐH Y Dược Huế', tu_nam: 2013, den_nam: 2015 },
        ],
        thanh_vien_hoi: ['Hội Tai Mũi Họng Việt Nam'],
        giai_thuong: [{ ten: 'Chuyên gia TMH tiêu biểu', nam: 2021 }],
      },
    ])

    const families = await GiaDinh.create([
      { user_id: patientA._id, ten_nhom: 'Gia đình Nguyễn Minh An' },
      { user_id: patientB._id, ten_nhom: 'Gia đình Phạm Thị Hồng' },
      { user_id: patientC._id, ten_nhom: 'Gia đình Lê Văn Nam' },
    ])

    const members = await ThanhVien.create([
      {
        family_id: families[0]._id,
        tai_khoan_id: patientA._id,
        ho_ten: 'Nguyễn Minh An',
        ngay_sinh: new Date('1990-01-01'),
        gioi_tinh: 'nam',
        quan_he: 'ban_than',
        nhom_mau: 'O',
        di_ung: 'Không',
        benh_nen: 'Tăng huyết áp nhẹ',
        la_chu_ho: true,
      },
      {
        family_id: families[0]._id,
        ho_ten: 'Bé Demo Đặt Hộ',
        ngay_sinh: new Date('2018-05-20'),
        gioi_tinh: 'nu',
        quan_he: 'con',
        nhom_mau: 'A',
        di_ung: 'Dị ứng hải sản',
        benh_nen: null,
        la_chu_ho: false,
      },
      {
        family_id: families[1]._id,
        tai_khoan_id: patientB._id,
        ho_ten: 'Phạm Thị Hồng',
        ngay_sinh: new Date('1988-03-12'),
        gioi_tinh: 'nu',
        quan_he: 'ban_than',
        nhom_mau: 'B',
        di_ung: 'Không',
        benh_nen: 'Viêm xoang mãn',
        la_chu_ho: true,
      },
      {
        family_id: families[1]._id,
        ho_ten: 'Phạm Gia Bảo',
        ngay_sinh: new Date('2014-07-01'),
        gioi_tinh: 'nam',
        quan_he: 'con',
        nhom_mau: 'AB',
        di_ung: null,
        benh_nen: 'Hen nhẹ',
        la_chu_ho: false,
      },
      {
        family_id: families[2]._id,
        tai_khoan_id: patientC._id,
        ho_ten: 'Lê Văn Nam',
        ngay_sinh: new Date('1985-11-23'),
        gioi_tinh: 'nam',
        quan_he: 'ban_than',
        nhom_mau: 'O',
        di_ung: 'Phấn hoa',
        benh_nen: null,
        la_chu_ho: true,
      },
      {
        family_id: families[2]._id,
        ho_ten: 'Lê Thị Hoa',
        ngay_sinh: new Date('1987-02-14'),
        gioi_tinh: 'nu',
        quan_he: 'vo',
        nhom_mau: 'A',
        di_ung: null,
        benh_nen: 'Da nhạy cảm',
        la_chu_ho: false,
      },
    ])

    const guestPatients = await KhachVangLai.create([
      {
        ho_ten: 'Khách Vãng Lai A',
        so_dien_thoai: '0911111111',
        ngay_sinh: new Date('1995-02-01'),
        gioi_tinh: 'nam',
        dia_chi: 'Quận Bình Thạnh, TP.HCM',
        ghi_chu: 'Khách đến khám nội khoa lần đầu.',
        created_by: receptionist._id,
      },
      {
        ho_ten: 'Khách Vãng Lai B',
        so_dien_thoai: '0922222222',
        ngay_sinh: new Date('2000-08-15'),
        gioi_tinh: 'nu',
        dia_chi: 'Quận Gò Vấp, TP.HCM',
        ghi_chu: 'Khách khám da liễu.',
        created_by: receptionist._id,
      },
      {
        ho_ten: 'Khách Vãng Lai C',
        so_dien_thoai: '0933333333',
        ngay_sinh: new Date('1982-12-24'),
        gioi_tinh: 'khac',
        dia_chi: 'Quận 12, TP.HCM',
        ghi_chu: 'Khách tái khám TMH.',
        created_by: receptionist._id,
      },
    ])

    await NghiPhepBacSi.create([
      {
        bac_si_id: doctors[1]._id,
        tu_ngay: nextWeek,
        den_ngay: addDays(nextWeek, 2),
        ly_do: 'Tham gia hội thảo nhi khoa.',
        trang_thai: 'da_duyet',
        nguoi_duyet_id: admin._id,
        thoi_diem_duyet: new Date(),
        ghi_chu: 'Cho phép nghỉ phép 3 ngày.',
      },
      {
        bac_si_id: doctors[2]._id,
        tu_ngay: addDays(nextWeek, 4),
        den_ngay: addDays(nextWeek, 5),
        ly_do: 'Khám sức khỏe định kỳ.',
        trang_thai: 'cho_duyet',
        nguoi_duyet_id: null,
        thoi_diem_duyet: null,
        ghi_chu: 'Đang chờ admin phê duyệt.',
      },
    ])

    const schedules = await LichLamViec.create([
      {
        doctor_id: doctors[0]._id,
        chi_nhanh_id: clinic._id,
        ghi_chu_ngay: 'Ca s??ng da li???u.',
        trang_thai_ngay: 'lam_viec',
        ghi_chu_ngay: 'Ca sáng nội khoa.',
        slots: [
          { gio_bat_dau: '08:00', gio_ket_thuc: '08:30', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[0]), status: 'booked' },
          { gio_bat_dau: '08:30', gio_ket_thuc: '09:00', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[0]), status: 'booked' },
        ],
      },
      {
        doctor_id: doctors[1]._id,
        chi_nhanh_id: clinic._id,
        ngay: yesterday,
        trang_thai_ngay: 'lam_viec',
        ghi_chu_ngay: 'Ca khám nhi khoa.',
        slots: [
          { gio_bat_dau: '09:00', gio_ket_thuc: '09:30', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[2]), status: 'booked' },
          { gio_bat_dau: '09:30', gio_ket_thuc: '10:00', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[2]), status: 'active' },
        ],
      },
      {
        doctor_id: doctors[2]._id,
        chi_nhanh_id: clinic._id,
        ngay: today,
        trang_thai_ngay: 'lam_viec',
        ghi_chu_ngay: 'TMH có nội soi.',
        slots: [
          { gio_bat_dau: '10:00', gio_ket_thuc: '10:30', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[4]), status: 'booked' },
          { gio_bat_dau: '10:30', gio_ket_thuc: '11:00', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[4]), status: 'active' },
        ],
      },
      {
        doctor_id: doctors[0]._id,
        chi_nhanh_id: clinic._id,
        ghi_chu_ngay: 'Ca chi???u da li???u v?? theo d??i x??t nghi???m t???i nh??.',
        trang_thai_ngay: 'lam_viec',
        ghi_chu_ngay: 'Ca chiều nội khoa và theo dõi xét nghiệm tại nhà.',
        slots: [
          { gio_bat_dau: '13:30', gio_ket_thuc: '14:00', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[1]), status: 'booked' },
          { gio_bat_dau: '14:00', gio_ket_thuc: '14:30', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[1]), status: 'active' },
        ],
      },
      {
        doctor_id: doctors[2]._id,
        chi_nhanh_id: clinic._id,
        ngay: nextWeek,
        trang_thai_ngay: 'lam_viec',
        ghi_chu_ngay: 'Lịch khám TMH tuần tới.',
        slots: [
          { gio_bat_dau: '08:00', gio_ket_thuc: '08:30', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[4]), status: 'active' },
          { gio_bat_dau: '08:30', gio_ket_thuc: '09:00', specialty_id: specialties[0]._id, phong_kham: roomFullName(rooms[4]), status: 'active' },
        ],
      },
    ])

    const appointments = await LichHen.create([
      {
        user_id: patientA._id,
        member_id: members[0]._id,
        doctor_id: doctors[0]._id,
        schedule_id: schedules[0]._id,
        slot_id: schedules[0].slots[0]._id,
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        nguoi_tao_id: patientA._id,
        hinh_thuc_dat_lich: 'patient',
        ma_lich_hen: 'LH-DEMO-001',
        loai_kham: 'clinic',
        ngay_kham: twoDaysAgo,
        gio_kham: '08:00',
        gio_ket_thuc: '08:30',
        ly_do_kham: 'Đau đầu, mệt mỏi kéo dài.',
        phong_kham: roomFullName(rooms[0]),
        status: 'completed',
        payment_status: 'paid',
        gia_kham: 200000,
        ten_dich_vu: specialties[0].ten,
        thoi_diem_thanh_toan: new Date(),
        trang_thai_den: 'checked_in',
        gio_den_thuc_te: new Date(twoDaysAgo.getTime() + 7.5 * 60 * 60 * 1000),
        ten_khach: members[0].ho_ten,
        gioi_tinh_khach: 'male',
        so_dien_thoai_khach: patientA.so_dien_thoai,
        email_khach: patientA.email,
        nam_sinh_khach: 1990,
      },
      {
        user_id: patientB._id,
        member_id: members[3]._id,
        doctor_id: doctors[1]._id,
        schedule_id: schedules[1]._id,
        slot_id: schedules[1].slots[0]._id,
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        loai_benh_nhan: 'member',
        nguoi_tao_id: patientB._id,
        nguoi_dat_ho_id: patientB._id,
        dat_ho: true,
        hinh_thuc_dat_lich: 'patient',
        ma_lich_hen: 'LH-DEMO-002',
        loai_kham: 'clinic',
        ngay_kham: yesterday,
        gio_kham: '09:00',
        gio_ket_thuc: '09:30',
        ly_do_kham: 'Bé sốt cao, cần kiểm tra tổng quát.',
        phong_kham: roomFullName(rooms[2]),
        status: 'pending',
        payment_status: 'unpaid',
        gia_kham: 250000,
        ten_dich_vu: specialties[0].ten,
        ten_khach: members[3].ho_ten,
        gioi_tinh_khach: 'male',
        so_dien_thoai_khach: patientB.so_dien_thoai,
        email_khach: patientB.email,
        nam_sinh_khach: 2014,
        nguoi_dat_ho_ten: patientB.ho_ten,
        nguoi_dat_sdt: patientB.so_dien_thoai,
      },
      {
        user_id: null,
        member_id: null,
        doctor_id: doctors[2]._id,
        schedule_id: schedules[2]._id,
        slot_id: schedules[2].slots[1]._id,
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        khach_vang_lai_id: guestPatients[0]._id,
        loai_benh_nhan: 'guest',
        nguoi_tao_id: receptionist._id,
        hinh_thuc_dat_lich: 'receptionist',
        ma_lich_hen: 'LH-DEMO-003',
        loai_kham: 'clinic',
        ngay_kham: today,
        gio_kham: '10:30',
        gio_ket_thuc: '11:00',
        ly_do_kham: 'Ù tai và đau họng.',
        phong_kham: roomFullName(rooms[4]),
        status: 'cancelled',
        payment_status: 'refunded',
        gia_kham: 300000,
        ten_dich_vu: specialties[2].ten,
        ten_khach: guestPatients[0].ho_ten,
        gioi_tinh_khach: 'male',
        so_dien_thoai_khach: guestPatients[0].so_dien_thoai,
        ly_do_huy: 'Khách bận đột xuất.',
        huy_boi: 'user',
        nguoi_huy_id: receptionist._id,
        thoi_diem_huy: new Date(),
      },
      {
        user_id: patientC._id,
        member_id: members[4]._id,
        doctor_id: doctors[0]._id,
        schedule_id: schedules[3]._id,
        slot_id: schedules[3].slots[0]._id,
        service_id: services[0]._id,
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        loai_benh_nhan: 'member',
        nguoi_tao_id: receptionist._id,
        hinh_thuc_dat_lich: 'receptionist',
        ma_lich_hen: 'LH-DEMO-004',
        loai_kham: 'home',
        ngay_kham: tomorrow,
        gio_kham: '13:30',
        gio_ket_thuc: '14:00',
        ly_do_kham: 'Cần lấy mẫu máu tại nhà.',
        dia_chi_kham: '25 Phan Văn Trị, Gò Vấp, TP.HCM',
        status: 'confirmed',
        payment_status: 'partial',
        gia_kham: 180000,
        ten_dich_vu: services[0].ten,
        payment_deadline: addDays(today, 1),
        ten_khach: members[4].ho_ten,
        gioi_tinh_khach: 'male',
        so_dien_thoai_khach: patientC.so_dien_thoai,
        email_khach: patientC.email,
      },
      {
        user_id: patientA._id,
        member_id: members[1]._id,
        doctor_id: doctors[2]._id,
        schedule_id: schedules[2]._id,
        slot_id: schedules[2].slots[0]._id,
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        loai_benh_nhan: 'member',
        nguoi_tao_id: patientA._id,
        nguoi_dat_ho_id: patientA._id,
        dat_ho: true,
        hinh_thuc_dat_lich: 'patient',
        ma_lich_hen: 'LH-DEMO-005',
        loai_kham: 'clinic',
        ngay_kham: today,
        gio_kham: '10:00',
        gio_ket_thuc: '10:30',
        ly_do_kham: 'Bé ho kéo dài và nghẹt mũi.',
        phong_kham: roomFullName(rooms[4]),
        status: 'completed',
        payment_status: 'paid',
        gia_kham: 300000,
        ten_dich_vu: specialties[2].ten,
        thoi_diem_thanh_toan: new Date(),
        trang_thai_den: 'checked_in',
        ten_khach: members[1].ho_ten,
        gioi_tinh_khach: 'female',
        so_dien_thoai_khach: patientA.so_dien_thoai,
        email_khach: patientA.email,
        nam_sinh_khach: 2018,
        nguoi_dat_ho_ten: patientA.ho_ten,
        nguoi_dat_sdt: patientA.so_dien_thoai,
      },
    ])

    const invoices = await HoaDon.create([
      {
        appointment_id: appointments[0]._id,
        so_hoa_don: 'HD-DEMO-001',
        chi_nhanh_id: clinic._id,
        chi_tiet_thu_phi: [{ loai: 'phi_kham', ten: 'Ph?? kh??m da li???u', so_tien: 200000, thanh_tien: 200000 }],
        tong_tien_kham: 200000,
        chi_tiet_thu_phi: [{ loai: 'phi_kham', ten: 'Phí khám nội khoa', so_tien: 200000, thanh_tien: 200000 }],
        tong_tien_phat_sinh: 0,
        tong_thanh_toan: 200000,
        trang_thai_hoa_don: 'da_thanh_toan_du',
        ghi_chu_ke_toan: 'Đã thu đủ tại quầy.',
      },
      {
        appointment_id: appointments[1]._id,
        so_hoa_don: 'HD-DEMO-002',
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        tong_tien_kham: 250000,
        chi_tiet_thu_phi: [{ loai: 'phi_kham', ten: 'Phí khám nhi khoa', so_tien: 250000, thanh_tien: 250000 }],
        tong_tien_phat_sinh: 0,
        tong_thanh_toan: 250000,
        trang_thai_hoa_don: 'chua_thanh_toan',
        ghi_chu_ke_toan: 'Chờ khách hoàn tất thanh toán.',
      },
      {
        appointment_id: appointments[3]._id,
        so_hoa_don: 'HD-DEMO-003',
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        tong_tien_kham: 180000,
        chi_tiet_thu_phi: [{ loai: 'phi_kham', ten: 'Phí lấy mẫu tại nhà', so_tien: 180000, thanh_tien: 180000 }],
        tong_tien_phat_sinh: 0,
        tong_thanh_toan: 180000,
        trang_thai_hoa_don: 'da_dat_coc',
        ghi_chu_ke_toan: 'Đã thu một phần.',
      },
      {
        appointment_id: appointments[4]._id,
        so_hoa_don: 'HD-DEMO-004',
        chi_nhanh_id: clinic._id,
        specialty_id: specialties[0]._id,
        tong_tien_kham: 300000,
        chi_tiet_thu_phi: [{ loai: 'phi_kham', ten: 'Phí khám Tai Mũi Họng', so_tien: 300000, thanh_tien: 300000 }],
        tong_tien_phat_sinh: 50000,
        tong_thanh_toan: 350000,
        trang_thai_hoa_don: 'da_thanh_toan_du',
        ghi_chu_ke_toan: 'Có phát sinh nội soi.',
      },
    ])

    const payments = await ThanhToan.create([
      {
        appointment_id: appointments[0]._id,
        hoa_don_id: invoices[0]._id,
        benh_nhan_id: patientA._id,
        ma_giao_dich: 'TXN1001',
        so_tien: 200000,
        loai_thanh_toan: 'phi_dat_lich',
        phuong_thuc: 'tien_mat',
        status: 'paid',
        ngay_thanh_toan: new Date(),
        nguoi_thu_id: receptionist._id,
      },
      {
        appointment_id: appointments[1]._id,
        hoa_don_id: invoices[1]._id,
        benh_nhan_id: patientB._id,
        ma_giao_dich: 'TXN1002',
        so_tien: 250000,
        loai_thanh_toan: 'phi_dat_lich',
        phuong_thuc: 'chuyen_khoan',
        status: 'pending',
        nguoi_thu_id: null,
      },
      {
        appointment_id: appointments[3]._id,
        hoa_don_id: invoices[2]._id,
        benh_nhan_id: patientC._id,
        ma_giao_dich: 'TXN1003',
        so_tien: 90000,
        loai_thanh_toan: 'dat_coc',
        phuong_thuc: 'vi_dien_tu',
        status: 'paid',
        ngay_thanh_toan: new Date(),
        nguoi_thu_id: receptionist._id,
      },
      {
        appointment_id: appointments[2]._id,
        hoa_don_id: null,
        benh_nhan_id: null,
        ma_giao_dich: 'TXN1004',
        so_tien: 300000,
        loai_thanh_toan: 'phi_dat_lich',
        phuong_thuc: 'chuyen_khoan',
        status: 'refunded',
        ngay_thanh_toan: new Date(),
        ngay_hoan_tien: new Date(),
        nguoi_thu_id: receptionist._id,
      },
    ])

    await HoanTien.create([
      {
        payment_id: payments[3]._id,
        appointment_id: appointments[2]._id,
        so_tien_hoan: 300000,
        so_tien_da_thu: 300000,
        phi_huy: 0,
        chinh_sach_hoan: 'Khách hủy trước giờ khám, hoàn đủ.',
        phan_tram_hoan: 100,
        ly_do: 'Khách bận đột xuất.',
        ly_do_hoan: 'Hoàn tiền do lịch bị hủy.',
        status: 'completed',
        xu_ly_boi: admin._id,
        nguoi_xu_ly_id: admin._id,
        nguoi_duyet_id: admin._id,
        phuong_thuc_hoan: 'chuyen_khoan',
        ngay_yeu_cau: new Date(),
        ngay_xu_ly: new Date(),
        thoi_diem_hoan_thanh: new Date(),
      },
      {
        payment_id: payments[2]._id,
        appointment_id: appointments[3]._id,
        so_tien_hoan: 45000,
        so_tien_da_thu: 90000,
        phi_huy: 10000,
        chinh_sach_hoan: 'Hoàn một phần tiền cọc.',
        phan_tram_hoan: 50,
        ly_do: 'Khách yêu cầu dời sang ngày khác.',
        ly_do_hoan: 'Hoàn cọc một phần do thay đổi kế hoạch khám.',
        status: 'pending',
        xu_ly_boi: null,
        nguoi_xu_ly_id: null,
        nguoi_duyet_id: null,
        phuong_thuc_hoan: 'vi_dien_tu',
        ngay_yeu_cau: new Date(),
      },
    ])

    const medicalRecords = await HoSoYTe.create([
      {
        member_id: members[0]._id,
        appointment_id: appointments[0]._id,
        ngay_kham: twoDaysAgo,
        ten_benh_vien: clinic.ten,
        ten_bac_si: doctorUserA.ho_ten,
        ly_do_kham: appointments[0].ly_do_kham,
        chan_doan: 'Rối loạn tiền đình nhẹ',
        ghi_chu: 'Theo dõi huyết áp tại nhà trong 1 tuần.',
        nguon: 'tu_kham',
      },
      {
        member_id: members[1]._id,
        appointment_id: appointments[4]._id,
        ngay_kham: today,
        ten_benh_vien: clinic.ten,
        ten_bac_si: doctorUserC.ho_ten,
        ly_do_kham: appointments[4].ly_do_kham,
        chan_doan: 'Viêm mũi họng cấp',
        ghi_chu: 'Nội soi mũi họng cho kết quả phù nề nhẹ.',
        nguon: 'tu_kham',
      },
      {
        member_id: members[5]._id,
        appointment_id: null,
        ngay_kham: addDays(today, -30),
        ten_benh_vien: 'Bệnh viện khác',
        ten_bac_si: 'BS Ngoài hệ thống',
        ly_do_kham: 'Khám da liễu định kỳ',
        chan_doan: 'Viêm da dị ứng',
        ghi_chu: 'Bệnh sử cũ do người dùng tự nhập.',
        nguon: 'thu_cong',
      },
    ])

    const examResults = await KetQuaKham.create([
      {
        appointment_id: appointments[0]._id,
        nguoi_nhap_id: nurse._id,
        bac_si_phu_trach_id: doctors[0]._id,
        nguoi_xac_nhan_id: doctorUserA._id,
        thoi_diem_xac_nhan: new Date(),
        chan_doan: 'Rối loạn tiền đình nhẹ',
        huong_dan_dieu_tri: 'Uống thuốc đúng giờ, ngủ đủ giấc và tái khám nếu chóng mặt kéo dài.',
        ghi_chu: 'Không ghi nhận dấu hiệu thần kinh khu trú.',
        ngay_tai_kham: addDays(today, 7),
        co_the_sua: false,
        dich_vu_phat_sinh: [{ ten: 'Đo huyết áp tư thế', gia: 50000 }],
        chi_dinh_tai_kham: true,
        da_dat_lich_tai_kham: false,
        da_gui_cho_benh_nhan: true,
        lich_su_sua: [{ nguoi_sua_id: doctorUserA._id, noi_dung: 'Hoàn tất chẩn đoán ban đầu.' }],
      },
      {
        appointment_id: appointments[4]._id,
        nguoi_nhap_id: nurse._id,
        bac_si_phu_trach_id: doctors[2]._id,
        nguoi_xac_nhan_id: doctorUserC._id,
        thoi_diem_xac_nhan: new Date(),
        chan_doan: 'Viêm mũi họng cấp',
        huong_dan_dieu_tri: 'Giữ ấm, súc họng nước muối và tái khám nếu sốt cao.',
        ghi_chu: 'Có hình ảnh nội soi lưu kèm.',
        ngay_tai_kham: addDays(today, 5),
        co_the_sua: true,
        dich_vu_phat_sinh: [{ ten: 'Nội soi TMH', gia: 50000 }],
        chi_dinh_tai_kham: true,
        da_dat_lich_tai_kham: true,
        da_gui_cho_benh_nhan: true,
        lich_su_sua: [{ nguoi_sua_id: doctorUserC._id, noi_dung: 'Bổ sung hình ảnh nội soi.' }],
      },
      {
        appointment_id: appointments[3]._id,
        nguoi_nhap_id: nurse._id,
        bac_si_phu_trach_id: doctors[0]._id,
        nguoi_xac_nhan_id: null,
        thoi_diem_xac_nhan: null,
        chan_doan: 'Theo dõi xét nghiệm tổng quát tại nhà',
        huong_dan_dieu_tri: 'Chờ kết quả xét nghiệm và phản hồi của bác sĩ.',
        ghi_chu: 'Lịch home đã đặt cọc một phần.',
        ngay_tai_kham: null,
        co_the_sua: true,
        dich_vu_phat_sinh: [],
        chi_dinh_tai_kham: false,
        da_dat_lich_tai_kham: false,
        da_gui_cho_benh_nhan: false,
        lich_su_sua: [{ nguoi_sua_id: nurse._id, noi_dung: 'Nhập kết quả sơ bộ.' }],
      },
    ])

    await KetQuaKhamTai.create([
      {
        appointment_id: appointments[4]._id,
        ket_qua_kham_id: examResults[1]._id,
        la_ket_qua_chinh: true,
        hinh_anh_noi_soi: [
          { url: 'https://example.com/tai-1.jpg', mo_ta: 'Màng nhĩ phải' },
          { url: 'https://example.com/tai-2.jpg', mo_ta: 'Màng nhĩ trái' },
        ],
      },
      {
        appointment_id: appointments[2]._id,
        ket_qua_kham_id: examResults[2]._id,
        la_ket_qua_chinh: false,
        hinh_anh_noi_soi: [{ url: 'https://example.com/tai-guest.jpg', mo_ta: 'Tai ngoài' }],
      },
    ])

    await KetQuaKhamMui.create([
      {
        appointment_id: appointments[4]._id,
        ket_qua_kham_id: examResults[1]._id,
        la_ket_qua_chinh: true,
        hinh_anh_noi_soi: [{ url: 'https://example.com/mui-1.jpg', mo_ta: 'Niêm mạc mũi phù nề nhẹ' }],
      },
      {
        appointment_id: appointments[2]._id,
        ket_qua_kham_id: examResults[2]._id,
        la_ket_qua_chinh: false,
        hinh_anh_noi_soi: [{ url: 'https://example.com/mui-guest.jpg', mo_ta: 'Mũi trái' }],
      },
    ])

    await KetQuaKhamHong.create([
      {
        appointment_id: appointments[4]._id,
        ket_qua_kham_id: examResults[1]._id,
        la_ket_qua_chinh: true,
        hinh_anh_noi_soi: [{ url: 'https://example.com/hong-1.jpg', mo_ta: 'Họng đỏ nhẹ' }],
      },
      {
        appointment_id: appointments[2]._id,
        ket_qua_kham_id: examResults[2]._id,
        la_ket_qua_chinh: false,
        hinh_anh_noi_soi: [{ url: 'https://example.com/hong-guest.jpg', mo_ta: 'Họng khách vãng lai' }],
      },
    ])

    await SinhHieuKham.create([
      {
        appointment_id: appointments[0]._id,
        member_id: members[0]._id,
        can_nang: 68,
        chieu_cao: 172,
        huyet_ap: '120/80',
        nhiet_do: 36.8,
        nhip_tim: 78,
        nguoi_do_id: nurse._id,
        thoi_diem_do: new Date(),
        co_the_sua: false,
        lich_su_cap_nhat: [{ nguoi_cap_nhat_id: nurse._id, noi_dung: 'Nhập sinh hiệu ban đầu.' }],
      },
      {
        appointment_id: appointments[4]._id,
        member_id: members[1]._id,
        can_nang: 22,
        chieu_cao: 118,
        huyet_ap: '100/65',
        nhiet_do: 37.4,
        nhip_tim: 95,
        nguoi_do_id: nurse._id,
        thoi_diem_do: new Date(),
        co_the_sua: true,
        lich_su_cap_nhat: [{ nguoi_cap_nhat_id: nurse._id, noi_dung: 'Đã đo lại nhiệt độ do bé sốt nhẹ.' }],
      },
      {
        appointment_id: appointments[3]._id,
        member_id: members[4]._id,
        can_nang: 70,
        chieu_cao: 175,
        huyet_ap: '118/76',
        nhiet_do: 36.7,
        nhip_tim: 80,
        nguoi_do_id: nurse._id,
        thoi_diem_do: new Date(),
        co_the_sua: true,
        lich_su_cap_nhat: [{ nguoi_cap_nhat_id: nurse._id, noi_dung: 'Sinh hiệu cho lịch home.' }],
      },
    ])

    const prescriptions = await DonThuoc.create([
      {
        ket_qua_kham_id: examResults[0]._id,
        medical_record_id: medicalRecords[0]._id,
        member_id: members[0]._id,
        doctor_id: doctors[0]._id,
        nguon: 'bac_si',
        ghi_chu: 'Uống thuốc sau ăn.',
        items: [
          {
            ten_thuoc: 'Betahistine 16mg',
            lieu_luong: '1 viên',
            tan_suat: '2 lần/ngày',
            gio_uong: ['08:00', '20:00'],
            ngay_bat_dau: today,
            ngay_ket_thuc: addDays(today, 5),
            ghi_chu: 'Không tự ý tăng liều.',
          },
          {
            ten_thuoc: 'Vitamin B1',
            lieu_luong: '1 viên',
            tan_suat: '1 lần/ngày',
            gio_uong: ['08:00'],
            ngay_bat_dau: today,
            ngay_ket_thuc: addDays(today, 10),
          },
        ],
      },
      {
        ket_qua_kham_id: examResults[1]._id,
        medical_record_id: medicalRecords[1]._id,
        member_id: members[1]._id,
        doctor_id: doctors[2]._id,
        nguon: 'bac_si',
        ghi_chu: 'Kết hợp súc họng nước muối.',
        items: [
          {
            ten_thuoc: 'Paracetamol 250mg',
            lieu_luong: '1 gói',
            tan_suat: 'Khi sốt trên 38.5',
            gio_uong: ['08:00', '14:00', '20:00'],
            ngay_bat_dau: today,
            ngay_ket_thuc: addDays(today, 3),
          },
        ],
      },
      {
        ket_qua_kham_id: examResults[2]._id,
        medical_record_id: null,
        member_id: members[4]._id,
        doctor_id: doctors[0]._id,
        nguon: 'bac_si',
        ghi_chu: 'Theo dõi khi có kết quả xét nghiệm đầy đủ.',
        items: [
          {
            ten_thuoc: 'Gói bổ sung điện giải',
            lieu_luong: '1 gói',
            tan_suat: '1 lần/ngày',
            gio_uong: ['09:00'],
            ngay_bat_dau: today,
            ngay_ket_thuc: addDays(today, 2),
          },
        ],
      },
    ])

    await NhacNho.create([
      {
        prescription_id: prescriptions[0]._id,
        prescription_item_id: prescriptions[0].items[0]._id,
        user_id: patientA._id,
        gio_nhac: addDays(new Date(), 0),
        status: 'pending',
      },
      {
        prescription_id: prescriptions[0]._id,
        prescription_item_id: prescriptions[0].items[1]._id,
        user_id: patientA._id,
        gio_nhac: addDays(new Date(), 1),
        status: 'pending',
      },
      {
        prescription_id: prescriptions[1]._id,
        prescription_item_id: prescriptions[1].items[0]._id,
        user_id: patientA._id,
        gio_nhac: addDays(new Date(), 0),
        status: 'sent',
        ngay_gui: new Date(),
      },
    ])

    await DanhGia.create([
      {
        appointment_id: appointments[0]._id,
        user_id: patientA._id,
        doctor_id: doctors[0]._id,
        so_sao: 5,
        noi_dung: 'Bác sĩ tư vấn rõ ràng, nhẹ nhàng và dễ hiểu.',
        status: 'visible',
      },
      {
        appointment_id: appointments[4]._id,
        user_id: patientA._id,
        doctor_id: doctors[2]._id,
        so_sao: 4,
        noi_dung: 'Khám kỹ, có nội soi và giải thích cụ thể cho phụ huynh.',
        status: 'visible',
      },
    ])

    await ThongBao.create([
      {
        user_id: patientA._id,
        tieu_de: 'Đã hoàn thành lịch khám',
        noi_dung: 'Bạn đã hoàn thành lịch khám nội khoa và có đơn thuốc mới.',
        loai: 'appointment',
        related_id: appointments[0]._id,
        related_type: 'appointment',
        da_doc: true,
        kenh_gui: 'in_app',
        da_gui: true,
        thoi_diem_gui: new Date(),
        thoi_diem_doc: new Date(),
        ngay_gui_du_kien: new Date(),
      },
      {
        user_id: patientB._id,
        tieu_de: 'Nhắc thanh toán lịch khám',
        noi_dung: 'Lịch khám của bé vẫn đang chờ thanh toán để xác nhận.',
        loai: 'payment',
        related_id: appointments[1]._id,
        related_type: 'appointment',
        da_doc: false,
        kenh_gui: 'email',
        da_gui: true,
        thoi_diem_gui: new Date(),
        ngay_gui_du_kien: new Date(),
      },
      {
        user_id: patientC._id,
        tieu_de: 'Đã ghi nhận tiền cọc',
        noi_dung: 'Lịch lấy mẫu xét nghiệm tại nhà đã ghi nhận cọc thành công.',
        loai: 'payment',
        related_id: appointments[3]._id,
        related_type: 'appointment',
        da_doc: false,
        kenh_gui: 'in_app',
        da_gui: true,
        thoi_diem_gui: new Date(),
        ngay_gui_du_kien: new Date(),
      },
    ])

    await ThongBaoHeThong.create([
      {
        tieu_de: 'Cập nhật lịch làm việc bác sĩ',
        noi_dung: 'Lịch làm việc tuần mới của bác sĩ đã được cập nhật.',
        url: '/doctor/schedule',
        doi_tuong: 'bac_si',
        tao_boi: admin._id,
        ngay_gui: new Date(),
        so_nguoi_nhan: 3,
        status: 'da_gui',
      },
      {
        tieu_de: 'Triển khai gói dịch vụ mới',
        noi_dung: 'Phòng khám vừa bổ sung một số gói dịch vụ theo chuyên khoa.',
        url: '/dich-vu',
        doi_tuong: 'benh_nhan',
        tao_boi: admin._id,
        ngay_gui: new Date(),
        so_nguoi_nhan: 3,
        status: 'da_gui',
      },
      {
        tieu_de: 'Thông báo vận hành nội bộ',
        noi_dung: 'Lễ tân và điều dưỡng lưu ý kiểm tra lịch đặt hộ trong ca trực hôm nay.',
        url: null,
        doi_tuong: 'tat_ca',
        tao_boi: admin._id,
        ngay_gui: new Date(),
        so_nguoi_nhan: 10,
        status: 'da_gui',
      },
    ])

    const chatSessions = await PhienChat.create([
      { user_id: patientA._id, ngay_bat_dau: new Date(), ngay_ket_thuc: null },
      { user_id: patientB._id, ngay_bat_dau: new Date(), ngay_ket_thuc: null },
    ])

    await TinNhanChat.create([
      {
        session_id: chatSessions[0]._id,
        vai_tro: 'user',
        noi_dung: 'Chào hệ thống, tôi muốn hỏi về lịch tái khám.',
        thoi_diem: new Date(),
      },
      {
        session_id: chatSessions[0]._id,
        vai_tro: 'ai',
        noi_dung: 'Bạn có thể xem lịch tái khám trong hồ sơ lịch hẹn hoặc hỏi trực tiếp lễ tân.',
        thoi_diem: new Date(),
      },
      {
        session_id: chatSessions[1]._id,
        vai_tro: 'user',
        noi_dung: 'Bé nhà tôi bị sốt, có thể đặt hộ lịch khám không?',
        thoi_diem: new Date(),
      },
      {
        session_id: chatSessions[1]._id,
        vai_tro: 'ai',
        noi_dung: 'Bạn có thể đặt hộ cho thành viên gia đình nếu tài khoản đã có hồ sơ thành viên.',
        thoi_diem: new Date(),
      },
    ])

    await LichSuLichHen.create([
      {
        appointment_id: appointments[0]._id,
        tu_trang_thai: null,
        den_trang_thai: 'pending',
        tu_payment_status: null,
        den_payment_status: 'unpaid',
        nguoi_thay_doi_id: patientA._id,
        kenh_thay_doi: 'patient',
        nguoi_thuc_hien_id: patientA._id,
        vai_tro: 'user',
        ly_do: 'Tạo lịch khám mới',
      },
      {
        appointment_id: appointments[0]._id,
        tu_trang_thai: 'pending',
        den_trang_thai: 'completed',
        tu_payment_status: 'unpaid',
        den_payment_status: 'paid',
        nguoi_thay_doi_id: doctorUserA._id,
        kenh_thay_doi: 'doctor',
        nguoi_thuc_hien_id: doctorUserA._id,
        vai_tro: 'doctor',
        ly_do: 'Hoàn tất khám',
      },
      {
        appointment_id: appointments[1]._id,
        tu_trang_thai: null,
        den_trang_thai: 'pending',
        tu_payment_status: null,
        den_payment_status: 'unpaid',
        nguoi_thay_doi_id: patientB._id,
        kenh_thay_doi: 'patient',
        nguoi_thuc_hien_id: patientB._id,
        vai_tro: 'user',
        ly_do: 'Đặt hộ cho con',
      },
      {
        appointment_id: appointments[2]._id,
        tu_trang_thai: 'pending',
        den_trang_thai: 'cancelled',
        tu_payment_status: 'paid',
        den_payment_status: 'refunded',
        nguoi_thay_doi_id: receptionist._id,
        kenh_thay_doi: 'receptionist',
        nguoi_thuc_hien_id: receptionist._id,
        vai_tro: 'admin',
        ly_do: 'Khách yêu cầu hủy lịch',
      },
      {
        appointment_id: appointments[3]._id,
        tu_trang_thai: null,
        den_trang_thai: 'confirmed',
        tu_payment_status: null,
        den_payment_status: 'partial',
        nguoi_thay_doi_id: receptionist._id,
        kenh_thay_doi: 'receptionist',
        nguoi_thuc_hien_id: receptionist._id,
        vai_tro: 'admin',
        ly_do: 'Lễ tân tạo lịch home và thu cọc',
      },
    ])

    await NhatKyThaoTac.create([
      {
        nguoi_thuc_hien_id: admin._id,
        vai_tro: 'admin',
        hanh_dong: 'CREATE_SERVICE',
        loai_doi_tuong: 'service',
        doi_tuong_id: services[6]._id,
        ly_do: 'Bổ sung gói dịch vụ TMH.',
        du_lieu_moi: { ten: services[6].ten, la_goi: true },
      },
      {
        nguoi_thuc_hien_id: admin._id,
        vai_tro: 'admin',
        hanh_dong: 'UPDATE_CLINIC_INFO',
        loai_doi_tuong: 'clinic_info',
        doi_tuong_id: clinic._id,
        ly_do: 'Cập nhật thông tin vận hành phòng khám.',
        du_lieu_moi: { gio_lam_viec: clinic.gio_lam_viec, so_dien_thoai: clinic.so_dien_thoai },
      },
      {
        nguoi_thuc_hien_id: doctorUserC._id,
        vai_tro: 'doctor',
        hanh_dong: 'UPDATE_EXAMINATION_RESULT',
        loai_doi_tuong: 'examination_result',
        doi_tuong_id: examResults[1]._id,
        ly_do: 'Bổ sung nội soi tai mũi họng.',
        du_lieu_moi: { chan_doan: examResults[1].chan_doan },
      },
      {
        nguoi_thuc_hien_id: null,
        vai_tro: 'system',
        hanh_dong: 'MARK_REMINDER_MISSED',
        loai_doi_tuong: 'reminder',
        doi_tuong_id: new mongoose.Types.ObjectId(),
        ly_do: 'Cron kiểm tra nhắc nhở quá hạn.',
        du_lieu_cu: { status: 'sent' },
        du_lieu_moi: { status: 'missed' },
      },
    ])

    await DatLaiMatKhau.create([
      {
        user_id: patientA._id,
        ma_otp: '123456',
        het_han: addDays(new Date(), 1),
        da_su_dung: false,
      },
      {
        user_id: patientB._id,
        ma_otp: '234567',
        het_han: addDays(new Date(), 1),
        da_su_dung: true,
      },
      {
        user_id: patientC._id,
        ma_otp: '345678',
        het_han: addDays(new Date(), 1),
        da_su_dung: false,
      },
    ])

    await Counter.bulkWrite([
      {
        updateOne: {
          filter: { key: 'dich_vu' },
          update: { $set: { seq: 8 } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { key: `ma_lich_hen_${isoDateOnly(today).replace(/-/g, '').slice(2)}` },
          update: { $set: { seq: 5 } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { key: `so_hoa_don_${isoDateOnly(today).replace(/-/g, '').slice(2)}` },
          update: { $set: { seq: 4 } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { key: 'seed_demo_batch' },
          update: { $set: { seq: 1 } },
          upsert: true,
        },
      },
    ])

    const summaryTargets = {
      NguoiDung,
      DatLaiMatKhau,
      ThongTinPhongKham,
      CauHinhPhongKham,
      ChuyenKhoa,
      DichVu,
      CaiDatThanhToan,
      GiaDinh,
      ThanhVien,
      KhachVangLai,
      BacSi,
      NghiPhepBacSi,
      HoSoChiTietBacSi,
      LichLamViec,
      PhongKham,
      LichHen,
      HoaDon,
      ThanhToan,
      HoanTien,
      HoSoYTe,
      KetQuaKham,
      KetQuaKhamTai,
      KetQuaKhamMui,
      KetQuaKhamHong,
      SinhHieuKham,
      DonThuoc,
      NhacNho,
      DanhGia,
      ThongBao,
      ThongBaoHeThong,
      PhienChat,
      TinNhanChat,
      LichSuLichHen,
      NhatKyThaoTac,
      Counter,
    }

    console.log('\n📊 Tóm tắt số lượng document sau seed:')
    for (const [name, model] of Object.entries(summaryTargets)) {
      const count = await model.countDocuments({})
      console.log(`- ${name}: ${count}`)
    }

    console.log('\n🎉 Seed dữ liệu mẫu hoàn tất cho toàn bộ collections trong domain hiện tại.')
    console.log('ℹ️  Các collection singleton/unique như ThongTinPhongKham và CauHinhPhongKham chỉ có 1 document theo đúng ràng buộc schema.')
  } catch (error) {
    console.error('❌ Lỗi seed dữ liệu:', error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Đã đóng kết nối database.')
  }
}

seedAll()

