import bcrypt from 'bcryptjs'
import { addDays, fixedObjectId, formatDateParts, startOfDay } from './_shared.js'

function hhmmPlusMinutes(hhmm, minutesToAdd) {
  const [hour, minute] = hhmm.split(':').map(Number)
  const total = hour * 60 + minute + minutesToAdd
  const nextHour = String(Math.floor(total / 60)).padStart(2, '0')
  const nextMinute = String(total % 60).padStart(2, '0')
  return `${nextHour}:${nextMinute}`
}

function makeDateTime(baseDate, hhmm) {
  const [hour, minute] = hhmm.split(':').map(Number)
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hour,
    minute,
    0,
    0
  )
}

function buildTimeline() {
  const today = startOfDay(new Date())
  return {
    day0: addDays(today, -1),
    day1: addDays(today, 0),
    day2: addDays(today, 1),
    day3: addDays(today, 2),
    day4: addDays(today, 3),
    day5: addDays(today, 4),
    day6: addDays(today, 5),
  }
}

function buildIdMap() {
  return {
    clinicConfig: fixedObjectId(100),
    branches: {
      cauGiay: fixedObjectId(101),
      haDong: fixedObjectId(102),
    },
    specialties: {
      tai: fixedObjectId(201),
      mui: fixedObjectId(202),
      hong: fixedObjectId(203),
      tmh: fixedObjectId(204),
    },
    services: {
      homeTai: fixedObjectId(301),
      relatedMui: fixedObjectId(302),
      relatedHong: fixedObjectId(303),
      relatedTmh: fixedObjectId(304),
    },
    users: {
      admin: fixedObjectId(401),
      receptionist: fixedObjectId(402),
      nurse: fixedObjectId(403),
      doctorTai: fixedObjectId(404),
      doctorMui: fixedObjectId(405),
      doctorHong: fixedObjectId(406),
      patient1: fixedObjectId(407),
      patient2: fixedObjectId(408),
      patient3: fixedObjectId(409),
      patient4: fixedObjectId(410),
      patient5: fixedObjectId(411),
    },
    families: {
      patient1: fixedObjectId(501),
      patient2: fixedObjectId(502),
      patient3: fixedObjectId(503),
      patient4: fixedObjectId(504),
      patient5: fixedObjectId(505),
    },
    members: {
      patient1Self: fixedObjectId(601),
      patient1Child: fixedObjectId(602),
      patient2Self: fixedObjectId(603),
      patient3Self: fixedObjectId(604),
      patient4Self: fixedObjectId(605),
      patient5Self: fixedObjectId(606),
    },
    doctors: {
      tai: fixedObjectId(701),
      mui: fixedObjectId(702),
      hong: fixedObjectId(703),
    },
    guests: {
      callCenter: fixedObjectId(801),
      walkIn: fixedObjectId(802),
    },
    leaves: {
      pending: fixedObjectId(901),
      approved: fixedObjectId(902),
    },
  }
}

function buildSchedules(ids, timeline) {
  const doctorConfigs = [
    { doctorId: ids.doctors.tai, branchId: ids.branches.cauGiay, specialtyId: ids.specialties.tai },
    { doctorId: ids.doctors.mui, branchId: ids.branches.haDong, specialtyId: ids.specialties.mui },
    { doctorId: ids.doctors.hong, branchId: ids.branches.cauGiay, specialtyId: ids.specialties.hong },
  ]

  const days = [
    timeline.day0,
    timeline.day1,
    timeline.day2,
    timeline.day3,
    timeline.day4,
    timeline.day5,
    timeline.day6,
  ]

  const slotStarts = ['08:00', '08:30', '09:00', '09:30']
  const schedules = []
  const scheduleLookup = new Map()
  const slotLookup = new Map()

  doctorConfigs.forEach((config, doctorIndex) => {
    days.forEach((day, dayIndex) => {
      const scheduleId = fixedObjectId(1000 + doctorIndex * 100 + dayIndex)
      const key = `d${doctorIndex}-day${dayIndex}`
      const slots = slotStarts.map((start, slotIndex) => {
        const slotId = fixedObjectId(10000 + doctorIndex * 1000 + dayIndex * 100 + slotIndex)
        const slot = {
          _id: slotId,
          gio_bat_dau: start,
          gio_ket_thuc: hhmmPlusMinutes(start, 30),
          specialty_id: config.specialtyId,
          phong_kham: doctorIndex === 0 ? 'Phong 101' : doctorIndex === 1 ? 'Phong 202' : 'Phong 305',
          status: 'active',
          benh_nhan_id: null,
          benh_nhan_tam_giu_id: null,
          pending_expired_at: null,
          bi_khoa_boi_nghi_phep: false,
          nghi_phep_id: null,
          lock_expires_at: null,
          cancel_requested: false,
          cancel_reason: null,
        }

        slotLookup.set(`${key}-slot${slotIndex}`, {
          scheduleId,
          slotId,
          day,
          doctorId: config.doctorId,
          branchId: config.branchId,
          specialtyId: config.specialtyId,
          start,
          end: slot.gio_ket_thuc,
        })

        return slot
      })

      schedules.push({
        _id: scheduleId,
        doctor_id: config.doctorId,
        chi_nhanh_id: config.branchId,
        ngay: day,
        slots,
      })

      scheduleLookup.set(key, schedules[schedules.length - 1])
    })
  })

  return { schedules, scheduleLookup, slotLookup }
}

function assignSlotStatus(scheduleLookup, slotLookup, slotKey, patch) {
  const slotMeta = slotLookup.get(slotKey)
  const scheduleKey = slotKey.split('-slot')[0]
  const schedule = scheduleLookup.get(scheduleKey)
  const slot = schedule.slots.find((entry) => entry._id.toString() === slotMeta.slotId.toString())
  Object.assign(slot, patch)
}

