import { GoogleGenerativeAI } from '@google/generative-ai'
import { ok, fail } from '../utils/response.js'

export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body
    if (!message) {
      return fail(res, 400, 'Tin nhắn không được để trống')
    }

    if (!process.env.GEMINI_API_KEY) {
       console.error('GEMINI_API_KEY is missing in backend .env')
       return fail(res, 500, 'Cấu hình Gemini API Key bị thiếu trên server')
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      systemInstruction: `Bạn là trợ lý ảo y tế của phòng khám chuyên khoa Tai Mũi Họng VitaFamily.
Quy tắc trả lời:
- Chỉ tư vấn thông tin liên quan đến lĩnh vực Tai Mũi Họng và dịch vụ của phòng khám VitaFamily.
- Không chẩn đoán bệnh thay bác sĩ, không kê đơn thuốc.
- Với triệu chứng bệnh nhẹ, đưa ra kiến thức y khoa chung chung.
- Với triệu chứng nghiêm trọng hoặc cấp cứu, hãy khuyên bệnh nhân đi khám ngay hoặc gọi hotline 0365747888.
- Luôn thân thiện, chuyên nghiệp, xưng "Tôi" và gọi khách hàng là "Bạn".
- Trả lời ngắn gọn, súc tích (1-2 đoạn).
- Gợi ý khách hàng tra cứu bác sĩ, dịch vụ, hoặc đặt lịch khám trên hệ thống nếu phù hợp.`
    })

    const result = await model.generateContent(message)
    const responseText = result.response.text()

    return ok(res, { reply: responseText }, 'Thành công')
  } catch (error) {
    console.error('Chatbot Controller Error:', error)
    return fail(res, 500, 'Lỗi hệ thống khi gọi Gemini API')
  }
}
