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
  gia_kham: number | null
  payment_status: string
  de_xuat: {
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

function serviceFor(basePath: '/receptionist/reschedule-approvals' | '/admin/reschedule-approvals') {
  return {
    async list(): Promise<RescheduleApprovalItem[]> {
      const res = await axiosInstance.get<ApiResponse<RescheduleApprovalItem[]>>(basePath)
      return Array.isArray(res.data.data) ? res.data.data : []
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