function buildAppointmentPlans(ids) {
  return [
    {
      id: fixedObjectId(1101),
      codeNo: 1,
      slotKey: 'd0-day2-slot0',
      userId: ids.users.patient1,
      memberId: ids.members.patient1Self,
      creatorId: ids.users.patient1,
      patientType: 'thanh_vien',
      status: 'pending',
      paymentStatus: 'unpaid',
      hinhThucDatLich: 'online',
      lyDoKham: 'Dau tai khi ngu day',
      trangThaiDen: 'chua_den',
    },
    {
      id: fixedObjectId(1102),
      codeNo: 2,
      slotKey: 'd1-day2-slot0',
      userId: ids.users.patient2,
      memberId: ids.members.patient2Self,
      creatorId: ids.users.receptionist,
      patientType: 'thanh_vien',
      status: 'confirmed',
      paymentStatus: 'partial',
      hinhThucDatLich: 'phone',
      lyDoKham: 'Nghet mui keo dai',
      trangThaiDen: 'chua_den',
    },
    {
      id: fixedObjectId(1103),
      codeNo: 3,
      slotKey: 'd2-day3-slot0',
      guestId: ids.guests.callCenter,
      creatorId: ids.users.receptionist,
      patientType: 'khach_vang_lai',
      status: 'confirmed',
      paymentStatus: 'partial',
      hinhThucDatLich: 'call_center',
      lyDoKham: 'Khan tieng va rat hong',
      trangThaiDen: 'chua_den',
      tenKhach: 'Pham Minh Call',
      soDienThoaiKhach: '0988000001',
      gioiTinhKhach: 'male',
      namSinhKhach: 1991,
      diaChiKhach: 'Cau Giay, Ha Noi',
    },
    {
      id: fixedObjectId(1104),
      codeNo: 4,
      slotKey: 'd0-day1-slot1',
      userId: ids.users.patient3,
      memberId: ids.members.patient3Self,
      creatorId: ids.users.patient3,
      patientType: 'thanh_vien',
      status: 'checked_in',
      paymentStatus: 'unpaid',
      hinhThucDatLich: 'online',
      lyDoKham: 'U tai va nghe kem',
      trangThaiDen: 'da_den',
    },
    {
      id: fixedObjectId(1105),
      codeNo: 5,
      slotKey: 'd1-day1-slot1',
      userId: ids.users.patient1,
      memberId: ids.members.patient1Child,
      creatorId: ids.users.receptionist,
      bookerId: ids.users.patient1,
      patientType: 'thanh_vien',
      status: 'checked_in',
      paymentStatus: 'unpaid',
      datHo: true,
      hinhThucDatLich: 'admin',
      loaiLichHen: 'tai_kham',
      lyDoKham: 'Tre ho va so mui',
      trangThaiDen: 'da_den',
    },
    {
      id: fixedObjectId(1106),
      codeNo: 6,
      slotKey: 'd2-day1-slot1',
      userId: ids.users.patient4,
      memberId: ids.members.patient4Self,
      creatorId: ids.users.nurse,
      patientType: 'thanh_vien',
      status: 'in_progress',
      paymentStatus: 'unpaid',
      hinhThucDatLich: 'admin',
      lyDoKham: 'Dau hong va kho nuot',
      trangThaiDen: 'da_den',
    },
    {
      id: fixedObjectId(1107),
      codeNo: 7,
      slotKey: 'd0-day1-slot2',
      guestId: ids.guests.walkIn,
      creatorId: ids.users.receptionist,
      patientType: 'khach_vang_lai',
      status: 'in_progress',
      paymentStatus: 'unpaid',
      hinhThucDatLich: 'walk_in',
      lyDoKham: 'Dau tai cap tinh',
      trangThaiDen: 'da_den',
      tenKhach: 'Doan Thu Walkin',
      soDienThoaiKhach: '0988000002',
      gioiTinhKhach: 'female',
      namSinhKhach: 1988,
      diaChiKhach: 'Ha Dong, Ha Noi',
    },
    {
      id: fixedObjectId(1108),
      codeNo: 8,
      slotKey: 'd0-day0-slot3',
      userId: ids.users.patient1,
      memberId: ids.members.patient1Self,
      creatorId: ids.users.patient1,
      patientType: 'thanh_vien',
      status: 'completed',
      paymentStatus: 'paid',
      hinhThucDatLich: 'online',
      lyDoKham: 'Tai bi ù keo dai',
      trangThaiDen: 'da_den',
    },
    {
      id: fixedObjectId(1109),
      codeNo: 9,
      slotKey: 'd1-day0-slot2',
      userId: ids.users.patient2,
      memberId: ids.members.patient2Self,
      creatorId: ids.users.patient2,
      patientType: 'thanh_vien',
      status: 'completed',
      paymentStatus: 'paid',
      hinhThucDatLich: 'online',
      lyDoKham: 'Viem mui di ung',
      trangThaiDen: 'da_den',
    },
    {
      id: fixedObjectId(1110),
      codeNo: 10,
      slotKey: 'd2-day0-slot2',
      userId: ids.users.patient5,
      memberId: ids.members.patient5Self,
      creatorId: ids.users.receptionist,
      patientType: 'thanh_vien',
      status: 'completed',
      paymentStatus: 'paid',
      hinhThucDatLich: 'phone',
      lyDoKham: 'Viem hong cap',
      trangThaiDen: 'da_den',
    },
    {
      id: fixedObjectId(1111),
      codeNo: 11,
      slotKey: 'd0-day3-slot3',
      userId: ids.users.patient4,
      memberId: ids.members.patient4Self,
      creatorId: ids.users.patient4,
      patientType: 'thanh_vien',
      status: 'cancelled',
      paymentStatus: 'refunded',
      hinhThucDatLich: 'online',
      lyDoKham: 'Tai nong va ngua',
      trangThaiDen: 'chua_den',
    },
    {
      id: fixedObjectId(1112),
      codeNo: 12,
      slotKey: 'd1-day0-slot3',
      userId: ids.users.patient3,
      memberId: ids.members.patient3Self,
      creatorId: ids.users.patient3,
      patientType: 'thanh_vien',
      status: 'no_show',
      paymentStatus: 'unpaid',
      hinhThucDatLich: 'online',
      lyDoKham: 'Dau xoang va chay mui',
      trangThaiDen: 'vang_mat',
    },
  ]
}

function buildInvoicePlans() {
  return {
    [fixedObjectId(1102).toString()]: { total: 180000, feeLines: [] },
    [fixedObjectId(1103).toString()]: { total: 220000, feeLines: [] },
    [fixedObjectId(1108).toString()]: {
      total: 250000,
      feeLines: [{ loai: 'dich_vu', ten: 'Noi soi tai', so_tien: 50000, so_luong: 1, thanh_tien: 50000 }],
    },
    [fixedObjectId(1109).toString()]: {
      total: 220000,
      feeLines: [{ loai: 'thu_thuat', ten: 'Rua mui', so_tien: 40000, so_luong: 1, thanh_tien: 40000 }],
    },
    [fixedObjectId(1110).toString()]: {
      total: 200000,
      feeLines: [{ loai: 'giam_tru_bao_hiem', ten: 'Giam tru bao hiem', so_tien: 20000, so_luong: 1, thanh_tien: 20000 }],
    },
  }
}

