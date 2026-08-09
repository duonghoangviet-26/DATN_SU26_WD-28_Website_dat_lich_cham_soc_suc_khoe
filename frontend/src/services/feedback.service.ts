import axiosInstance from './axiosInstance'

export interface IFeedbackPayload {
  ho_ten: string
  email_sdt: string
  noi_dung: string
  hinh_anh?: string | null
}

export const feedbackService = {
  createFeedback(data: IFeedbackPayload) {
    return axiosInstance.post('/phan-hoi', data)
  },
  
  getFeedbackList() {
    return axiosInstance.get('/phan-hoi')
  },
  
  markAsRead(id: string) {
    return axiosInstance.put(`/phan-hoi/${id}/read`)
  },
  
  deleteFeedback(id: string) {
    return axiosInstance.delete(`/phan-hoi/${id}`)
  }
}
