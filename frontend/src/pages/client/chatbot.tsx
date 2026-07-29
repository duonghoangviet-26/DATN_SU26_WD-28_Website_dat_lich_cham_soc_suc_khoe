import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, Mic, MicOff, Sun, Moon, Move } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fallbackLLM } from '@/services/chatbot.service'
import { patientBookingService, type PatientBookingDoctor } from '@/services/patient-booking.service'
import { thongKeService } from '@/services/thong-ke.service'
import { useChatHistory } from '@/hooks/useChatHistory'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useChatTheme } from '@/hooks/useChatTheme'
import { useDraggable } from '@/hooks/useDraggable'
import {
  parseDoctorIntent,
  parseDateTimeIntent,
  parsePriceIntent,
  parseServiceIntent,
  parseNavigationIntent,
  parseAdminReportIntent,
  parseGeneralAvailabilityIntent,
  parseHowToBookIntent,
  parseListServicesIntent
} from '@/utils/chatbotIntent'
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { parseMarkdownToHTML } from '@/utils/markdownParser'
import { useTypewriter } from '@/hooks/useTypewriter'

const AnimatedMarkdownText = ({ text, isNewMessage, isDark }: { text: string, isNewMessage?: boolean, isDark: boolean }) => {
  const { displayedText, isTyping } = useTypewriter(text, !!isNewMessage, { speed: 15 })
  
  // Dùng parseMarkdownToHTML tự viết
  const htmlContent = parseMarkdownToHTML(displayedText)

  return (
    <div 
      className={`prose prose-sm prose-blue max-w-none text-sm ${isDark ? 'prose-invert' : ''}`}
      dangerouslySetInnerHTML={{ __html: htmlContent + (isTyping ? '<span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle"></span>' : '') }}
    />
  )
}

