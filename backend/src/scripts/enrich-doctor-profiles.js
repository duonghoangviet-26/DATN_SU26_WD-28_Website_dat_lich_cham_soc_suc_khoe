import "../config/timezone.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { BacSi, HoSoChiTietBacSi } from "../models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ Thiếu MONGODB_URI trong backend/.env");
  process.exit(1);
}

async function enrichDoctorProfiles() {
  try {
    console.log("⏳ Đang kết nối CSDL MongoDB...");
    await mongoose.connect(uri);
    console.log("✅ Đã kết nối CSDL.");

    const doctors = await BacSi.find({}).populate("user_id");
    console.log(`🔍 Tìm thấy ${doctors.length} bác sĩ trong hệ thống.`);

    for (const doc of doctors) {
      const name = doc.user_id?.ho_ten || "Bác sĩ";
      console.log(`👉 Đang cập nhật hồ sơ chi tiết cho bác sĩ: ${name} (ID: ${doc._id})...`);

      // Cập nhật số năm kinh nghiệm = 9 cho bác sĩ theo yêu cầu
      doc.so_nam_kinh_nghiem = 9;
      doc.kinh_nghiem = "Hơn 9 năm kinh nghiệm công tác tại các Bệnh viện Tuyến Trung ương và Hệ thống Y tế VitaFamily.";
      doc.bang_cap = "Bác sĩ Chuyên khoa I";
      doc.tieu_su = `Bác sĩ ${name} có hơn 9 năm kinh nghiệm chuyên sâu trong khám, chẩn đoán lâm sàng và điều trị. Luôn cập nhật các phác đồ y khoa hiện đại, tận tâm mang lại hiệu quả điều trị cao nhất cho người bệnh.`;
      await doc.save();

      // Cập nhật / tạo mới HoSoChiTietBacSi
      const detailedProfileData = {
        doctor_id: doc._id,
        chuc_danh: "BSCKI",
        chuc_vu: "Bác sĩ Chuyên khoa",
        chuc_vu_hien_tai: "Bác sĩ Trưởng khoa Lâm sàng - Hệ thống Y tế VitaFamily",
        ma_cchn: `CCHN-00${Math.floor(1000 + Math.random() * 9000)}/BYT`,
        gioi_thieu_ngan: `Bác sĩ ${name} có hơn 9 năm kinh nghiệm thực chiến trong lĩnh vực chẩn đoán và điều trị chuyên sâu. Bác sĩ nổi tiếng với phương pháp tư vấn ân cần, thấu hiểu tâm lý bệnh nhân và ứng dụng phác đồ y khoa đạt chuẩn quốc tế.`,

        bang_cap_hoc_vi_tags: ["Bác sĩ Chuyên khoa I", "Thạc sĩ Y học", "Bác sĩ Đa khoa"],
        ngon_ngu: ["Tiếng Việt", "Tiếng Anh (IELTS Y khoa 7.5)"],
        the_manh_chuyen_mon: [
          "Khám và chẩn đoán lâm sàng chuyên sâu",
          "Điều trị nội khoa phác đồ chuẩn Bộ Y tế",
          "Ứng dụng kỹ thuật vi phẫu & nội soi hiện đại",
          "Tầm soát bệnh lý & tư vấn dự phòng sức khỏe toàn diện"
        ],
        benh_ly_dieu_tri: [
          "Viêm xoang & Viêm mũi dị ứng mạn tính",
          "Viêm Amidan & Viêm V.A ở trẻ em",
          "Khàn tiếng, Hạt xơ dây thanh & Bệnh lý thanh quản",
          "Viêm tai giữa mủ & Giảm thính lực",
          "Rối loạn giấc ngủ & Viêm họng mạn"
        ],
        qua_trinh_dao_tao: [
          {
            ten_bang: "Bác sĩ Đa khoa",
            truong: "Đại học Y Dược TP.HCM",
            tu_nam: 2011,
            den_nam: 2017
          },
          {
            ten_bang: "Bác sĩ Chuyên khoa I",
            truong: "Đại học Y Hà Nội",
            tu_nam: 2018,
            den_nam: 2020
          }
        ],
        qua_trinh_cong_tac: [
          {
            chuc_vu: "Bác sĩ Nội trú & Khám điều trị",
            noi_cong_tac: "Bệnh viện Chợ Rẫy / Bệnh viện Bạch Mai",
            tu_nam: 2017,
            den_nam: 2020
          },
          {
            chuc_vu: "Bác sĩ Chuyên khoa",
            noi_cong_tac: "Bệnh viện Đa khoa Quốc tế Vinmec",
            tu_nam: 2020,
            den_nam: 2023
          },
          {
            chuc_vu: "Bác sĩ Trưởng khoa Lâm sàng",
            noi_cong_tac: "Hệ thống Y tế VitaFamily",
            tu_nam: 2023,
            den_nam: null
          }
        ],
        thanh_vien_hoi: ["Hội Y học Việt Nam", "Hội Chuyên khoa Lâm sàng Toàn quốc"],
        giai_thuong: [
          {
            ten: "Ghi nhận Thầy thuốc Tiêu biểu xuất sắc",
            nam: 2022
          },
          {
            ten: "Bằng khen Báo cáo khoa học Y học xuất sắc",
            nam: 2024
          }
        ]
      };

      await HoSoChiTietBacSi.findOneAndUpdate(
        { doctor_id: doc._id },
        { $set: detailedProfileData },
        { upsert: true, new: true }
      );

      console.log(`✅ Cập nhật thành công cho bác sĩ: ${name}!`);
    }

    console.log("🎉 Tất cả hồ sơ bác sĩ đã được cập nhật chuẩn 9 năm kinh nghiệm và đầy đủ chi tiết!");
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật hồ sơ bác sĩ:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối CSDL.");
  }
}

enrichDoctorProfiles();
