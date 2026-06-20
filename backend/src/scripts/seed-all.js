import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import * as models from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ Lỗi: Chưa có MONGODB_URI trong file .env');
  process.exit(1);
}

async function seedAll() {
  try {
    console.log('⏳ Đang kết nối MongoDB Cloud...');
    await mongoose.connect(uri);
    console.log('✅ Kết nối thành công!');

    // Đã import models ở đầu file
    const {
      NguoiDung, ThongTinPhongKham, ChuyenKhoa, DichVu, CaiDatThanhToan,
      GiaDinh, ThanhVien, BacSi, LichLamViec, LichHen, ThanhToan, HoanTien,
      HoSoYTe, KetQuaKham, DonThuoc, NhacNho, DanhGia, ThongBao, PhienChat,
      TinNhanChat, LichSuLichHen, NhatKyThaoTac, DatLaiMatKhau, ThongBaoHeThong
    } = models;

    console.log('\n🗑️  Đang dọn dẹp dữ liệu cũ (Reset)...');
    for (const [name, model] of Object.entries(models)) {
      if (model && typeof model.deleteMany === 'function') {
        await model.deleteMany({});
      }
    }
    console.log('✅ Đã dọn dẹp toàn bộ dữ liệu cũ.');

    // Mật khẩu chung cho tất cả tài khoản
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('123456', salt);

    console.log('\n🌱 Đang chèn dữ liệu Mức 0 (Không phụ thuộc)...');
    
    // 1. Thông tin phòng khám
    const clinic = await ThongTinPhongKham.create({
      ma: 'MAIN',
      ten: 'Phòng khám đa khoa VitaFamily',
      dia_chi: 'Số 1, Đường Khỏe Mạnh, TP. Sức Khỏe',
      so_dien_thoai: '19001515',
      gio_lam_viec: 'Thứ 2 - Chủ Nhật: 08:00 - 20:00'
    });

    // 2. Cài đặt thanh toán
    await CaiDatThanhToan.create([
      { ten_cai_dat: 'hoan_tien_truoc_24h', gia_tri: '100', mo_ta: 'Hoàn 100% nếu hủy trước 24h' },
      { ten_cai_dat: 'hoan_tien_truoc_2h', gia_tri: '50', mo_ta: 'Hoàn 50% nếu hủy trước 2h' },
      { ten_cai_dat: 'khong_hoan_tien_sau_2h', gia_tri: '0', mo_ta: 'Không hoàn tiền nếu hủy sát giờ' }
    ]);

    // 3. Chuyên khoa
    const specializations = await ChuyenKhoa.create([
      { ten: 'Nội khoa', mo_ta: 'Khám các bệnh lý nội khoa chung', icon_url: 'https://example.com/noi-khoa.jpg' },
      { ten: 'Nhi khoa', mo_ta: 'Khám và điều trị cho trẻ em', icon_url: 'https://example.com/nhi-khoa.jpg' },
      { ten: 'Răng hàm mặt', mo_ta: 'Chăm sóc sức khỏe răng miệng', icon_url: 'https://example.com/rang-ham-mat.jpg' },
      { ten: 'Da liễu', mo_ta: 'Điều trị các bệnh về da', icon_url: 'https://example.com/da-lieu.jpg' }
    ]);

    // 4. Người dùng (Admin, Doctors, Users)
    const users = await NguoiDung.create([
      { ho_ten: 'Admin Tổng', email: 'admin@vitafamily.vn', mat_khau: passwordHash, so_dien_thoai: '0901000000', vai_tro: 'admin' },
      { ho_ten: 'BS. Trần Văn A', email: 'bacsi_a@vitafamily.vn', mat_khau: passwordHash, so_dien_thoai: '0901000001', vai_tro: 'doctor' },
      { ho_ten: 'BS. Nguyễn Thị B', email: 'bacsi_b@vitafamily.vn', mat_khau: passwordHash, so_dien_thoai: '0901000002', vai_tro: 'doctor' },
      { ho_ten: 'Bệnh nhân Lê C', email: 'benhnhan_c@gmail.com', mat_khau: passwordHash, so_dien_thoai: '0901000003', vai_tro: 'user' },
      { ho_ten: 'Bệnh nhân Phạm D', email: 'benhnhan_d@gmail.com', mat_khau: passwordHash, so_dien_thoai: '0901000004', vai_tro: 'user' }
    ]);

    const admin = users[0];
    const docUserA = users[1];
    const docUserB = users[2];
    const patientC = users[3];
    const patientD = users[4];

    console.log('🌱 Đang chèn dữ liệu Mức 1 (Phụ thuộc cấp 0)...');

    // 5. Dịch vụ (thuộc chuyên khoa)
    const services = [];
    const serviceData = [
      { ten: 'Khám tổng quát nội khoa', loai: 'clinic', specialty_id: specializations[0]._id, gia: 200000, thoi_gian_phut: 30 },
      { ten: 'Khám tổng quát nhi khoa', loai: 'clinic', specialty_id: specializations[1]._id, gia: 250000, thoi_gian_phut: 30 },
      { ten: 'Nhổ răng khôn', loai: 'clinic', specialty_id: specializations[2]._id, gia: 1000000, thoi_gian_phut: 60 },
      { ten: 'Khám mụn trứng cá', loai: 'clinic', specialty_id: specializations[3]._id, gia: 150000, thoi_gian_phut: 20 }
    ];
    for (const data of serviceData) {
      services.push(await DichVu.create(data));
    }

    // 6. Bác sĩ (liên kết User và Chuyên khoa)
    const doctors = await BacSi.create([
      { user_id: docUserA._id, specialties: [specializations[0]._id], services: [services[0]._id], so_nam_kinh_nghiem: 10, trang_thai_duyet: 'approved' },
      { user_id: docUserB._id, specialties: [specializations[1]._id], services: [services[1]._id], so_nam_kinh_nghiem: 5, trang_thai_duyet: 'approved' }
    ]);

    // 7. Gia đình (Của bệnh nhân)
    const families = await GiaDinh.create([
      { user_id: patientC._id, ten_nhom: 'Gia đình Lê C' },
      { user_id: patientD._id, ten_nhom: 'Gia đình Phạm D' }
    ]);

    console.log('🌱 Đang chèn dữ liệu Mức 2 (Phụ thuộc cấp 1)...');

    // 8. Thành viên gia đình
    const members = await ThanhVien.create([
      { family_id: families[0]._id, ho_ten: 'Lê C', ngay_sinh: new Date('1990-01-01'), gioi_tinh: 'nam', la_chu_ho: true },
      { family_id: families[0]._id, ho_ten: 'Trần Thị Vợ', ngay_sinh: new Date('1992-05-05'), gioi_tinh: 'nu', la_chu_ho: false },
      { family_id: families[1]._id, ho_ten: 'Phạm D', ngay_sinh: new Date('1985-10-10'), gioi_tinh: 'nam', la_chu_ho: true },
      { family_id: families[1]._id, ho_ten: 'Phạm Con', ngay_sinh: new Date('2015-08-08'), gioi_tinh: 'nam', la_chu_ho: false }
    ]);

    // 9. Lịch làm việc (Doctor Schedules) - cho hôm qua (để tạo được HoSoYTe đã khám)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dayStr = yesterday.toISOString().split('T')[0];

    const schedules = await LichLamViec.create([
      {
        doctor_id: doctors[0]._id,
        ngay: new Date(dayStr),
        slots: [
          { gio_bat_dau: '08:00', gio_ket_thuc: '08:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 1 },
          { gio_bat_dau: '08:30', gio_ket_thuc: '09:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0 }
        ]
      },
      {
        doctor_id: doctors[1]._id,
        ngay: new Date(dayStr),
        slots: [
          { gio_bat_dau: '14:00', gio_ket_thuc: '14:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 1 },
          { gio_bat_dau: '14:30', gio_ket_thuc: '15:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0 }
        ]
      }
    ]);

    console.log('🌱 Đang chèn dữ liệu Mức 3 (Lịch hẹn, Đánh giá)...');

    // 10. Lịch hẹn (Appointments)
    const appointments = await LichHen.create([
      {
        user_id: patientC._id, member_id: members[0]._id, doctor_id: doctors[0]._id,
        schedule_id: schedules[0]._id, slot_id: schedules[0].slots[0]._id, service_id: services[0]._id,
        loai_kham: 'clinic', ngay_kham: new Date(dayStr), gio_kham: '08:00',
        status: 'completed', payment_status: 'paid', gia_kham: 200000, ly_do_kham: 'Đau đầu'
      },
      {
        user_id: patientD._id, member_id: members[3]._id, doctor_id: doctors[1]._id,
        schedule_id: schedules[1]._id, slot_id: schedules[1].slots[0]._id, service_id: services[1]._id,
        loai_kham: 'clinic', ngay_kham: new Date(dayStr), gio_kham: '14:00',
        status: 'pending', payment_status: 'unpaid', gia_kham: 250000, ly_do_kham: 'Sốt cao'
      },
      {
        user_id: patientC._id, ten_khach: 'Khách vãng lai E', so_dien_thoai_khach: '0999999999',
        doctor_id: doctors[0]._id, schedule_id: schedules[0]._id, slot_id: schedules[0].slots[1]._id,
        loai_kham: 'clinic', ngay_kham: new Date(dayStr), gio_kham: '08:30',
        status: 'cancelled', payment_status: 'refunded', gia_kham: 200000, ly_do_huy: 'Bận đột xuất'
      }
    ]);

    // 11. Đánh giá (Reviews)
    await DanhGia.create([
      { user_id: patientC._id, doctor_id: doctors[0]._id, appointment_id: appointments[0]._id, so_sao: 5, binh_luan: 'Bác sĩ rất nhiệt tình.' }
    ]);

    console.log('🌱 Đang chèn dữ liệu Mức 4 (Y tế, Lịch sử, Thông báo)...');

    // 12. Thanh toán
    const payments = await ThanhToan.create([
      { appointment_id: appointments[0]._id, benh_nhan_id: patientC._id, so_tien: 200000, status: 'paid', ma_giao_dich: 'MOCK_TXN_001', ngay_thanh_toan: new Date() },
      { appointment_id: appointments[1]._id, benh_nhan_id: patientD._id, so_tien: 250000, status: 'pending' },
      { appointment_id: appointments[2]._id, benh_nhan_id: patientC._id, so_tien: 200000, status: 'refunded', ma_giao_dich: 'MOCK_TXN_003', ngay_thanh_toan: new Date() }
    ]);

    // 13. Hoàn tiền
    await HoanTien.create([
      { appointment_id: appointments[2]._id, payment_id: payments[2]._id, so_tien_hoan: 200000, phan_tram_hoan: 100, ly_do: 'Khách tự hủy trước 24h', status: 'completed', ngay_xu_ly: new Date() }
    ]);

    // 14. Hồ sơ y tế & Kết quả khám & Đơn thuốc (cho lịch 0)
    const medicalRecord = await HoSoYTe.create({
      member_id: members[0]._id, appointment_id: appointments[0]._id, bac_si_id: doctors[0]._id,
      ngay_kham: new Date(dayStr), chan_doan: 'Cảm cúm thông thường', nguon: 'tu_kham', file_dinh_kem: ['https://example.com/xquang.jpg']
    });

    await KetQuaKham.create({
      appointment_id: appointments[0]._id,
      chan_doan: 'Cảm cúm thông thường', huong_dan_dieu_tri: 'Uống nhiều nước, nghỉ ngơi', ghi_chu: 'Khám lại sau 3 ngày nếu không đỡ'
    });

    const donThuoc = await DonThuoc.create({
      medical_record_id: medicalRecord._id, member_id: members[0]._id, doctor_id: doctors[0]._id,
      nguon: 'bac_si', ghi_chu: 'Uống thuốc sau khi ăn no',
      items: [
        { ten_thuoc: 'Paracetamol 500mg', lieu_luong: '1 viên', tan_suat: '2 lần/ngày', gio_uong: ['08:00', '20:00'], ngay_bat_dau: new Date(), ngay_ket_thuc: new Date(Date.now() + 5*24*60*60*1000) },
        { ten_thuoc: 'Vitamin C', lieu_luong: '1 lọ', tan_suat: '1 lần/ngày', gio_uong: ['08:00'], ngay_bat_dau: new Date(), ngay_ket_thuc: new Date(Date.now() + 5*24*60*60*1000) }
      ]
    });

    // 15. Nhắc nhở (Reminders) - uống thuốc
    await NhacNho.create([
      { user_id: patientC._id, prescription_id: donThuoc._id, prescription_item_id: donThuoc.items[0]._id, gio_nhac: new Date() }
    ]);

    // 16. Thông báo
    await ThongBao.create([
      { user_id: patientC._id, tieu_de: 'Lịch khám thành công', noi_dung: 'Bạn đã hoàn tất lịch khám nội khoa.', loai: 'appointment' }
    ]);
    
    // 17. Thông báo hệ thống
    await ThongBaoHeThong.create([
      { tieu_de: 'Cập nhật hệ thống mới', noi_dung: 'Phòng khám VitaFamily vừa nâng cấp phần mềm quản lý.', tao_boi: admin._id, doi_tuong: 'tat_ca' }
    ]);

    // 18. Chat Sessions & Messages
    const chatSession = await PhienChat.create({ user_id: patientC._id });
    await TinNhanChat.create([
      { session_id: chatSession._id, vai_tro: 'user', noi_dung: 'Chào bác sĩ, tôi muốn hỏi về lịch làm việc' },
      { session_id: chatSession._id, vai_tro: 'ai', noi_dung: 'Chào bạn, phòng khám mở cửa từ 8:00 đến 20:00 hàng ngày ạ.' }
    ]);

    // 19. Lịch sử lịch hẹn
    await LichSuLichHen.create([
      { appointment_id: appointments[0]._id, tu_trang_thai: null, den_trang_thai: 'pending', vai_tro: 'user', nguoi_thuc_hien_id: patientC._id },
      { appointment_id: appointments[0]._id, tu_trang_thai: 'pending', den_trang_thai: 'confirmed', vai_tro: 'doctor', nguoi_thuc_hien_id: docUserA._id },
      { appointment_id: appointments[0]._id, tu_trang_thai: 'confirmed', den_trang_thai: 'completed', vai_tro: 'doctor', nguoi_thuc_hien_id: docUserA._id }
    ]);

    // 20. Nhật ký thao tác (Audit Log)
    await NhatKyThaoTac.create([
      { nguoi_thuc_hien_id: admin._id, vai_tro: 'admin', hanh_dong: 'CREATE_SERVICE', loai_doi_tuong: 'service', doi_tuong_id: services[0]._id }
    ]);

    // 21. Đặt lại mật khẩu (Mock token)
    await DatLaiMatKhau.create([
      { user_id: patientD._id, ma_otp: '123456', het_han: new Date(Date.now() + 15*60000) }
    ]);

    console.log('\n🎉 ĐÃ CHÈN THÀNH CÔNG DỮ LIỆU MẪU CHO 25 BẢNG!');

    
  } catch (error) {
    console.error('❌ Lỗi Seed Data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã đóng kết nối Database.');
    process.exit(0);
  }
}

seedAll();