export default function AIChatbot() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, addMessage, clearHistory, groupedMessages, isLoaded } = useChatHistory()
  const { text: speechText, state: speechState, startListening, stopListening, resetSpeech, errorMsg: speechError } = useSpeechRecognition()
  const { isDark, toggleTheme } = useChatTheme()
  const { position, isDragging, handleMouseDown } = useDraggable()

  useEffect(() => {
    if (speechText) {
      setInputValue(prev => prev ? prev + ' ' + speechText : speechText)
    }
  }, [speechText])

  useEffect(() => {
    if (speechError) {
      addMessage({ text: `❌ Lỗi Micro: ${speechError}`, sender: 'bot' })
      resetSpeech()
    }
  }, [speechError, addMessage, resetSpeech])

  // Chỉ lấy bác sĩ 1 lần để parse intent
  const [doctorList, setDoctorList] = useState<any[]>([])

  useEffect(() => {
    if (isOpen && doctorList.length === 0) {
      patientBookingService.getDoctors().then(docs => setDoctorList(docs)).catch(() => {})
    }
    
    // Khởi tạo tin nhắn chào mừng nếu lịch sử trống
    if (isOpen && isLoaded && messages.length === 0) {
      addMessage({
        text: '👋 Chào bạn, tôi là Bot Tư Vấn Đặt Lịch của VitaFamily. Bạn cần hỗ trợ tìm bác sĩ, xem giá khám hay đặt lịch?',
        sender: 'bot'
      })
    }
  }, [isOpen, doctorList.length, isLoaded, messages.length, addMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, isOpen])

  const addBotMessage = (text: string, actionData?: { label: string; route?: string; send?: string }, doctorCards?: any[]) => {
    addMessage({
      text,
      sender: 'bot',
      action: actionData ? { label: actionData.label, onClickRoute: actionData.route, onClickSend: actionData.send } : undefined,
      doctorCards
    })
  }

  
  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)

  const processMessage = async (text: string) => {
    setIsLoading(true)
    try {
      // 0. Phân tích How to book
      if (parseHowToBookIntent(text)) {
        addBotMessage(`Để đặt lịch khám, bạn làm theo 3 bước sau nhé:\n1. Chọn Bác sĩ bạn muốn khám ở phía dưới.\n2. Bấm vào nút **Đặt lịch khám** trên thẻ của bác sĩ.\n3. Chọn ngày, giờ khám, điền thông tin và thanh toán.\n\nBạn có muốn xem danh sách bác sĩ luôn không?`, {
          label: 'Xem danh sách Bác sĩ',
          send: 'xem bác sĩ'
        })
        return
      }

      // 0.5. Phân tích List Services
      if (parseListServicesIntent(text)) {
        addBotMessage(`VitaFamily hiện đang cung cấp các dịch vụ chuyên khoa chính:\n- Khám Tai\n- Khám Mũi\n- Khám Họng\n- Nội soi Tai Mũi Họng\n- Xét nghiệm và Nội tiết\n\nBạn quan tâm đến dịch vụ nào? Bạn có thể yêu cầu đặt lịch khám ngay!`, {
          label: 'Xem bảng giá dịch vụ',
          route: '/dich-vu'
        })
        return
      }

      // 1. Phân tích Navigation Intent
      const navIntent = parseNavigationIntent(text)
      if (navIntent) {
        if (navIntent === 'booking' || navIntent === 'doctors') {
          let docListText = ''
          doctorList.slice(0, 3).forEach(doc => {
            docListText += `\n- Bác sĩ **${doc.ho_ten}** - Phí khám: ${formatCurrency(doc.gia_kham)}`
          })
          addBotMessage(`Dưới đây là danh sách các bác sĩ chuyên khoa của chúng tôi. Vui lòng chọn một bác sĩ để xem chi tiết hoặc tiến hành đặt lịch:${docListText}`, {
            label: 'Xem tất cả Bác sĩ',
            route: '/bac-si'
          }, doctorList.slice(0, 3))
        } else if (navIntent === 'profile') {
          addBotMessage(`Bạn có thể xem chi tiết hồ sơ bệnh án và lịch sử khám bệnh của mình bằng cách truy cập vào trang Hồ Sơ bên dưới.`, {
            label: 'Xem Hồ Sơ',
            route: '/profile'
          })
        } else if (navIntent === 'admin') {
          addBotMessage(`Bạn đang yêu cầu truy cập hệ thống Quản trị nội bộ. Vui lòng nhấn vào nút bên dưới nếu bạn có quyền truy cập:`, {
            label: 'Vào trang Admin',
            route: '/admin'
          })
        }
        return
      }

      // 2. Tắt chức năng Admin Intent vì đây là bot cho Client
      const adminIntent = parseAdminReportIntent(text)
      if (adminIntent) {
        addBotMessage('🔒 Xin lỗi, tính năng báo cáo doanh thu và lịch khám chỉ dành cho Admin. Vui lòng sử dụng trang quản trị nội bộ.')
        return
      }

      // 3. User Intent (Doctor, Price, Date)
      const docNames = doctorList.map(d => d.ho_ten)
      const targetDoctor = parseDoctorIntent(text, docNames)
      
      let contextStr = ''
      
      if (targetDoctor) {
        const doc = doctorList.find(d => parseDoctorIntent(targetDoctor, [d.ho_ten]))
        if (doc) {
          const dateIntent = parseDateTimeIntent(text)
          // Lấy giờ trống của bác sĩ này
          const targetDate = dateIntent?.date === 'tomorrow' ? new Date(Date.now() + 86400000) : new Date()
          const slots = await patientBookingService.getSlots(doc.id, format(targetDate, 'yyyy-MM-dd'))
          
          if (slots.length > 0) {
             const timeStr = slots.map(s => s.gio_bat_dau.slice(0, 5)).join(', ')
             addBotMessage(`👨‍⚕️ Bác sĩ **${doc.ho_ten}** có ${slots.length} lịch trống vào ${dateIntent?.date === 'tomorrow' ? 'ngày mai' : 'hôm nay'} (Các giờ: ${timeStr}).`, undefined, [doc])
             return
          } else {
             addBotMessage(`👨‍⚕️ Rất tiếc, Bác sĩ **${doc.ho_ten}** không có lịch trống vào ${dateIntent?.date === 'tomorrow' ? 'ngày mai' : 'hôm nay'}. Bạn có muốn xem bác sĩ khác không?`)
             return
          }
        }
      }

      const priceIntent = parsePriceIntent(text)
      if (priceIntent?.maxPrice) {
        const affordableDocs = doctorList.filter(d => d.gia_kham <= priceIntent.maxPrice!)
        if (affordableDocs.length > 0) {
          addBotMessage(`Tôi tìm thấy ${affordableDocs.length} bác sĩ có giá khám dưới ${formatCurrency(priceIntent.maxPrice!)}:`, undefined, affordableDocs)
          return
        } else {
          addBotMessage(`Không tìm thấy bác sĩ nào có mức giá dưới ${formatCurrency(priceIntent.maxPrice!)} cả.`)
          return
        }
      }

      // Check general availability
      if (parseGeneralAvailabilityIntent(text)) {
        const dateIntent = parseDateTimeIntent(text)
        let timeStr = 'Hiện tại'
        const targetDate = dateIntent?.date === 'tomorrow' ? new Date(Date.now() + 86400000) : new Date()

        if (dateIntent) {
           const d = dateIntent.date === 'tomorrow' ? 'ngày mai' : 'hôm nay'
           const h = dateIntent.hour ? ` lúc ${dateIntent.hour}h` : ''
           timeStr = `Vào ${d}${h}`
        }

        const availableDocs: { doc: PatientBookingDoctor, times: string }[] = []
        // Chỉ quét 5 bác sĩ đầu tiên để tăng tốc độ phản hồi
        for (const doc of doctorList.slice(0, 5)) {
           try {
             const slots = await patientBookingService.getSlots(doc.id, format(targetDate, 'yyyy-MM-dd'))
             const matchedSlots = dateIntent?.hour 
               ? slots.filter(s => s.gio_bat_dau.startsWith(dateIntent.hour!.padStart(2, '0') + ':'))
               : slots
               
             if (matchedSlots.length > 0) {
                const times = matchedSlots.map(s => s.gio_bat_dau.slice(0, 5)).join(', ')
                availableDocs.push({ doc, times })
             }
           } catch(e) {}
        }

        if (availableDocs.length === 0) {
           addBotMessage(`Rất tiếc, ${timeStr.toLowerCase()} không còn lịch trống nào. Bạn có muốn đổi sang giờ khác hoặc ngày mai không?`)
           return
        }

        let docListText = ''
        availableDocs.slice(0, 3).forEach(item => {
          docListText += `\n- Bác sĩ **${item.doc.ho_ten}** (Giờ trống: ${item.times})`
        })
        
        addBotMessage(`${timeStr} có ${availableDocs.length} bác sĩ đang có lịch trống. Dưới đây là các bác sĩ nổi bật:${docListText}`, {
          label: 'Xem tất cả Bác sĩ',
          send: 'xem bác sĩ'
        }, availableDocs.slice(0, 3).map(item => item.doc))
        return
      }

      // 4. Fallback LLM (Pollinations AI)
      // Check medical privacy condition
      const isHealthIssue = /\b(đau|nhức|ho|sốt|khó thở|mệt mỏi|bệnh)\b/i.test(text)
      if (isHealthIssue) {
         addBotMessage(`🩺 Có vẻ bạn đang gặp vấn đề về sức khỏe. Bạn nên đặt lịch khám sớm để bác sĩ kiểm tra trực tiếp. (Lưu ý: Tư vấn này không thay thế chẩn đoán y khoa)`, {
           label: 'Đặt lịch khám ngay',
           route: '/booking'
         })
         // Vẫn gửi LLM nhưng nhắc nhở
         contextStr = 'Người dùng đang nêu triệu chứng bệnh, hãy khuyên họ đến khám trực tiếp.'
      }

      const response = await fallbackLLM(text, contextStr)
      addBotMessage(response)

    } catch (error) {
      console.error(error)
      addBotMessage("❌ Xin lỗi, đã có lỗi kết nối đến hệ thống. Vui lòng thử lại sau.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = () => {
    if (!inputValue.trim()) return
    const text = inputValue.trim()
    addMessage({ text, sender: 'user' })
    setInputValue('')
    processMessage(text)
  }

  const renderSuggestions = () => {
    const suggestions = ['Tôi muốn đặt lịch', 'Bác sĩ nào rảnh hôm nay?', 'Khám tai giá dưới 300k', 'Hồ sơ bệnh án của tôi']
    
    return (
      <div className={`flex flex-wrap gap-2 p-3 border-t transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => {
            setInputValue(s)
          }} className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-blue-900/30 hover:text-blue-400 hover:border-blue-500/30' : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}>
            {s}
          </button>
        ))}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition-transform ${isOpen ? 'scale-0' : 'scale-100'} hover:scale-110 flex items-center justify-center`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      <div 
        className={`fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 origin-bottom-right flex flex-col overflow-hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${isDragging ? 'transition-none opacity-90' : 'transition-all duration-300'}`} 
        style={{ height: '500px', maxHeight: 'calc(100vh - 48px)', transform: `translate(${position.x}px, ${position.y}px) scale(${isOpen ? 1 : 0})` }}
      >
        
        {/* Header */}
        <div 
          className="bg-blue-600 text-white p-4 flex items-center justify-between shadow-md z-20 cursor-move select-none active:bg-blue-700 transition-colors"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">VitaFamily Bot</h3>
              <p className="text-xs text-blue-100 opacity-90">Tư Vấn Đặt Lịch</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="text-blue-300 mx-1 hidden sm:block pointer-events-none">
              <Move className="w-4 h-4 opacity-50" />
            </div>
            <button 
              onClick={toggleTheme} 
              className="text-blue-100 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
              title="Giao diện"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Messages */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-5 transition-colors ${isDark ? 'bg-slate-900' : 'bg-slate-50/50'}`}>
          {!isLoaded ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-4">
              <div className="flex justify-center">
                <span className={`text-[10px] font-medium px-3 py-1 rounded-full shadow-sm border transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400'}`}>
                  {group.dateLabel}
                </span>
              </div>
              
              {group.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.sender === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-blue-100 text-blue-600'}`}>
                      {msg.sender === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2 text-sm rounded-2xl whitespace-pre-wrap transition-colors ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : isDark ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm' : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-sm'}`}>
                        {msg.sender === 'user' ? (
                          msg.text
                        ) : (
                          <AnimatedMarkdownText text={msg.text} isNewMessage={msg.isNew} isDark={isDark} />
                        )}
                      </div>
                      
                      {msg.action && (
                        <button 
                          onClick={() => {
                            if (msg.action?.onClickSend) {
                              const text = msg.action.onClickSend
                              addMessage({ text, sender: 'user' })
                              processMessage(text)
                            } else if (msg.action?.onClickRoute) {
                              navigate(msg.action.onClickRoute)
                              setIsOpen(false)
                            }
                          }} 
                          className={`mt-1 px-4 py-1.5 rounded-full text-xs font-medium shadow-sm transition-colors border ${isDark ? 'bg-slate-800 border-blue-500/30 text-blue-400 hover:bg-blue-900/30' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                        >
                          {msg.action.label}
                        </button>
                      )}
                      
                      {msg.doctorCards && msg.doctorCards.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto w-full py-2 max-w-[260px] no-scrollbar">
                          {msg.doctorCards.map((doc, idx) => (
                            <div key={idx} className={`flex-shrink-0 w-[200px] border rounded-xl overflow-hidden shadow-sm flex flex-col transition-colors ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className="h-20 bg-gradient-to-r from-blue-400 to-teal-500 flex items-center justify-center relative">
                                <div className={`absolute -bottom-6 w-12 h-12 rounded-full p-1 shadow-md ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                                  <div className={`w-full h-full rounded-full flex items-center justify-center text-blue-600 ${isDark ? 'bg-slate-700' : 'bg-slate-100'} overflow-hidden`}>
                                    {doc.anh_dai_dien ? (
                                      <img 
                                        src={doc.anh_dai_dien.startsWith('http') ? doc.anh_dai_dien : `http://localhost:5000${doc.anh_dai_dien.startsWith('/') ? '' : '/'}${doc.anh_dai_dien}`} 
                                        alt={doc.ho_ten} 
                                        className="w-full h-full object-cover" 
                                      />
                                    ) : (
                                      <UserIcon className="w-6 h-6" />
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="pt-8 pb-3 px-3 flex flex-col items-center text-center">
                                <h4 className={`font-bold text-sm line-clamp-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{doc.ho_ten}</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">{doc.chuyen_khoa || 'Chuyên khoa'}</p>
                                <p className="text-sm font-bold text-orange-600 mt-2">{formatCurrency(doc.gia_kham)}</p>
                                <button 
                                  onClick={() => { navigate(`/client/booking?doctorId=${doc.id}`); setIsOpen(false) }}
                                  className="mt-3 w-full bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 transition-colors py-1.5 rounded-lg text-xs font-medium"
                                >
                                  Đặt lịch ngay
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center h-[38px]">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`border-t shadow-sm z-10 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {renderSuggestions()}
          <div className="p-3 flex items-end gap-2">
            <button
              onClick={speechState === 'listening' ? stopListening : startListening}
              className={`p-3 rounded-xl transition-all relative ${
                speechState === 'listening' 
                  ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                  : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={speechState === 'listening' ? 'Tắt thu âm' : 'Bật thu âm'}
            >
              {speechState === 'listening' ? (
                <>
                  <MicOff className="w-5 h-5 relative z-10" />
                  <span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-20"></span>
                </>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={speechState === 'listening' ? 'Đang nghe...' : 'Nhập tin nhắn...'}
              className={`flex-1 max-h-32 min-h-[44px] border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
