import mongoose from 'mongoose'

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
    const doctorUserA = users[2]
    const doctorUserB = users[3]
    const doctorUserC = users[4]
    const patientA = users[5]
    const patientB = users[6]
    const patientC = users[7]

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
        ten: 'Nội soi Tai Mũi Họng Ống Mềm Không Đau',
        loai: 'related',
        gia: 250000,
        mo_ta_ngan: 'Kỹ thuật nội soi ống mềm thế hệ mới, không châm chít, không đau nhói.',
        mo_ta: 'Cho phép bác sĩ quan sát chi tiết toàn bộ niêm mạc tai, vòm họng và dải thanh quản với độ phân giải cao.',
        hinh_anh: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop&q=80',
        chuan_bi_truoc: 'Nhịn ăn 2 giờ trước khi nội soi nếu có tiền sử nhạy cảm vùng họng.',
        specialty_id: specialties[0]._id,
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Khám tổng quát nhi kết hợp Tai Mũi Họng',
        loai: 'related',
        gia: 280000,
        mo_ta_ngan: 'Gói kiểm tra toàn diện tai mũi họng dành riêng cho trẻ em.',
        mo_ta: 'Đánh giá nguy cơ viêm VA, viêm amidan phì đại và theo dõi sự phát triển thính giác trẻ nhỏ.',
        hinh_anh: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=80',
        chuan_bi_truoc: 'Cho trẻ nghỉ ngơi đầy đủ và ăn nhẹ trước khi đến khám.',
        specialty_id: specialties[0]._id,
        la_goi: true,
        doi_tuong_ap_dung: 'tre_em',
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Hút rửa làm sạch xoang mũi lâm sàng',
        loai: 'related',
        gia: 200000,
        mo_ta_ngan: 'Điều trị hỗ trợ viêm xoang, giải phóng mủ nhầy tức thì.',
        mo_ta: 'Quy trình rửa xoang chuyên sâu bằng dung dịch muối khoáng vô trùng và áp lực âm kiểm soát.',
        hinh_anh: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80',
        chuan_bi_truoc: 'Không xịt thuốc co mạch mũi ngay trước khi rửa.',
        specialty_id: specialties[0]._id,
        la_goi: true,
        doi_tuong_ap_dung: 'khong_gioi_han',
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Chăm sóc & Phục hồi thanh quản giọng nói',
        loai: 'related',
        gia: 320000,
        mo_ta_ngan: 'Đánh giá nốt xơ dây thanh và phục hồi giọng nói.',
        mo_ta: 'Dành cho giáo viên, ca sĩ, MC hoặc người sử dụng giọng nói cường độ cao liên tục.',
        hinh_anh: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80',
        chuan_bi_truoc: 'Hạn chế dùng nước đá lạnh và tránh gằn giọng trước khi khám.',
        specialty_id: specialties[0]._id,
        la_goi: true,
        doi_tuong_ap_dung: 'nguoi_lon',
        nguoi_tao_id: admin._id,
        status: 'active',
      },
      {
        ten: 'Tầm soát viêm mũi xoang dị ứng giao mùa',
        loai: 'related',
        gia: 450000,
        mo_ta_ngan: 'Gói tầm soát TMH toàn diện dành cho giai đoạn giao mùa.',
        mo_ta: 'Đánh giá triệu chứng viêm mũi xoang dị ứng, xét nghiệm phản ứng và lập phác đồ dự phòng.',
        hinh_anh: 'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=800&auto=format&fit=crop&q=80',
        chuan_bi_truoc: 'Tránh dùng thuốc chống dị ứng antihistamine 24h trước xét nghiệm.',
        specialty_id: specialties[1]._id,
        nguoi_tao_id: admin._id,
        la_goi: true,
        doi_tuong_ap_dung: 'khong_gioi_han',
        status: 'active',
      },
    ].filter((item) => item.loai !== 'home'))

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
        doctor_id: doctors[0]._id,
        chuc_danh: 'BSCKI',
        chuc_vu: 'Bac si Noi khoa',
        benh_ly_dieu_tri: ['Tang huyet ap', 'Roi loan tieu hoa', 'Tieu duong'],
        qua_trinh_cong_tac: [
          { noi_cong_tac: 'Benh vien Da khoa Tinh A', chuc_vu: 'Bac si dieu tri', tu_nam: 2014, den_nam: 2019 },
          { noi_cong_tac: 'VitaFamily', chuc_vu: 'Bac si Noi khoa', tu_nam: 2020, den_nam: null },
        ],
        qua_trinh_dao_tao: [
          { ten_bang: 'BSCKI Noi khoa', truong: 'DH Y Ha Noi', tu_nam: 2012, den_nam: 2014 },
        ],
        thanh_vien_hoi: ['Hoi Noi khoa Viet Nam'],
        giai_thuong: [{ ten: 'Bac si tan tam', nam: 2022 }],
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

  await mongoose.disconnect().catch(() => {})
}

seedAll().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
