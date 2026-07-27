import axios from 'axios'

export const fallbackLLM = async (prompt: string, contextData?: string): Promise<string> => {
  try {
    const fullPrompt = `Bạn là trợ lý ảo y tế của phòng khám VitaFamily. 
Hãy trả lời ngắn gọn, thân thiện, dùng định dạng Markdown.
Nếu người dùng hỏi thông tin cụ thể mà không có trong dữ liệu, hãy hướng dẫn họ liên hệ trực tiếp.
Tuyệt đối KHÔNG yêu cầu thông tin cá nhân (SĐT, tên, bệnh lý) của người dùng.
Thông tin tham khảo (nếu có): ${contextData || 'Không có thêm thông tin'}

Câu hỏi của người dùng: "${prompt}"`

    // Pollinations AI API (Free text endpoint)
    // Encode the prompt in the URL
    const encodedPrompt = encodeURIComponent(fullPrompt)
    const url = `https://text.pollinations.ai/${encodedPrompt}`
    
    const res = await axios.get(url)
    if (res.data) {
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    }
    return "Xin lỗi, hiện tại tôi không thể kết nối tới máy chủ xử lý ngôn ngữ."
  } catch (error) {
    console.error("LLM Error:", error)
    return "Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau."
  }
}
