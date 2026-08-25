import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

// ============================================================
// Duyệt / chọn tay phương án dời lịch cho khách bị ảnh hưởng bởi bác sĩ nghỉ đột xuất
// (rule mục 15, chốt 2026-08-22). Cùng API cho cả lễ tân và admin — chỉ khác base path.
// ============================================================

export interface RescheduleProposalOption {
  index: number
  loai: 'doi_bac_si' | 'doi_khung'
  mo_ta: string
  ngay: string
  gio_bat_dau: string
  bac_si_ten: string | null
  doctor_id: string | null
  schedule_id: string | null
  slot_id: string | null
  da_giu_cho: boolean
  lan_walk_in: boolean
}

export interface RescheduleApprovalItem {
  id: string
  ma_lich_hen: string | null
  ten_khach: string | null
  so_dien_thoai_khach: string | null
  ngay_kham: string
  gio_kham: string
  doctor_id: string | null
  specialty_id: string | null
  nguon: 'online' | 'tai_cho' | null
  so_lan_doi_khach_yeu_cau: number
  gia_kham: number | null
  payment_status: string
  de_xuat: {
    nghi_phep_id: string | null
    trang_thai: 'cho_admin_duyet' | 'cho_khach_chon' | 'da_ap_dung' | 'da_huy' | null
    han_phan_hoi: string | null
    ghi_chu: string | null
    phuong_an: RescheduleProposalOption[]
  }
}

export interface FreeSlot {
  slot_id: string
  gio_bat_dau: string
  gio_ket_thuc: string
  loai_slot: 'online' | 'walk_in'
}

export interface DonNghiConViec {
  leave_id: string
  bac_si: string
  tu_ngay: string
  den_ngay: string
  gio_bat_dau: string | null
  gio_ket_thuc: string | null
  ly_do: string | null
  trang_thai_don: string
  so_lich_chua_xu_ly: number
  han_phan_hoi_som_nhat: string | null
}

/** Khách ĐÃ CHECK-IN — hàng riêng trong bảng, không tick checkbox, chuyển bác sĩ tại quầy (C3). */
export interface KhachTaiQuay {
  hang_doi_id: string
  appointment_id: string | null
  trang_thai_hang_doi: string
  ma_so_thu_tu: string | null
  ten_khach: string | null
  so_dien_thoai_khach: string | null
  gio_kham: string | null
  ma_lich_hen: string | null
  doctor_id: string | null
  specialty_id: string | null
}

export interface TongQuanDieuPhoi {
  leave_id: string
  bac_si: string
  bac_si_id: string | null
  trang_thai_don: string
  khoang_nghi: { tu_ngay: string; den_ngay: string; gio_bat_dau: string | null; gio_ket_thuc: string | null }
  ly_do: string | null
  so_lich_anh_huong: number
  so_cho_duyet: number
  so_cho_khach_chon: number
  so_da_doi: number
  so_khong_co_cho: number
  so_khong_co_cho_da_xu_ly: number
  so_slot_da_khoa: number
  so_tai_quay: number
  tai_quay: KhachTaiQuay[]
}

export interface BulkApproveKetQua {
  thanh_cong: Array<{ id: string; ten_khach: string | null; mo_ta: string }>
  that_bai: Array<{ id: string; ten_khach: string | null; ly_do: string }>
}

function serviceFor(basePath: '/receptionist/reschedule-approvals' | '/admin/reschedule-approvals') {
  return {
    async list(params?: { leave_id?: string; trang_thai?: string }): Promise<RescheduleApprovalItem[]> {
      const res = await axiosInstance.get<ApiResponse<RescheduleApprovalItem[]>>(basePath, { params })
      return Array.isArray(res.data.data) ? res.data.data : []
    },

    async danhSachDonNghi(trangThai?: 'con_viec' | 'da_xong' | 'tat_ca'): Promise<DonNghiConViec[]> {
      const res = await axiosInstance.get<ApiResponse<DonNghiConViec[]>>(`${basePath}/leaves`, { params: trangThai ? { trang_thai: trangThai } : undefined })
      return Array.isArray(res.data.data) ? res.data.data : []
    },

    async tongQuan(leaveId: string): Promise<TongQuanDieuPhoi> {
      const res = await axiosInstance.get<ApiResponse<TongQuanDieuPhoi>>(`${basePath}/leave/${leaveId}/tong-quan`)
      return res.data.data
    },

    async bulkApprove(ids: string[]): Promise<BulkApproveKetQua> {
      const res = await axiosInstance.post<ApiResponse<BulkApproveKetQua>>(`${basePath}/bulk-approve`, { appointment_ids: ids })
      return res.data.data
    },

    async approve(id: string, ghi_chu?: string): Promise<RescheduleApprovalItem> {
      const res = await axiosInstance.patch<ApiResponse<RescheduleApprovalItem>>(`${basePath}/${id}/approve`, { ghi_chu })
      return res.data.data
    },

    async reject(id: string, ly_do: string): Promise<RescheduleApprovalItem> {
      const res = await axiosInstance.patch<ApiResponse<RescheduleApprovalItem>>(`${basePath}/${id}/reject`, { ly_do })
      return res.data.data
    },

    async freeSlots(id: string, doctorId: string, date: string): Promise<{ schedule_id: string | null; slots: FreeSlot[] }> {
      const res = await axiosInstance.get<ApiResponse<{ schedule_id: string | null; slots: FreeSlot[] }>>(`${basePath}/${id}/free-slots`, {
        params: { doctor_id: doctorId, date },
      })
      return res.data.data
    },

    async chonTay(id: string, payload: { doctor_id: string; schedule_id: string; slot_id: string }): Promise<RescheduleApprovalItem> {
      const res = await axiosInstance.patch<ApiResponse<RescheduleApprovalItem>>(`${basePath}/${id}/chon-tay`, payload)
      return res.data.data
    },
  }
}

export const receptionistRescheduleApprovalsService = serviceFor('/receptionist/reschedule-approvals')
export const adminRescheduleApprovalsService = serviceFor('/admin/reschedule-approvals')
