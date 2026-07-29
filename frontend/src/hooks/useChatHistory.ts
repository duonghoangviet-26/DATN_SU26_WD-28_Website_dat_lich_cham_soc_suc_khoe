import { useState, useEffect, useCallback } from 'react'

export interface ChatMessage {
  id: string
  text: string
  sender: 'bot' | 'user'
  timestamp: number
  isNew?: boolean
  action?: {
    label: string
    onClickRoute?: string
    onClickSend?: string
  }
  doctorCards?: any[]
}

const STORAGE_KEY = 'vf_chat_history_enc'
const SESSION_TIMEOUT_MINUTES = 10

// Mã hóa đơn giản: dịch chuyển ký tự (Caesar cipher cơ bản)
// Trong môi trường thực tế, nên dùng Crypto API hoặc thư viện chuyên dụng
const encryptData = (data: string): string => {
  return btoa(
    encodeURIComponent(data).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
}

const decryptData = (data: string): string => {
  try {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(data), (c) =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        )
        .join('')
    )
  } catch (error) {
    console.error('Lỗi giải mã lịch sử chat:', error)
    return '[]'
  }
}

export function useChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Đọc dữ liệu từ localStorage khi mount
  useEffect(() => {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY)
      if (rawData) {
        const decoded = decryptData(rawData)
        const parsed: ChatMessage[] = JSON.parse(decoded)
        
        // Xóa lịch sử nếu phiên chat cuối cùng cách đây hơn 10 phút
        const now = Date.now()
        if (parsed.length > 0 && (now - parsed[parsed.length - 1].timestamp > SESSION_TIMEOUT_MINUTES * 60 * 1000)) {
           localStorage.removeItem(STORAGE_KEY)
           setMessages([])
           setIsLoaded(true)
           return
        }

        const filtered = parsed
        
        setMessages(filtered)
      }
    } catch (err) {
      console.error('Không thể load lịch sử chat', err)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Lưu dữ liệu vào localStorage mỗi khi messages thay đổi
  useEffect(() => {
    if (isLoaded) {
      try {
        const jsonStr = JSON.stringify(messages)
        localStorage.setItem(STORAGE_KEY, encryptData(jsonStr))
      } catch (err) {
        console.error('Không thể lưu lịch sử chat', err)
      }
    }
  }, [messages, isLoaded])

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp' | 'isNew'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        isNew: true
      }
    ])
  }, [])

  const clearHistory = useCallback(() => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Phân nhóm tin nhắn theo ngày
  const groupedMessages = useCallback(() => {
    const groups: { dateLabel: string; messages: ChatMessage[] }[] = []
    
    messages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      let dateLabel = msgDate.toLocaleDateString('vi-VN')
      
      if (msgDate.toDateString() === today.toDateString()) {
        dateLabel = 'Hôm nay'
      } else if (msgDate.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Hôm qua'
      }
      
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && lastGroup.dateLabel === dateLabel) {
        lastGroup.messages.push(msg)
      } else {
        groups.push({ dateLabel, messages: [msg] })
      }
    })
    
    return groups
  }, [messages])

  return {
    messages,
    addMessage,
    clearHistory,
    groupedMessages: groupedMessages(),
    isLoaded
  }
}
