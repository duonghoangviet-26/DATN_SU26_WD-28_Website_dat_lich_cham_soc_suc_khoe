import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, Mic, MicOff, Sun, Moon, Move } from 'lucide-react'
import type { DoctorProfile } from '@/types'
import { fallbackLLM } from '@/services/chatbot.service'
import { patientBookingService } from '@/services/patient-booking.service'
import { useChatHistory } from '@/hooks/useChatHistory'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useChatTheme } from '@/hooks/useChatTheme'
import { useDraggable } from '@/hooks/useDraggable'
import {
  parseDoctorIntent,
  parseDateTimeIntent,
  parsePriceIntent,
  parseNavigationIntent,
  parseAdminReportIntent,
  parseGeneralAvailabilityIntent,
  parseHowToBookIntent,
  parseListServicesIntent
} from '@/utils/chatbotIntent'
import { format } from 'date-fns'
import { parseMarkdownToHTML } from '@/utils/markdownParser'
import { useTypewriter } from '@/hooks/useTypewriter'

const AnimatedMarkdownText = ({ text, isNewMessage, isDark }: { text: string, isNewMessage?: boolean, isDark: boolean }) => {
  const { displayedText, isTyping } = useTypewriter(text, !!isNewMessage, { speed: 15 })
  
  // Dùng parseMarkdownToHTML tự viết
  const htmlContent = parseMarkdownToHTML(displayedText)

  return (
    <div 
      className={`prose prose-sm max-w-none text-sm ${isDark ? 'prose-invert' : ''}`}
      dangerouslySetInnerHTML={{ __html: htmlContent + (isTyping ? '<span class="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-teal-600 align-middle"></span>' : '') }}
    />
  )
}

