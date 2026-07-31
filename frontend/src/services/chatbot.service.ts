// Chế độ Offline (Mock Engine) - Tránh hoàn toàn lỗi API cho Đồ án sinh viên

// Hàm loại bỏ dấu tiếng Việt để dễ so sánh
const removeAccents = (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
}

export const fallbackLLM = async (prompt: string, _contextData?: string): Promise<string> => {
  const text = removeAccents(prompt)
  
  // Rule 1: Xin chào
  if (text.match(/^(hello|hi|xin chao|chao|helo|alo)/i)) {
    return "Xin chào! 👋 Tôi là trợ lý ảo y tế của phòng khám VitaFamily. Tôi có thể giúp bạn xem danh sách bác sĩ, xem giá hoặc đặt lịch khám. Bạn cần tôi giúp gì nào?"
  }

  // Rule 2: Hỏi tên/chức năng
  if (text.match(/(ban la ai|ten gi|ban lam duoc gi|nghiep vu|chuc nang)/i)) {
    return "Tôi là trợ lý đặt lịch của **VitaFamily**. Tôi có thể hỗ trợ bạn:\n- Tìm khung giờ khám Tai Mũi Họng còn trống\n- Tra cứu thông tin bác sĩ và dịch vụ\n- Hướng dẫn đặt lịch, thanh toán\nBạn cần hỗ trợ nội dung nào?"
  }

  // Rule 3: Hỏi thời tiết/linh tinh
  if (text.match(/(thoi tiet|an com chua|khoe khong)/i)) {
    return "Haha, tôi là một con Bot nên không biết đói và cũng không quan tâm thời tiết lắm đâu! 😂 Chuyên môn của tôi là Y tế cơ, bạn hãy hỏi tôi về các dịch vụ khám chữa bệnh nhé!"
  }
  
  // Rule 4: Hỏi về sức khỏe chung chung (bệnh lý)
  if (text.match(/\b(dau|nhuc|ho|sot|kho tho|met moi|benh|thuoc)\b/i)) {
    return "🩺 Nghe có vẻ bạn đang gặp vấn đề về sức khỏe. Lời khuyên tốt nhất là bạn nên **đặt lịch khám** để bác sĩ của chúng tôi kiểm tra trực tiếp nhé. Tuyệt đối không tự ý mua thuốc uống ở nhà!"
  }

  // Default Fallback (Không hiểu)
  return "Tôi chưa hiểu rõ câu hỏi này lắm. Nhưng nếu bạn đang cần tư vấn y tế gấp, vui lòng gọi trực tiếp vào số Hotline **0365 747888** để đội ngũ chuyên gia của chúng tôi hỗ trợ ngay lập tức nhé!"
}
