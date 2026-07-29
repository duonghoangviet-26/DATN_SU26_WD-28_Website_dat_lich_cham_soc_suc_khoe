import { GoogleGenerativeAI } from '@google/generative-ai'

async function test() {
  const GEMINI_API_KEY = "AQ.Ab8RN6lRilIaRQnicv1HSHLlwxGoZyvO7T47ebUlsMyhR7tz9mA"
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  try {
    const result = await model.generateContent("hello")
    const response = await result.response
    console.log(response.text())
  } catch (e) {
    console.error("Gemini test failed:", e.message)
  }
}
test()
