import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

async function test() {
  try {
    const key = process.env.GEMINI_API_KEY
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
    const result = await model.generateContent('hello')
    console.log('Result:', result.response.text())
  } catch (error) {
    console.error('API Error:', error)
  }
}

test()
