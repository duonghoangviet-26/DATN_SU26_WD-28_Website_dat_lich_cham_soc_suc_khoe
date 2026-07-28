import axios from 'axios'

export const fallbackLLM = async (prompt: string, contextData?: string): Promise<string> => {
  try {
    const systemPrompt = `Bạn là trợ lý ảo y tế của phòng khám VitaFamily. 
Hãy trả lời ngắn gọn, thân thiện, dùng định dạng Markdown.
Nếu người dùng hỏi thông tin cụ thể mà không có trong dữ liệu, hãy hướng dẫn họ liên hệ trực tiếp số hotline 0365 747888.
Tuyệt đối KHÔNG yêu cầu thông tin cá nhân (SĐT, tên, bệnh lý) của người dùng.
Thông tin tham khảo (nếu có): ${contextData || 'Không có thêm thông tin'}`

    const res = await axios.post('https://text.pollinations.ai/', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: 'openai'
    }, {
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (res.data) {
      return typeof res.data === 'string' ? res.data : (res.data.choices?.[0]?.message?.content || JSON.stringify(res.data))
    }
    return "Xin lỗi, hiện tại tôi không thể kết nối tới máy chủ xử lý ngôn ngữ."
  } catch (error) {
    console.error("LLM Error:", error)
    return "Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau."
  }
}
