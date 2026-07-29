import { useState, useEffect, useCallback, useRef } from 'react'

// Mở rộng interface window để hỗ trợ Webkit trên Chrome/Safari
interface IWindow extends Window {
  SpeechRecognition: any
  webkitSpeechRecognition: any
}

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error' | 'not-supported'

export function useSpeechRecognition() {
  const [text, setText] = useState<string>('')
  const [state, setState] = useState<SpeechState>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Kiểm tra tương thích trình duyệt
    const { SpeechRecognition, webkitSpeechRecognition } = window as unknown as IWindow
    const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setState('not-supported')
      setErrorMsg('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.')
      return
    }

    try {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = false
      recognition.interimResults = true // Cập nhật text liên tục khi đang nói
      recognition.lang = 'vi-VN' // Set Tiếng Việt mặc định

      recognition.onstart = () => {
        setState('listening')
        setErrorMsg('')
        setText('')
      }

      recognition.onresult = (event: any) => {
        let currentTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript
        }
        setText(currentTranscript)
      }

      recognition.onerror = (event: any) => {
        setState('error')
        switch (event.error) {
          case 'network':
            setErrorMsg('Lỗi mạng. Không thể nhận diện giọng nói.')
            break
          case 'not-allowed':
          case 'service-not-allowed':
            setErrorMsg('Bạn chưa cấp quyền sử dụng Micro.')
            break
          case 'no-speech':
            setErrorMsg('Không nghe thấy gì. Vui lòng thử lại.')
            break
          default:
            setErrorMsg('Có lỗi xảy ra: ' + event.error)
        }
      }

      recognition.onend = () => {
        setState(prev => prev === 'listening' ? 'processing' : prev)
        setTimeout(() => {
          setState('idle')
        }, 500)
      }

      recognitionRef.current = recognition
    } catch (e) {
      setState('error')
      setErrorMsg('Lỗi khởi tạo Micro.')
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (state === 'not-supported') return
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (e) {
        // Ignored if already started
      }
    }
  }, [state])

  const stopListening = useCallback(() => {
    if (state === 'not-supported') return
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Ignored
      }
    }
  }, [state])

  const resetSpeech = useCallback(() => {
    setText('')
    setErrorMsg('')
    setState('idle')
  }, [])

  return {
    text,
    state,
    errorMsg,
    startListening,
    stopListening,
    resetSpeech
  }
}
