async function test() {
  const prompt = "hello";
  const systemPrompt = `Bạn là trợ lý ảo y tế của phòng khám VitaFamily. 
Hãy trả lời ngắn gọn, thân thiện, dùng định dạng Markdown.
Nếu người dùng hỏi thông tin cụ thể mà không có trong dữ liệu, hãy hướng dẫn họ liên hệ trực tiếp số hotline 0365 747888.
Tuyệt đối KHÔNG yêu cầu thông tin cá nhân (SĐT, tên, bệnh lý) của người dùng.
Thông tin tham khảo (nếu có): Không có thêm thông tin`
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=mistral`
  try {
    console.log("Testing URL:", url);
    const res = await fetch(url);
    const text = await res.text();
    console.log("Result:", text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
