import { useState, useEffect, useRef } from 'react'

interface UseTypewriterOptions {
  speed?: number
  onComplete?: () => void
}

export function useTypewriter(text: string, isNewMessage: boolean, options?: UseTypewriterOptions) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(isNewMessage)
  
  const indexRef = useRef(0)
  const timerRef = useRef<any>(null)
  const speed = options?.speed || 20
  const onComplete = options?.onComplete

  useEffect(() => {
    // Nếu không phải tin nhắn mới (load từ lịch sử) => render full luôn
    if (!isNewMessage) {
      setDisplayedText(text)
      setIsTyping(false)
      return
    }

    // Reset state khi text thay đổi
    setDisplayedText('')
    setIsTyping(true)
    indexRef.current = 0

    const typeNextChar = () => {
      if (indexRef.current < text.length) {
        const char = text.charAt(indexRef.current)
        setDisplayedText((prev) => prev + char)
        indexRef.current++

        // Logic điều chỉnh tốc độ tự nhiên
        // Gặp dấu câu thì dừng lâu hơn 1 chút
        let nextSpeed = speed
        if (char === '.' || char === '!' || char === '?') {
          nextSpeed = speed * 15
        } else if (char === ',' || char === ';') {
          nextSpeed = speed * 8
        } else if (char === '\n') {
          nextSpeed = speed * 10
        }

        timerRef.current = setTimeout(typeNextChar, nextSpeed)
      } else {
        setIsTyping(false)
        onComplete?.()
      }
    }

    // Start typing
    timerRef.current = setTimeout(typeNextChar, speed)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [text, isNewMessage, speed, onComplete])

  return { displayedText, isTyping }
}