export default function AIChatbot() {
  const navigate = useNavigate()
  
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, addMessage, groupedMessages, isLoaded } = useChatHistory()
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
    
    if (isOpen && isLoaded && messages.length === 0) {
      addMessage({
        text: 'Chào bạn, tôi là Trợ lý ảo của ViteFamily. Tôi có thể giúp bạn tìm khung giờ khám Tai Mũi Họng, xem dịch vụ hoặc đặt lịch.',
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
        addBotMessage(`Để đặt lịch khám Tai Mũi Họng, bạn thực hiện 4 bước:\n1. Chọn ngày và khung giờ còn chỗ.\n2. Điền thông tin người khám và mô tả triệu chứng.\n3. Kiểm tra, xác nhận lịch hẹn.\n4. Thanh toán qua VNPAY để giữ chỗ.\n\nBạn không cần chọn bác sĩ. Hệ thống sẽ tự phân công bác sĩ phù hợp đang có lịch trống.`, {
          label: 'Bắt đầu đặt lịch',
          route: '/booking'
        })
        return
      }

      // 0.5. Phân tích List Services
      if (parseListServicesIntent(text)) {
        addBotMessage(`VitaFamily chỉ phục vụ chuyên khoa Tai Mũi Họng. Danh mục hiện có gồm khám chuyên khoa và các kỹ thuật Tai Mũi Họng được phòng khám cập nhật theo tình trạng hoạt động. Bạn có thể xem bảng dịch vụ để biết mô tả và chi phí hiện tại.`, {
          label: 'Xem bảng giá dịch vụ',
          route: '/dich-vu'
        })
        return
      }

      // 1. Phân tích Navigation Intent
      const navIntent = parseNavigationIntent(text)
      if (navIntent) {
        if (navIntent === 'booking') {
          addBotMessage(`Bạn chỉ cần chọn ngày và khung giờ còn chỗ. Hệ thống sẽ tự phân công bác sĩ Tai Mũi Họng phù hợp theo lịch trực thực tế.`, {
            label: 'Đặt lịch khám',
            route: '/booking'
          })
        } else if (navIntent === 'doctors') {
          let docListText = ''
          doctorList.slice(0, 3).forEach(doc => {
            docListText += `\n- Bác sĩ **${doc.ho_ten}** - Phí khám: ${formatCurrency(doc.gia_kham)}`
          })
          addBotMessage(`Dưới đây là một số bác sĩ Tai Mũi Họng để bạn tham khảo thông tin chuyên môn. Khi đặt lịch, hệ thống vẫn tự phân công bác sĩ theo khung giờ còn trống:${docListText}`, {
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

        const availableDocs: { doc: DoctorProfile, times: string }[] = []
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
           } catch {
             // Bỏ qua bác sĩ không tải được lịch để tiếp tục kiểm tra các lịch còn lại.
           }
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
    const suggestions = ['Tôi muốn đặt lịch', 'Khung giờ nào còn trống?', 'Khám tai giá dưới 300k', 'Hồ sơ bệnh án của tôi']
    
    return (
      <div className={`flex flex-wrap gap-2 p-3 border-t transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
        {suggestions.map((s, i) => (
          <button key={i} type="button" onClick={() => {
            setInputValue(s)
          }} className={`min-h-11 rounded-full border px-3 py-2 text-xs transition-colors ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-teal-500/30 hover:bg-teal-900/30 hover:text-teal-300' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700'}`}>
            {s}
          </button>
        ))}
      </div>
    )
  }

  return (
    <>
      <AnimatePresence>
      {!isOpen && <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/50"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        aria-label="Mở trợ lý đặt lịch"
      >
        <div className="relative h-full w-full rounded-full overflow-hidden border-[3px] border-white shadow-md bg-teal-50">
           <img src="/images/robot-avatar.png" alt="Trợ lý ảo" className="h-full w-full object-cover" />
        </div>
        <span className="absolute -right-1 -top-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-red-500"></span>
        </span>
      </motion.button>}
      </AnimatePresence>

      <AnimatePresence>
      {isOpen && <motion.div
        className={`fixed bottom-6 right-6 z-50 flex w-80 origin-bottom-right flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-96 ${isDragging ? 'opacity-90' : ''}`}
        style={{ height: '500px', maxHeight: 'calc(100vh - 48px)' }}
        initial={{ opacity: 0, scale: 0.96, x: position.x, y: position.y }}
        animate={{ opacity: isDragging ? 0.9 : 1, scale: 1, x: position.x, y: position.y }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: isDragging ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        
        {/* Header */}
        <div 
          className="z-20 flex cursor-move select-none items-center justify-between bg-teal-700 p-4 text-white shadow-md transition-colors active:bg-teal-800"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.3)] overflow-hidden border-2 border-white/80">
              <img src="/images/robot-avatar.png" alt="Bot Avatar" className="h-full w-full object-cover" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-200 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-teal-700 bg-teal-400"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-wide text-white drop-shadow-sm">Trợ lý ảo ViteFamily</h3>
                <span className="rounded bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-[2px] text-[9px] font-black uppercase tracking-wider text-white shadow-sm">AI</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-teal-50/90">Sẵn sàng hỗ trợ 24/7</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="pointer-events-none mx-1 hidden text-teal-200 sm:block">
              <Move className="w-4 h-4 opacity-50" />
            </div>
            <button 
              type="button"
              onClick={toggleTheme} 
              className="flex h-11 w-11 items-center justify-center rounded-lg text-teal-50 transition-colors hover:bg-white/10 hover:text-white"
              title="Giao diện"
              aria-label={isDark ? 'Dùng giao diện sáng' : 'Dùng giao diện tối'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-teal-50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Đóng trợ lý đặt lịch">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>


        {/* Messages */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-5 transition-colors ${isDark ? 'bg-slate-900' : 'bg-slate-50/50'}`} role="log" aria-live="polite" aria-relevant="additions text" aria-label="Nội dung trò chuyện">
          {!isLoaded ? (
            <div className="flex justify-center p-4" role="status" aria-label="Đang tải nội dung trò chuyện">
              <Loader2 className="h-6 w-6 animate-spin text-teal-700 motion-reduce:animate-none" />
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
                    
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 overflow-hidden shadow-sm border border-slate-100">
                      {msg.sender === 'user' ? <UserIcon className="w-4 h-4" /> : <img src="/images/robot-avatar.png" alt="Bot" className="h-full w-full object-cover" />}
                    </div>

                    <div className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2 text-sm rounded-2xl whitespace-pre-wrap transition-colors ${msg.sender === 'user' ? 'bg-teal-700 text-white rounded-tr-sm' : isDark ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm' : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-sm'}`}>
                        {msg.sender === 'user' ? (
                          msg.text
                        ) : (
                          <AnimatedMarkdownText text={msg.text} isNewMessage={msg.isNew} isDark={isDark} />
                        )}
                      </div>
                      
                      {msg.action && (
                        <button 
                          type="button"
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
                          className={`mt-1 min-h-11 rounded-full border px-4 py-2 text-xs font-medium shadow-sm transition-colors ${isDark ? 'border-teal-500/30 bg-slate-800 text-teal-300 hover:bg-teal-900/30' : 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50'}`}
                        >
                          {msg.action.label}
                        </button>
                      )}
                      
                      {msg.doctorCards && msg.doctorCards.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto w-full py-2 max-w-[260px] no-scrollbar">
                          {msg.doctorCards.map((doc, idx) => (
                            <div key={idx} className={`flex-shrink-0 w-[200px] border rounded-xl overflow-hidden shadow-sm flex flex-col transition-colors ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className="relative flex h-20 items-center justify-center bg-teal-700">
                                <div className={`absolute -bottom-6 w-12 h-12 rounded-full p-1 shadow-md ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                                  <div className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full text-teal-700 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
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
                                  type="button"
                                  onClick={() => { navigate('/booking'); setIsOpen(false) }}
                                  className="mt-3 min-h-11 w-full rounded-lg border border-teal-200 bg-teal-50 py-2 text-xs font-medium text-teal-700 transition-colors hover:border-teal-700 hover:bg-teal-700 hover:text-white"
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
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-700 overflow-hidden shadow-sm border border-slate-100">
                  <img src="/images/robot-avatar.png" alt="Bot" className="h-full w-full object-cover" />
                </div>
                <div className="flex h-[38px] items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-700 motion-reduce:animate-none" aria-hidden="true" />
                  <span className="text-xs text-slate-500">Đang phản hồi</span>
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
              type="button"
              onClick={speechState === 'listening' ? stopListening : startListening}
              className={`p-3 rounded-xl transition-all relative ${
                speechState === 'listening' 
                  ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                  : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={speechState === 'listening' ? 'Tắt thu âm' : 'Bật thu âm'}
              aria-label={speechState === 'listening' ? 'Tắt thu âm' : 'Bật thu âm'}
            >
              {speechState === 'listening' ? (
                <>
                  <MicOff className="w-5 h-5 relative z-10" />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
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
              className={`flex-1 max-h-32 min-h-[44px] border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 resize-none transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              aria-label="Nội dung tin nhắn"
              rows={1}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Gửi tin nhắn"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </motion.div>}
      </AnimatePresence>
    </>
  )
}
