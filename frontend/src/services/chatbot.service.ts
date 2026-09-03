import axiosInstance from '@/services/axiosInstance'

// Hàm loại bỏ dấu tiếng Việt để dễ so sánh
const removeAccents = (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
}

export const fallbackLLM = async (prompt: string, _contextData?: string): Promise<string> => {
  const text = removeAccents(prompt)
  
  // Rule 1: Xin chào
  if (text.match(/^(hello|hi|xin chao|chao|helo|alo)/i)) {
    return "Xin chào! 👋 Tôi là trợ lý ảo y tế của phòng khám ViteFamily. Tôi có thể giúp bạn xem danh sách bác sĩ, xem giá hoặc đặt lịch khám. Bạn cần tôi giúp gì nào?"
  }

  // Rule 2: Hỏi tên/chức năng
  if (text.match(/(ban la ai|ten gi|ban lam duoc gi|nghiep vu|chuc nang)/i)) {
    return "Tôi là Trợ lý ảo của **ViteFamily**. Tôi có thể hỗ trợ bạn:\n- Tìm khung giờ khám Tai Mũi Họng còn trống\n- Tra cứu thông tin bác sĩ và dịch vụ\n- Hướng dẫn đặt lịch, thanh toán\nBạn cần hỗ trợ nội dung nào?"
  }

  try {
    const res = await axiosInstance.post('/chatbot/message', { message: prompt }, { timeout: 30000 })
    if (res.data && res.data.success && res.data.data.reply) {
      return res.data.data.reply
    }
    return "Lỗi kết nối tới hệ thống, vui lòng thử lại sau."
  } catch (error) {
    console.error('Chatbot API error:', error)
    return "Hệ thống đang bận hoặc bị lỗi. Nếu bạn đang cần tư vấn y tế gấp, vui lòng gọi trực tiếp vào số Hotline **0365 747888** để đội ngũ chuyên gia của chúng tôi hỗ trợ ngay lập tức nhé!"
  }
}
