import axiosInstance from './axiosInstance';

export interface FollowUpRecord {
    lich_hen_goc_id: string;
    ngay_kham_cu: string;
    chan_doan: string;
    ngay_tai_kham: string | null;
    specialty_id: string;
    doctor_id: string;
    bac_si: {
        id: string;
        ho_ten: string;
        anh_dai_dien: string | null;
    } | null;
    benh_nhan: {
        ten_khach: string;
        member_id: string | null;
    }
}

export interface ReceptionistFollowUpRecord {
    lich_hen_goc_id: string;
    ten_khach: string;
    so_dien_thoai: string;
    bac_si: string;
    chuyen_khoa_id: string;
    chan_doan: string;
    ngay_kham_cu: string;
    ngay_tai_kham: string | null;
}

export const followupService = {
    getMyFollowUps: async (): Promise<FollowUpRecord[]> => {
        const res = await axiosInstance.get('/patient/followup');
        // Backend dùng ok() → response là { success, data: [...] }
        return Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
    },
    // Dành cho lễ tân
    getPendingFollowUps: async (): Promise<ReceptionistFollowUpRecord[]> => {
        const res = await axiosInstance.get('/receptionist/followup');
        return res.data.data;
    }
};