export async function buildDemoDataset() {
  const ids = buildIdMap()
  const timeline = buildTimeline()
  const passwordHash = await bcrypt.hash('123456', 10)
  const { schedules, scheduleLookup, slotLookup } = buildSchedules(ids, timeline)
  const appointmentPlans = buildAppointmentPlans(ids)
  const invoicePlans = buildInvoicePlans()

  assignSlotStatus(scheduleLookup, slotLookup, 'd0-day2-slot0', {
    status: 'pending_payment',
    benh_nhan_tam_giu_id: ids.users.patient1,
    pending_expired_at: addDays(makeDateTime(timeline.day2, '08:00'), 0),
  })
  assignSlotStatus(scheduleLookup, slotLookup, 'd1-day4-slot3', {
    status: 'locked',
    bi_khoa_boi_nghi_phep: true,
    nghi_phep_id: ids.leaves.approved,
  })
  assignSlotStatus(scheduleLookup, slotLookup, 'd2-day5-slot2', {
    status: 'cancelled',
    cancel_requested: true,
    cancel_reason: 'Bac si nghi phep',
  })

  const branches = [
    {
      _id: ids.branches.cauGiay,
      ten: 'VitaFamily Cau Giay',
      trang_thai: 'active',
      dia_chi: '12 Tran Thai Tong, Cau Giay, Ha Noi',
      so_dien_thoai: '02473001111',
      email: 'caugiay@vitafamily.demo',
      gio_lam_viec: '08:00-17:30 T2-T7',
      mo_ta: 'Chi nhanh demo khu vuc Cau Giay',
      logo_url: null,
      ban_do_url: null,
      bao_hiem: { nha_nuoc: true, bao_lanh: true },
    },
    {
      _id: ids.branches.haDong,
      ten: 'VitaFamily Ha Dong',
      trang_thai: 'active',
      dia_chi: '88 Quang Trung, Ha Dong, Ha Noi',
      so_dien_thoai: '02473002222',
      email: 'hadong@vitafamily.demo',
      gio_lam_viec: '08:00-17:30 T2-T7',
      mo_ta: 'Chi nhanh demo khu vuc Ha Dong',
      logo_url: null,
      ban_do_url: null,
      bao_hiem: { nha_nuoc: true, bao_lanh: false },
    },
  ]

  const specialties = [
    { _id: ids.specialties.tai, phong_kham_id: ids.branches.cauGiay, ten: 'Tai', mo_ta: 'Kham va dieu tri benh ve tai', slug: 'tai', thu_tu: 1, status: 'active' },
    { _id: ids.specialties.mui, phong_kham_id: ids.branches.haDong, ten: 'Mui', mo_ta: 'Kham va dieu tri benh ve mui', slug: 'mui', thu_tu: 2, status: 'active' },
    { _id: ids.specialties.hong, phong_kham_id: ids.branches.cauGiay, ten: 'Hong', mo_ta: 'Kham va dieu tri benh ve hong', slug: 'hong', thu_tu: 3, status: 'active' },
    { _id: ids.specialties.tmh, phong_kham_id: ids.branches.cauGiay, ten: 'Tai Mui Hong tong quat', mo_ta: 'Kham tong quat tai mui hong', slug: 'tai-mui-hong-tong-quat', thu_tu: 4, status: 'active' },
  ]

  const users = [
    { _id: ids.users.admin, email: 'admin.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Admin Demo', so_dien_thoai: '0901000001', role: 'admin', status: 'active' },
    { _id: ids.users.receptionist, email: 'reception.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Le Tan Demo', so_dien_thoai: '0901000002', role: 'receptionist', status: 'active' },
    { _id: ids.users.nurse, email: 'nurse.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Dieu Duong Demo', so_dien_thoai: '0901000003', role: 'nurse', status: 'active' },
    { _id: ids.users.doctorTai, email: 'doctor.tai@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'BS Tai Demo', so_dien_thoai: '0901000004', role: 'doctor', status: 'active' },
    { _id: ids.users.doctorMui, email: 'doctor.mui@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'BS Mui Demo', so_dien_thoai: '0901000005', role: 'doctor', status: 'active' },
    { _id: ids.users.doctorHong, email: 'doctor.hong@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'BS Hong Demo', so_dien_thoai: '0901000006', role: 'doctor', status: 'active' },
    { _id: ids.users.patient1, email: 'patient01.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Nguyen Minh An', so_dien_thoai: '0901000007', role: 'patient', status: 'active' },
    { _id: ids.users.patient2, email: 'patient02.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Tran Thu Ha', so_dien_thoai: '0901000008', role: 'patient', status: 'active' },
    { _id: ids.users.patient3, email: 'patient03.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Pham Quang Huy', so_dien_thoai: '0901000009', role: 'patient', status: 'active' },
    { _id: ids.users.patient4, email: 'patient04.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Le My Linh', so_dien_thoai: '0901000010', role: 'patient', status: 'active' },
    { _id: ids.users.patient5, email: 'patient05.demo@vitafamily.vn', mat_khau: passwordHash, ho_ten: 'Doan Gia Bao', so_dien_thoai: '0901000011', role: 'patient', status: 'active' },
  ]

  const families = [
    { _id: ids.families.patient1, user_id: ids.users.patient1, ten_nhom: 'Gia dinh Nguyen Minh An' },
    { _id: ids.families.patient2, user_id: ids.users.patient2, ten_nhom: 'Gia dinh Tran Thu Ha' },
    { _id: ids.families.patient3, user_id: ids.users.patient3, ten_nhom: 'Gia dinh Pham Quang Huy' },
    { _id: ids.families.patient4, user_id: ids.users.patient4, ten_nhom: 'Gia dinh Le My Linh' },
    { _id: ids.families.patient5, user_id: ids.users.patient5, ten_nhom: 'Gia dinh Doan Gia Bao' },
  ]

  const members = [
    { _id: ids.members.patient1Self, family_id: ids.families.patient1, tai_khoan_id: ids.users.patient1, ho_ten: 'Nguyen Minh An', ngay_sinh: new Date('1993-04-12'), gioi_tinh: 'nam', quan_he: 'ban_than', la_chu_ho: true },
    { _id: ids.members.patient1Child, family_id: ids.families.patient1, tai_khoan_id: null, ho_ten: 'Nguyen Bao Chau', ngay_sinh: new Date('2018-10-09'), gioi_tinh: 'nu', quan_he: 'con', la_chu_ho: false },
    { _id: ids.members.patient2Self, family_id: ids.families.patient2, tai_khoan_id: ids.users.patient2, ho_ten: 'Tran Thu Ha', ngay_sinh: new Date('1990-06-21'), gioi_tinh: 'nu', quan_he: 'ban_than', la_chu_ho: true },
    { _id: ids.members.patient3Self, family_id: ids.families.patient3, tai_khoan_id: ids.users.patient3, ho_ten: 'Pham Quang Huy', ngay_sinh: new Date('1988-03-17'), gioi_tinh: 'nam', quan_he: 'ban_than', la_chu_ho: true },
    { _id: ids.members.patient4Self, family_id: ids.families.patient4, tai_khoan_id: ids.users.patient4, ho_ten: 'Le My Linh', ngay_sinh: new Date('1995-12-03'), gioi_tinh: 'nu', quan_he: 'ban_than', la_chu_ho: true },
    { _id: ids.members.patient5Self, family_id: ids.families.patient5, tai_khoan_id: ids.users.patient5, ho_ten: 'Doan Gia Bao', ngay_sinh: new Date('1986-08-14'), gioi_tinh: 'nam', quan_he: 'ban_than', la_chu_ho: true },
  ]

  const doctors = [
    {
      _id: ids.doctors.tai,
      user_id: ids.users.doctorTai,
      chi_nhanh_id: ids.branches.cauGiay,
      tieu_su: 'Bac si chuyen khoa Tai demo',
      bang_cap: 'CKI Tai Mui Hong',
      kinh_nghiem: '8 nam kham Tai',
      so_nam_kinh_nghiem: 8,
      gia_kham: 200000,
      phi_kham: 200000,
      tuoi_nhan_kham_tu: 5,
      trang_thai_duyet: 'approved',
      trang_thai: 'active',
      so_lan_nop: 1,
      la_hien: true,
      diem_danh_gia: 4.8,
      tong_danh_gia: 120,
      phong_kham_mac_dinh: 'Phong 101',
      specialties: [ids.specialties.tai, ids.specialties.tmh],
      services: [ids.services.relatedTmh],
      related_services: [ids.services.relatedTmh],
      bao_hiem: { nha_nuoc: true, bao_lanh: true },
      loai: 'specialist',
    },
    {
      _id: ids.doctors.mui,
      user_id: ids.users.doctorMui,
      chi_nhanh_id: ids.branches.haDong,
      tieu_su: 'Bac si chuyen khoa Mui demo',
      bang_cap: 'ThS Y khoa',
      kinh_nghiem: '6 nam kham Mui',
      so_nam_kinh_nghiem: 6,
      gia_kham: 180000,
      phi_kham: 180000,
      tuoi_nhan_kham_tu: 5,
      trang_thai_duyet: 'approved',
      trang_thai: 'active',
      so_lan_nop: 1,
      la_hien: true,
      diem_danh_gia: 4.7,
      tong_danh_gia: 96,
      phong_kham_mac_dinh: 'Phong 202',
      specialties: [ids.specialties.mui, ids.specialties.tmh],
      services: [ids.services.relatedMui],
      related_services: [ids.services.relatedMui],
      bao_hiem: { nha_nuoc: true, bao_lanh: false },
      loai: 'specialist',
    },
    {
      _id: ids.doctors.hong,
      user_id: ids.users.doctorHong,
      chi_nhanh_id: ids.branches.cauGiay,
      tieu_su: 'Bac si chuyen khoa Hong demo',
      bang_cap: 'Bac si Noi Tru',
      kinh_nghiem: '10 nam kham Hong',
      so_nam_kinh_nghiem: 10,
      gia_kham: 220000,
      phi_kham: 220000,
      tuoi_nhan_kham_tu: 3,
      trang_thai_duyet: 'approved',
      trang_thai: 'active',
      so_lan_nop: 1,
      la_hien: true,
      diem_danh_gia: 4.9,
      tong_danh_gia: 140,
      phong_kham_mac_dinh: 'Phong 305',
      specialties: [ids.specialties.hong, ids.specialties.tmh],
      services: [ids.services.relatedHong],
      related_services: [ids.services.relatedHong],
      bao_hiem: { nha_nuoc: true, bao_lanh: true },
      loai: 'specialist',
    },
  ]

  const guests = [
    { _id: ids.guests.callCenter, ho_ten: 'Pham Minh Call', so_dien_thoai: '0988000001', ngay_sinh: new Date('1991-05-20'), gioi_tinh: 'nam', dia_chi: 'Cau Giay, Ha Noi', ghi_chu: 'Khach goi dien dat lich', created_by: ids.users.receptionist },
    { _id: ids.guests.walkIn, ho_ten: 'Doan Thu Walkin', so_dien_thoai: '0988000002', ngay_sinh: new Date('1988-09-12'), gioi_tinh: 'nu', dia_chi: 'Ha Dong, Ha Noi', ghi_chu: 'Khach den truc tiep', created_by: ids.users.receptionist },
  ]

  const services = [
    { _id: ids.services.relatedMui, ma_dich_vu: 'DV002', ten: 'Rua mui', loai: 'related', mo_ta_ngan: 'Thu thuat rua mui demo', mo_ta: 'Dich vu theo chi dinh bac si', gia: 40000, thoi_gian_phut: null, specialty_id: ids.specialties.mui, chuan_bi_truoc: 'Khong xit mui truoc 2 gio', nguoi_tao_id: ids.users.admin, status: 'active' },
    { _id: ids.services.relatedHong, ma_dich_vu: 'DV003', ten: 'Noi soi hong', loai: 'related', mo_ta_ngan: 'Noi soi hong demo', mo_ta: 'Dich vu theo chi dinh bac si', gia: 50000, thoi_gian_phut: null, specialty_id: ids.specialties.hong, chuan_bi_truoc: 'Nhin an 2 gio truoc khi noi soi', nguoi_tao_id: ids.users.admin, status: 'active' },
    { _id: ids.services.relatedTmh, ma_dich_vu: 'DV004', ten: 'Noi soi tai', loai: 'related', mo_ta_ngan: 'Noi soi tai demo', mo_ta: 'Dich vu ho tro chan doan', gia: 50000, thoi_gian_phut: null, specialty_id: ids.specialties.tmh, chuan_bi_truoc: 'Ve sinh tai truoc khi kham', nguoi_tao_id: ids.users.admin, status: 'active' },
  ]

  const clinicConfig = [
    {
      _id: ids.clinicConfig,
      singleton_key: 'CAU_HINH_PHONG_KHAM',
      thoi_gian_giu_slot_phut: 15,
      so_lan_doi_lich_toi_da: 2,
      thoi_gian_toi_thieu_truoc_kham_de_doi_lich_gio: 4,
      nguong_huy_lich_trong_thang: 5,
      chinh_sach_hoan_tien: [
        { thoi_gian_toi_thieu_gio: 24, ti_le_hoan: 100, phi_huy_co_dinh: 0 },
        { thoi_gian_toi_thieu_gio: 2, ti_le_hoan: 80, phi_huy_co_dinh: 20000 },
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
    },
  ]

  const paymentSettings = [
    { _id: fixedObjectId(1201), ten_cai_dat: 'hoan_tien_truoc_24h', gia_tri: '100', mo_ta: 'Hoan 100% neu huy truoc 24h' },
    { _id: fixedObjectId(1202), ten_cai_dat: 'hoan_tien_truoc_2h', gia_tri: '80', mo_ta: 'Hoan 80% neu huy truoc 2h' },
    { _id: fixedObjectId(1203), ten_cai_dat: 'khong_hoan_tien_sau_2h', gia_tri: '0', mo_ta: 'Khong hoan tien neu huy sat gio' },
  ]

  const leaves = [
    {
      _id: ids.leaves.pending,
      bac_si_id: ids.doctors.tai,
      tu_ngay: timeline.day6,
      den_ngay: addDays(timeline.day6, 1),
      ly_do: 'Cong tac ca nhan',
      trang_thai: 'cho_duyet',
      nguoi_duyet_id: null,
      thoi_diem_duyet: null,
      ghi_chu: 'Dang cho admin duyet',
    },
    {
      _id: ids.leaves.approved,
      bac_si_id: ids.doctors.mui,
      tu_ngay: timeline.day4,
      den_ngay: timeline.day4,
      ly_do: 'Kham suc khoe dinh ky',
      trang_thai: 'da_duyet',
      nguoi_duyet_id: ids.users.admin,
      thoi_diem_duyet: makeDateTime(addDays(timeline.day4, -1), '16:00'),
      ghi_chu: 'Da duyet khoa slot buoi sang',
    },
  ]

  const appointments = appointmentPlans.map((plan) => {
    const slotMeta = slotLookup.get(plan.slotKey)
    const doctorPhi = plan.slotKey.startsWith('d0')
      ? 200000
      : plan.slotKey.startsWith('d1')
        ? 180000
        : 220000
    const codeDate = formatDateParts(slotMeta.day).yymmdd
    const appointment = {
      _id: plan.id,
      user_id: plan.userId ?? null,
      member_id: plan.memberId ?? null,
      doctor_id: slotMeta.doctorId,
      schedule_id: slotMeta.scheduleId,
      slot_id: slotMeta.slotId,
      service_id: null,
      chi_nhanh_id: slotMeta.branchId,
      specialty_id: slotMeta.specialtyId,
      khach_vang_lai_id: plan.guestId ?? null,
      loai_benh_nhan: plan.patientType,
      nguoi_tao_id: plan.creatorId,
      nguoi_dat_ho_id: plan.bookerId ?? null,
      dat_ho: Boolean(plan.datHo),
      hinh_thuc_dat_lich: plan.hinhThucDatLich,
      ma_lich_hen: `LH-${codeDate}-${String(plan.codeNo).padStart(4, '0')}`,
      loai_lich_hen: plan.loaiLichHen ?? 'kham_moi',
      lich_hen_goc_id: null,
      loai_kham: 'clinic',
      ngay_kham: slotMeta.day,
      gio_kham: slotMeta.start,
      gio_ket_thuc: slotMeta.end,
      ly_do_kham: plan.lyDoKham,
      phong_kham: plan.slotKey.startsWith('d0') ? 'Phong 101' : plan.slotKey.startsWith('d1') ? 'Phong 202' : 'Phong 305',
      dia_chi_kham: null,
      status: plan.status,
      payment_status: plan.paymentStatus,
      gia_kham: doctorPhi,
      ten_dich_vu: null,
      thoi_diem_thanh_toan: ['partial', 'paid', 'refunded'].includes(plan.paymentStatus)
        ? makeDateTime(slotMeta.day, '07:45')
        : null,
      trang_thai_den: plan.trangThaiDen,
      gio_den_thuc_te: ['checked_in', 'in_progress', 'completed'].includes(plan.status)
        ? makeDateTime(slotMeta.day, slotMeta.start)
        : null,
      ghi_chu_le_tan: plan.status === 'cancelled' ? 'Le tan da xac nhan huy lich' : null,
      ghi_chu_tiep_nhan: ['checked_in', 'in_progress', 'completed'].includes(plan.status) ? 'Da tiep nhan tai quay' : null,
      no_show_confirmed_at: plan.status === 'no_show' ? makeDateTime(addDays(slotMeta.day, 0), '17:00') : null,
      ten_khach: plan.tenKhach ?? null,
      gioi_tinh_khach: plan.gioiTinhKhach ?? null,
      so_dien_thoai_khach: plan.soDienThoaiKhach ?? null,
      email_khach: null,
      nam_sinh_khach: plan.namSinhKhach ?? null,
      tinh_thanh: 'Ha Noi',
      phuong_xa: null,
      dia_chi_chi_tiet: plan.diaChiKhach ?? null,
      nguoi_dat_ho_ten: plan.bookerId ? 'Nguyen Minh An' : null,
      nguoi_dat_sdt: plan.bookerId ? '0901000007' : null,
      ly_do_huy: plan.status === 'cancelled' ? 'Khach ban viec gia dinh' : null,
      huy_boi: plan.status === 'cancelled' ? 'patient' : null,
      nguoi_huy_id: plan.status === 'cancelled' ? plan.userId : null,
      thoi_diem_huy: plan.status === 'cancelled' ? makeDateTime(addDays(slotMeta.day, -1), '20:00') : null,
      expired_at: plan.status === 'pending' ? makeDateTime(slotMeta.day, '08:15') : null,
      so_lan_thay_doi: plan.id.toString() === fixedObjectId(1105).toString() ? 1 : 0,
      gio_dat_lich_id: fixedObjectId(1300 + plan.codeNo),
      payment_deadline: plan.status === 'pending' ? makeDateTime(slotMeta.day, '08:15') : null,
      pending_booking_id: plan.status === 'pending' ? `PENDING-${plan.codeNo}` : null,
      ket_qua_url: null,
    }

    return appointment
  })

  const doctorFeeMap = new Map([
    [ids.doctors.tai.toString(), 200000],
    [ids.doctors.mui.toString(), 180000],
    [ids.doctors.hong.toString(), 220000],
  ])

  const invoices = appointments.map((appointment, index) => {
    const fee = doctorFeeMap.get(appointment.doctor_id.toString())
    const plan = invoicePlans[appointment._id.toString()] || { total: fee, feeLines: [] }
    const invoiceDate = formatDateParts(appointment.ngay_kham).yymmdd
    return {
      _id: fixedObjectId(1401 + index),
      appointment_id: appointment._id,
      so_hoa_don: `HD-${invoiceDate}-${String(index + 1).padStart(4, '0')}`,
      chi_nhanh_id: appointment.chi_nhanh_id,
      specialty_id: appointment.specialty_id,
      tong_tien_kham: fee,
      chi_tiet_thu_phi: [
        {
          loai: 'phi_kham',
          ten: 'Phi kham',
          so_tien: fee,
          so_luong: 1,
          thanh_tien: fee,
        },
        ...plan.feeLines,
      ],
      tong_tien_phat_sinh: Math.max(0, plan.total - fee),
      tong_thanh_toan: plan.total,
      trang_thai_hoa_don: 'chua_thanh_toan',
      ghi_chu_ke_toan: appointment.status === 'cancelled' ? 'Hoa don demo cho case huy lich' : null,
    }
  })

  const invoiceByAppointmentId = new Map(invoices.map((invoice) => [invoice.appointment_id.toString(), invoice]))

  const payments = [
    {
      _id: fixedObjectId(1501),
      hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1102).toString())._id,
      benh_nhan_id: ids.users.patient2,
      ma_giao_dich: 'TXN9001',
      so_tien: 90000,
      loai_thanh_toan: 'dat_coc',
      phuong_thuc: 'chuyen_khoan',
      status: 'paid',
      nguoi_thu_id: ids.users.receptionist,
      thoi_diem_thanh_toan: makeDateTime(timeline.day1, '11:00'),
      ngay_thanh_toan: makeDateTime(timeline.day1, '11:00'),
      ngay_hoan_tien: null,
      gateway_transaction_id: 'GW-9001',
      gateway_response: { source: 'demo' },
    },
    {
      _id: fixedObjectId(1502),
      hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1103).toString())._id,
      benh_nhan_id: null,
      ma_giao_dich: 'TXN9002',
      so_tien: 100000,
      loai_thanh_toan: 'phi_dat_lich',
      phuong_thuc: 'tien_mat',
      status: 'paid',
      nguoi_thu_id: ids.users.receptionist,
      thoi_diem_thanh_toan: makeDateTime(timeline.day1, '12:00'),
      ngay_thanh_toan: makeDateTime(timeline.day1, '12:00'),
      ngay_hoan_tien: null,
      gateway_transaction_id: null,
      gateway_response: null,
    },
    {
      _id: fixedObjectId(1503),
      hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1108).toString())._id,
      benh_nhan_id: ids.users.patient1,
      ma_giao_dich: 'TXN9003',
      so_tien: 100000,
      loai_thanh_toan: 'dat_coc',
      phuong_thuc: 'vi_dien_tu',
      status: 'paid',
      nguoi_thu_id: ids.users.receptionist,
      thoi_diem_thanh_toan: makeDateTime(timeline.day0, '07:30'),
      ngay_thanh_toan: makeDateTime(timeline.day0, '07:30'),
      ngay_hoan_tien: null,
      gateway_transaction_id: 'GW-9003',
      gateway_response: { source: 'demo' },
    },
    {
      _id: fixedObjectId(1504),
      hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1108).toString())._id,
      benh_nhan_id: ids.users.patient1,
      ma_giao_dich: 'TXN9004',
      so_tien: 150000,
      loai_thanh_toan: 'thanh_toan_bo_sung',
      phuong_thuc: 'the_ngan_hang',
      status: 'paid',
      nguoi_thu_id: ids.users.receptionist,
      thoi_diem_thanh_toan: makeDateTime(timeline.day0, '10:00'),
      ngay_thanh_toan: makeDateTime(timeline.day0, '10:00'),
      ngay_hoan_tien: null,
      gateway_transaction_id: 'GW-9004',
      gateway_response: { source: 'demo' },
    },
    {
      _id: fixedObjectId(1505),
      hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1109).toString())._id,
      benh_nhan_id: ids.users.patient2,
      ma_giao_dich: 'TXN9005',
      so_tien: 220000,
      loai_thanh_toan: 'thanh_toan_bo_sung',
      phuong_thuc: 'chuyen_khoan',
      status: 'paid',
      nguoi_thu_id: ids.users.receptionist,
      thoi_diem_thanh_toan: makeDateTime(timeline.day0, '10:30'),
      ngay_thanh_toan: makeDateTime(timeline.day0, '10:30'),
      ngay_hoan_tien: null,
      gateway_transaction_id: 'GW-9005',
      gateway_response: { source: 'demo' },
    },
    {
      _id: fixedObjectId(1506),
      hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1110).toString())._id,
      benh_nhan_id: ids.users.patient5,
      ma_giao_dich: 'TXN9006',
      so_tien: 200000,
      loai_thanh_toan: 'thanh_toan_bo_sung',
      phuong_thuc: 'tien_mat',
      status: 'paid',
      nguoi_thu_id: ids.users.receptionist,
      thoi_diem_thanh_toan: makeDateTime(timeline.day0, '11:00'),
      ngay_thanh_toan: makeDateTime(timeline.day0, '11:00'),
      ngay_hoan_tien: null,
      gateway_transaction_id: null,
      gateway_response: null,
    },
    {
      _id: fixedObjectId(1507),
      hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1111).toString())._id,
      benh_nhan_id: ids.users.patient4,
      ma_giao_dich: 'TXN9007',
      so_tien: 220000,
      loai_thanh_toan: 'phi_dat_lich',
      phuong_thuc: 'vi_dien_tu',
      status: 'refunded',
      nguoi_thu_id: ids.users.receptionist,
      thoi_diem_thanh_toan: makeDateTime(addDays(timeline.day3, -1), '09:00'),
      ngay_thanh_toan: makeDateTime(addDays(timeline.day3, -1), '09:00'),
      ngay_hoan_tien: makeDateTime(addDays(timeline.day3, -1), '19:00'),
      gateway_transaction_id: 'GW-9007',
      gateway_response: { source: 'demo' },
    },
  ]

  const vitalAppointments = [1104, 1105, 1106, 1107, 1108, 1109, 1110].map((value) => fixedObjectId(value))
  const vitals = vitalAppointments.map((appointmentId, index) => {
    const appointment = appointments.find((item) => item._id.toString() === appointmentId.toString())
    return {
      _id: fixedObjectId(1601 + index),
      appointment_id: appointmentId,
      member_id: appointment.member_id ?? null,
      can_nang: 52 + index,
      chieu_cao: 150 + index,
      huyet_ap: `11${index}/7${index}`,
      nhiet_do: 36.5 + (index % 3) * 0.2,
      nhip_tim: 72 + index,
      nguoi_do_id: ids.users.nurse,
      thoi_diem_do: makeDateTime(appointment.ngay_kham, appointment.gio_kham),
      co_the_sua: index < 4,
      lich_su_cap_nhat: index === 0 ? [{ nguoi_cap_nhat_id: ids.users.nurse, thoi_diem_cap_nhat: makeDateTime(appointment.ngay_kham, '08:10'), noi_dung: 'Cap nhat huyet ap lan 2' }] : [],
    }
  })

  const medicalRecords = [
    { _id: fixedObjectId(1701), member_id: ids.members.patient1Self, appointment_id: fixedObjectId(1108), ten_khach: null, ngay_kham: timeline.day0, ten_benh_vien: 'VitaFamily Cau Giay', ten_bac_si: 'BS Tai Demo', ly_do_kham: 'Tai bi ù keo dai', chan_doan: 'Viem ong tai ngoai', ghi_chu: 'Tai kham sau 7 ngay', nguon: 'tu_kham' },
    { _id: fixedObjectId(1702), member_id: ids.members.patient2Self, appointment_id: fixedObjectId(1109), ten_khach: null, ngay_kham: timeline.day0, ten_benh_vien: 'VitaFamily Ha Dong', ten_bac_si: 'BS Mui Demo', ly_do_kham: 'Viem mui di ung', chan_doan: 'Viem mui di ung theo mua', ghi_chu: 'Ve sinh mui hang ngay', nguon: 'tu_kham' },
    { _id: fixedObjectId(1703), member_id: ids.members.patient5Self, appointment_id: fixedObjectId(1110), ten_khach: null, ngay_kham: timeline.day0, ten_benh_vien: 'VitaFamily Cau Giay', ten_bac_si: 'BS Hong Demo', ly_do_kham: 'Viem hong cap', chan_doan: 'Viem hong cap do virus', ghi_chu: 'Nghi ngoi 3 ngay', nguon: 'tu_kham' },
  ]

  const exams = [
    { _id: fixedObjectId(1801), appointment_id: fixedObjectId(1106), nguoi_nhap_id: ids.users.nurse, bac_si_phu_trach_id: ids.doctors.hong, nguoi_xac_nhan_id: null, thoi_diem_xac_nhan: null, chan_doan: 'Dang theo doi viem hong', huong_dan_dieu_tri: 'Cho ket qua xet nghiem nhanh', ghi_chu: 'Dang thao tac trong phong kham', co_the_sua: true, dich_vu_phat_sinh: [], dich_vu_tu_choi: [], chi_dinh_tai_kham: false, da_dat_lich_tai_kham: false, da_gui_cho_benh_nhan: false, lich_su_sua: [{ nguoi_sua_id: ids.users.nurse, thoi_diem_sua: makeDateTime(timeline.day1, '09:20'), noi_dung: 'Nhap trieu chung ban dau' }] },
    { _id: fixedObjectId(1802), appointment_id: fixedObjectId(1107), nguoi_nhap_id: ids.users.nurse, bac_si_phu_trach_id: ids.doctors.tai, nguoi_xac_nhan_id: null, thoi_diem_xac_nhan: null, chan_doan: 'Dang theo doi viem tai giua', huong_dan_dieu_tri: 'Can noi soi tai', ghi_chu: 'Khach vang lai can theo doi', co_the_sua: true, dich_vu_phat_sinh: [], dich_vu_tu_choi: [], chi_dinh_tai_kham: true, da_dat_lich_tai_kham: false, da_gui_cho_benh_nhan: false, lich_su_sua: [] },
    { _id: fixedObjectId(1803), appointment_id: fixedObjectId(1108), nguoi_nhap_id: ids.users.nurse, bac_si_phu_trach_id: ids.doctors.tai, nguoi_xac_nhan_id: ids.users.doctorTai, thoi_diem_xac_nhan: makeDateTime(timeline.day0, '10:10'), chan_doan: 'Viem ong tai ngoai', huong_dan_dieu_tri: 'Thuoc nho tai va giu kho', ghi_chu: 'Tai kham sau 7 ngay', co_the_sua: false, dich_vu_phat_sinh: [{ ten: 'Noi soi tai', so_tien: 50000 }], dich_vu_tu_choi: [], chi_dinh_tai_kham: true, da_dat_lich_tai_kham: true, da_gui_cho_benh_nhan: true, lich_su_sua: [{ nguoi_sua_id: ids.users.doctorTai, thoi_diem_sua: makeDateTime(timeline.day0, '10:00'), noi_dung: 'Cap nhat chan doan sau khi noi soi' }] },
    { _id: fixedObjectId(1804), appointment_id: fixedObjectId(1109), nguoi_nhap_id: ids.users.nurse, bac_si_phu_trach_id: ids.doctors.mui, nguoi_xac_nhan_id: ids.users.doctorMui, thoi_diem_xac_nhan: makeDateTime(timeline.day0, '10:40'), chan_doan: 'Viem mui di ung theo mua', huong_dan_dieu_tri: 'Rua mui va dung xit mui theo toa', ghi_chu: 'Hen tai kham neu con nghet mui', co_the_sua: false, dich_vu_phat_sinh: [{ ten: 'Rua mui', so_tien: 40000 }], dich_vu_tu_choi: [], chi_dinh_tai_kham: true, da_dat_lich_tai_kham: false, da_gui_cho_benh_nhan: true, lich_su_sua: [] },
    { _id: fixedObjectId(1805), appointment_id: fixedObjectId(1110), nguoi_nhap_id: ids.users.nurse, bac_si_phu_trach_id: ids.doctors.hong, nguoi_xac_nhan_id: ids.users.doctorHong, thoi_diem_xac_nhan: makeDateTime(timeline.day0, '11:20'), chan_doan: 'Viem hong cap do virus', huong_dan_dieu_tri: 'Suc hong va nghi ngoi', ghi_chu: 'Giam tru bao hiem theo quyen loi', co_the_sua: false, dich_vu_phat_sinh: [], dich_vu_tu_choi: [], chi_dinh_tai_kham: false, da_dat_lich_tai_kham: false, da_gui_cho_benh_nhan: true, lich_su_sua: [] },
  ]

  const specializedResults = {
    tai: [
      { _id: fixedObjectId(1901), appointment_id: fixedObjectId(1107), ket_qua_kham_id: fixedObjectId(1802), la_ket_qua_chinh: true, hinh_anh_noi_soi: [{ url: 'https://demo.vitafamily.vn/noi-soi/tai-1107-1.jpg', mo_ta: 'Ong tai ngoai', uploaded_at: makeDateTime(timeline.day1, '09:15') }] },
      { _id: fixedObjectId(1902), appointment_id: fixedObjectId(1109), ket_qua_kham_id: fixedObjectId(1804), la_ket_qua_chinh: false, hinh_anh_noi_soi: [{ url: 'https://demo.vitafamily.vn/noi-soi/tai-1109-1.jpg', mo_ta: 'Tai trai', uploaded_at: makeDateTime(timeline.day0, '10:35') }] },
    ],
    mui: [
      { _id: fixedObjectId(1911), appointment_id: fixedObjectId(1109), ket_qua_kham_id: fixedObjectId(1804), la_ket_qua_chinh: true, hinh_anh_noi_soi: [{ url: 'https://demo.vitafamily.vn/noi-soi/mui-1109-1.jpg', mo_ta: 'Mui phai', uploaded_at: makeDateTime(timeline.day0, '10:32') }] },
      { _id: fixedObjectId(1912), appointment_id: fixedObjectId(1106), ket_qua_kham_id: fixedObjectId(1801), la_ket_qua_chinh: false, hinh_anh_noi_soi: [{ url: 'https://demo.vitafamily.vn/noi-soi/mui-1106-1.jpg', mo_ta: 'Kiem tra niem mac mui', uploaded_at: makeDateTime(timeline.day1, '09:22') }] },
    ],
    hong: [
      { _id: fixedObjectId(1921), appointment_id: fixedObjectId(1110), ket_qua_kham_id: fixedObjectId(1805), la_ket_qua_chinh: true, hinh_anh_noi_soi: [{ url: 'https://demo.vitafamily.vn/noi-soi/hong-1110-1.jpg', mo_ta: 'Hong do nhe', uploaded_at: makeDateTime(timeline.day0, '11:10') }] },
    ],
  }

  const prescriptions = [
    {
      _id: fixedObjectId(2001),
      ket_qua_kham_id: fixedObjectId(1803),
      medical_record_id: fixedObjectId(1701),
      member_id: ids.members.patient1Self,
      ten_khach: null,
      doctor_id: ids.doctors.tai,
      nguon: 'bac_si',
      ghi_chu: 'Dung du 5 ngay',
      items: [
        { _id: fixedObjectId(2101), ten_thuoc: 'Thuoc nho tai A', lieu_luong: '2 giot', tan_suat: '2 lan/ngay', gio_uong: ['08:00', '20:00'], so_ngay: 5, ghi_chu: 'Nho sau khi ve sinh tai' },
        { _id: fixedObjectId(2102), ten_thuoc: 'Paracetamol 500mg', lieu_luong: '1 vien', tan_suat: '2 lan/ngay', gio_uong: ['08:00', '20:00'], so_ngay: 3, ghi_chu: 'Chi dung khi dau' },
      ],
    },
    {
      _id: fixedObjectId(2002),
      ket_qua_kham_id: fixedObjectId(1805),
      medical_record_id: fixedObjectId(1703),
      member_id: ids.members.patient5Self,
      ten_khach: null,
      doctor_id: ids.doctors.hong,
      nguon: 'bac_si',
      ghi_chu: 'Uong nhieu nuoc am',
      items: [
        { _id: fixedObjectId(2103), ten_thuoc: 'Vien ngam hong B', lieu_luong: '1 vien', tan_suat: '3 lan/ngay', gio_uong: ['08:00', '13:00', '20:00'], so_ngay: 5, ghi_chu: 'Dung sau bua an' },
      ],
    },
  ]

  const refunds = [
    {
      _id: fixedObjectId(2201),
      payment_id: fixedObjectId(1507),
      appointment_id: fixedObjectId(1111),
      so_tien_hoan: 176000,
      so_tien_da_thu: 220000,
      phi_huy: 44000,
      chinh_sach_hoan: 'Hoan 80 phan tram tru phi huy',
      phan_tram_hoan: 80,
      ly_do: 'Huy lich truoc 1 ngay',
      ly_do_hoan: 'Benh nhan can doi lich sang tuan sau',
      status: 'completed',
      ly_do_tu_choi: null,
      xu_ly_boi: ids.users.admin,
      nguoi_xu_ly_id: ids.users.admin,
      nguoi_duyet_id: null,
      phuong_thuc_hoan: 'chuyen_khoan',
      ngay_yeu_cau: makeDateTime(addDays(timeline.day3, -1), '18:00'),
      ngay_xu_ly: makeDateTime(addDays(timeline.day3, -1), '19:00'),
      thoi_diem_hoan_thanh: makeDateTime(addDays(timeline.day3, -1), '19:30'),
    },
  ]

  const notifications = [
    { _id: fixedObjectId(2301), user_id: ids.users.patient1, tieu_de: 'Xac nhan lich kham', noi_dung: 'Lich kham tai da duoc xac nhan.', loai: 'appointment', related_id: fixedObjectId(1108), related_type: 'LichHen', da_doc: true, du_lieu_dinh_kem: { appointment_id: fixedObjectId(1108).toString() }, kenh_gui: 'in_app', da_gui: true, thoi_diem_gui: makeDateTime(timeline.day0, '07:00'), thoi_diem_doc: makeDateTime(timeline.day0, '07:05'), ngay_gui_du_kien: makeDateTime(addDays(timeline.day0, -1), '20:00') },
    { _id: fixedObjectId(2302), user_id: ids.users.patient2, tieu_de: 'Nhac lich kham', noi_dung: 'Ban co lich kham mui vao ngay mai.', loai: 'reminder', related_id: fixedObjectId(1102), related_type: 'LichHen', da_doc: false, du_lieu_dinh_kem: { appointment_id: fixedObjectId(1102).toString() }, kenh_gui: 'email', da_gui: true, thoi_diem_gui: makeDateTime(timeline.day1, '09:00'), thoi_diem_doc: null, ngay_gui_du_kien: makeDateTime(timeline.day1, '09:00') },
    { _id: fixedObjectId(2303), user_id: ids.users.patient2, tieu_de: 'Thanh toan dat coc thanh cong', noi_dung: 'Dat coc cho hoa don demo da thanh cong.', loai: 'payment', related_id: fixedObjectId(1501), related_type: 'ThanhToan', da_doc: false, du_lieu_dinh_kem: { hoa_don_id: invoiceByAppointmentId.get(fixedObjectId(1102).toString())._id.toString() }, kenh_gui: 'in_app', da_gui: true, thoi_diem_gui: makeDateTime(timeline.day1, '11:02'), thoi_diem_doc: null, ngay_gui_du_kien: makeDateTime(timeline.day1, '11:00') },
    { _id: fixedObjectId(2304), user_id: ids.users.patient4, tieu_de: 'Lich kham da huy', noi_dung: 'Yeu cau huy lich da duoc ghi nhan.', loai: 'refund', related_id: fixedObjectId(2201), related_type: 'HoanTien', da_doc: true, du_lieu_dinh_kem: { appointment_id: fixedObjectId(1111).toString() }, kenh_gui: 'sms', da_gui: true, thoi_diem_gui: makeDateTime(addDays(timeline.day3, -1), '19:35'), thoi_diem_doc: makeDateTime(addDays(timeline.day3, -1), '19:50'), ngay_gui_du_kien: makeDateTime(addDays(timeline.day3, -1), '19:30') },
    { _id: fixedObjectId(2305), user_id: ids.users.patient5, tieu_de: 'Toa thuoc da san sang', noi_dung: 'Don thuoc sau kham hong da duoc tao.', loai: 'medicine', related_id: fixedObjectId(2002), related_type: 'DonThuoc', da_doc: false, du_lieu_dinh_kem: { don_thuoc_id: fixedObjectId(2002).toString() }, kenh_gui: 'in_app', da_gui: true, thoi_diem_gui: makeDateTime(timeline.day0, '11:30'), thoi_diem_doc: null, ngay_gui_du_kien: makeDateTime(timeline.day0, '11:30') },
    { _id: fixedObjectId(2306), user_id: ids.users.patient1, tieu_de: 'Nhac tai kham', noi_dung: 'Ban duoc bac si chi dinh tai kham sau 7 ngay.', loai: 'reminder', related_id: fixedObjectId(1108), related_type: 'LichHen', da_doc: false, du_lieu_dinh_kem: { tai_kham: true }, kenh_gui: 'zalo', da_gui: false, thoi_diem_gui: null, thoi_diem_doc: null, ngay_gui_du_kien: makeDateTime(addDays(timeline.day0, 4), '08:00') },
  ]

  const histories = [
    {
      _id: fixedObjectId(2401),
      appointment_id: fixedObjectId(1102),
      tu_trang_thai: 'pending',
      den_trang_thai: 'confirmed',
      tu_payment_status: 'unpaid',
      den_payment_status: 'partial',
      loai_thay_doi: 'xac_nhan',
      ly_do_thay_doi: 'Le tan xac nhan sau khi nhan coc',
      bac_si_cu_id: ids.doctors.mui,
      bac_si_moi_id: ids.doctors.mui,
      specialty_cu_id: ids.specialties.mui,
      specialty_moi_id: ids.specialties.mui,
      schedule_cu_id: slotLookup.get('d1-day2-slot0').scheduleId,
      schedule_moi_id: slotLookup.get('d1-day2-slot0').scheduleId,
      slot_cu_id: slotLookup.get('d1-day2-slot0').slotId,
      slot_moi_id: slotLookup.get('d1-day2-slot0').slotId,
      ngay_kham_cu: timeline.day2,
      ngay_kham_moi: timeline.day2,
      gio_kham_cu: '08:00',
      gio_kham_moi: '08:00',
      nguoi_thay_doi_id: ids.users.receptionist,
      thoi_diem_thay_doi: makeDateTime(timeline.day1, '11:05'),
      kenh_thay_doi: 'admin',
      nguoi_thuc_hien_id: ids.users.receptionist,
      vai_tro: 'admin',
      ly_do: 'Xac nhan sau khi dat coc',
      thoi_diem: makeDateTime(timeline.day1, '11:05'),
    },
    {
      _id: fixedObjectId(2402),
      appointment_id: fixedObjectId(1105),
      tu_trang_thai: 'confirmed',
      den_trang_thai: 'checked_in',
      tu_payment_status: 'unpaid',
      den_payment_status: 'unpaid',
      loai_thay_doi: 'dat_ho',
      ly_do_thay_doi: 'Me dua con den kham',
      bac_si_cu_id: ids.doctors.mui,
      bac_si_moi_id: ids.doctors.mui,
      specialty_cu_id: ids.specialties.mui,
      specialty_moi_id: ids.specialties.mui,
      schedule_cu_id: slotLookup.get('d1-day1-slot1').scheduleId,
      schedule_moi_id: slotLookup.get('d1-day1-slot1').scheduleId,
      slot_cu_id: slotLookup.get('d1-day1-slot1').slotId,
      slot_moi_id: slotLookup.get('d1-day1-slot1').slotId,
      ngay_kham_cu: timeline.day1,
      ngay_kham_moi: timeline.day1,
      gio_kham_cu: '08:30',
      gio_kham_moi: '08:30',
      nguoi_thay_doi_id: ids.users.receptionist,
      thoi_diem_thay_doi: makeDateTime(timeline.day1, '08:20'),
      kenh_thay_doi: 'admin',
      nguoi_thuc_hien_id: ids.users.receptionist,
      vai_tro: 'admin',
      ly_do: 'Check-in tai quay',
      thoi_diem: makeDateTime(timeline.day1, '08:20'),
    },
    {
      _id: fixedObjectId(2403),
      appointment_id: fixedObjectId(1111),
      tu_trang_thai: 'confirmed',
      den_trang_thai: 'cancelled',
      tu_payment_status: 'paid',
      den_payment_status: 'refunded',
      loai_thay_doi: 'huy_lich',
      ly_do_thay_doi: 'Benh nhan xin doi lich',
      bac_si_cu_id: ids.doctors.tai,
      bac_si_moi_id: ids.doctors.tai,
      specialty_cu_id: ids.specialties.tai,
      specialty_moi_id: ids.specialties.tai,
      schedule_cu_id: slotLookup.get('d0-day3-slot3').scheduleId,
      schedule_moi_id: slotLookup.get('d0-day3-slot3').scheduleId,
      slot_cu_id: slotLookup.get('d0-day3-slot3').slotId,
      slot_moi_id: slotLookup.get('d0-day3-slot3').slotId,
      ngay_kham_cu: timeline.day3,
      ngay_kham_moi: timeline.day3,
      gio_kham_cu: '09:30',
      gio_kham_moi: '09:30',
      nguoi_thay_doi_id: ids.users.patient4,
      thoi_diem_thay_doi: makeDateTime(addDays(timeline.day3, -1), '18:30'),
      kenh_thay_doi: 'app',
      nguoi_thuc_hien_id: ids.users.patient4,
      vai_tro: 'user',
      ly_do: 'Huy lich va tao hoan tien',
      thoi_diem: makeDateTime(addDays(timeline.day3, -1), '18:30'),
    },
    {
      _id: fixedObjectId(2404),
      appointment_id: fixedObjectId(1112),
      tu_trang_thai: 'confirmed',
      den_trang_thai: 'no_show',
      tu_payment_status: 'unpaid',
      den_payment_status: 'unpaid',
      loai_thay_doi: 'vang_mat',
      ly_do_thay_doi: 'Benh nhan khong den',
      bac_si_cu_id: ids.doctors.mui,
      bac_si_moi_id: ids.doctors.mui,
      specialty_cu_id: ids.specialties.mui,
      specialty_moi_id: ids.specialties.mui,
      schedule_cu_id: slotLookup.get('d1-day0-slot3').scheduleId,
      schedule_moi_id: slotLookup.get('d1-day0-slot3').scheduleId,
      slot_cu_id: slotLookup.get('d1-day0-slot3').slotId,
      slot_moi_id: slotLookup.get('d1-day0-slot3').slotId,
      ngay_kham_cu: timeline.day0,
      ngay_kham_moi: timeline.day0,
      gio_kham_cu: '09:30',
      gio_kham_moi: '09:30',
      nguoi_thay_doi_id: ids.users.receptionist,
      thoi_diem_thay_doi: makeDateTime(timeline.day0, '17:30'),
      kenh_thay_doi: 'admin',
      nguoi_thuc_hien_id: ids.users.receptionist,
      vai_tro: 'admin',
      ly_do: 'Le tan danh dau no_show',
      thoi_diem: makeDateTime(timeline.day0, '17:30'),
    },
  ]

  const counters = [
    { _id: fixedObjectId(2501), key: 'ma_lich_hen', seq: 20 },
    { _id: fixedObjectId(2502), key: 'so_hoa_don', seq: 20 },
  ]

  return {
    ids,
    timeline,
    branches,
    specialties,
    users,
    families,
    members,
    doctors,
    guests,
    services,
    clinicConfig,
    paymentSettings,
    schedules,
    appointments,
    invoices,
    payments,
    medicalRecords,
    vitals,
    exams,
    specializedResults,
    prescriptions,
    refunds,
    notifications,
    leaves,
    histories,
    counters,
    demoAccounts: [
      { role: 'admin', email: 'admin.demo@vitafamily.vn', password: '123456', ho_ten: 'Admin Demo' },
      { role: 'receptionist', email: 'reception.demo@vitafamily.vn', password: '123456', ho_ten: 'Le Tan Demo' },
      { role: 'nurse', email: 'nurse.demo@vitafamily.vn', password: '123456', ho_ten: 'Dieu Duong Demo' },
      { role: 'doctor', email: 'doctor.tai@vitafamily.vn', password: '123456', ho_ten: 'BS Tai Demo' },
      { role: 'doctor', email: 'doctor.mui@vitafamily.vn', password: '123456', ho_ten: 'BS Mui Demo' },
      { role: 'doctor', email: 'doctor.hong@vitafamily.vn', password: '123456', ho_ten: 'BS Hong Demo' },
      { role: 'patient', email: 'patient01.demo@vitafamily.vn', password: '123456', ho_ten: 'Nguyen Minh An' },
      { role: 'patient', email: 'patient02.demo@vitafamily.vn', password: '123456', ho_ten: 'Tran Thu Ha' },
      { role: 'patient', email: 'patient03.demo@vitafamily.vn', password: '123456', ho_ten: 'Pham Quang Huy' },
      { role: 'patient', email: 'patient04.demo@vitafamily.vn', password: '123456', ho_ten: 'Le My Linh' },
      { role: 'patient', email: 'patient05.demo@vitafamily.vn', password: '123456', ho_ten: 'Doan Gia Bao' },
    ],
  }
}
