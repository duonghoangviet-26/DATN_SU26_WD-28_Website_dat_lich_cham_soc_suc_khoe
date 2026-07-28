import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fallbackLLM } from '@/services/chatbot.service'
import { patientBookingService } from '@/services/patient-booking.service'
import { thongKeService } from '@/services/thong-ke.service'
import {
  parseDoctorIntent,
  parseDateTimeIntent,
  parsePriceIntent,
  parseServiceIntent,
  parseNavigationIntent,
  parseAdminReportIntent,
  parseGeneralAvailabilityIntent,
} from '@/utils/chatbotIntent'
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'

interface Message {
  id: string
  text: string
  sender: 'bot' | 'user'
  action?: {
    label: string
    onClick: () => void
  }
}

export default function AIChatbot() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Chỉ lấy bác sĩ 1 lần để parse intent
  const [doctorList, setDoctorList] = useState<any[]>([])

  useEffect(() => {
    if (isOpen && doctorList.length === 0) {
      patientBookingService.getDoctors().then(docs => setDoctorList(docs)).catch(() => {})
      
      const welcomeMsg: Message = {
        id: Date.now().toString(),
        text: '👋 Chào bạn, tôi là Bot Tư Vấn Đặt Lịch của VitaFamily. Bạn cần hỗ trợ tìm bác sĩ, xem giá khám hay đặt lịch?',
        sender: 'bot'
      }
      setMessages([welcomeMsg])
    }
  }, [isOpen, doctorList.length, user?.role])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const addBotMessage = (text: string, action?: { label: string; onClick: () => void }) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'bot', action }])
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)

  const processMessage = async (text: string) => {
    setIsLoading(true)
    try {
      // 1. Phân tích Navigation Intent
      const navIntent = parseNavigationIntent(text)
      if (navIntent) {
        addBotMessage(`Tôi sẽ chuyển bạn đến trang bạn yêu cầu trong giây lát...`)
        setTimeout(() => {
          navigate(navIntent)
          setIsOpen(false)
        }, 1800)
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
             addBotMessage(`👨‍⚕️ Bác sĩ **${doc.ho_ten}** có ${slots.length} lịch trống vào ${dateIntent?.date === 'tomorrow' ? 'ngày mai' : 'hôm nay'}. Giá khám là ${formatCurrency(doc.gia_kham)}.`, {
               label: 'Đặt lịch ngay',
               onClick: () => { navigate(`/client/booking?doctorId=${doc.id}`); setIsOpen(false) }
             })
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
          addBotMessage(`Tôi tìm thấy ${affordableDocs.length} bác sĩ có giá khám dưới ${formatCurrency(priceIntent.maxPrice!)}: \n${affordableDocs.map(d => `- BS ${d.ho_ten} (${formatCurrency(d.gia_kham)})`).join('\n')}`, {
            label: 'Xem danh sách',
            onClick: () => { navigate('/client/doctors'); setIsOpen(false) }
          })
          return
        } else {
          addBotMessage(`Không tìm thấy bác sĩ nào có mức giá dưới ${formatCurrency(priceIntent.maxPrice!)} cả.`)
          return
        }
      }

      // Check general availability
      if (parseGeneralAvailabilityIntent(text)) {
        addBotMessage('Hôm nay chúng tôi có các bác sĩ đang trực hoặc nhận đặt lịch. Xin vui lòng xem danh sách bác sĩ để chọn giờ khám phù hợp.', {
          label: 'Xem danh sách Bác sĩ',
          onClick: () => { navigate('/bac-si'); setIsOpen(false) }
        })
        return
      }

      // 4. Fallback LLM (Pollinations AI)
      // Check medical privacy condition
      const isHealthIssue = /(đau|nhức|ho|sốt|khó thở|mệt mỏi|bệnh)/i.test(text)
      if (isHealthIssue) {
         addBotMessage(`🩺 Có vẻ bạn đang gặp vấn đề về sức khỏe. Bạn nên đặt lịch khám sớm để bác sĩ kiểm tra trực tiếp. (Lưu ý: Tư vấn này không thay thế chẩn đoán y khoa)`, {
           label: 'Đặt lịch khám ngay',
           onClick: () => { navigate('/client/booking'); setIsOpen(false) }
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
    setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }])
    setInputValue('')
    processMessage(text)
  }

  const renderSuggestions = () => {
    const suggestions = ['Tôi muốn đặt lịch', 'Bác sĩ nào rảnh hôm nay?', 'Khám tai giá dưới 300k', 'Hồ sơ bệnh án của tôi']
    
    return (
      <div className="flex flex-wrap gap-2 p-3 border-t border-slate-100 bg-slate-50">
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => {
            setInputValue(s)
          }} className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors">
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
        className={`fixed bottom-6 right-6 z-50 p-4 bg-emerald-600 text-white rounded-full shadow-xl hover:bg-emerald-700 transition-transform ${isOpen ? 'scale-0' : 'scale-100'} hover:scale-110 flex items-center justify-center`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      <div className={`fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 transition-all duration-300 transform origin-bottom-right flex flex-col overflow-hidden ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`} style={{ height: '500px', maxHeight: 'calc(100vh - 48px)' }}>
        
        {/* Header */}
        <div className="bg-emerald-600 text-white p-4 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">VitaFamily Bot</h3>
              <p className="text-xs text-emerald-100 opacity-90">Tư Vấn Đặt Lịch</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-emerald-100 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.sender === 'user' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                  {msg.sender === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2 text-sm rounded-2xl whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-sm'}`}>
                    {/* Simplified markdown parsing for bold */}
                    {msg.text.split(/(\*\*.*?\*\*)/).map((part, i) => 
                      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
                    )}
                  </div>
                  
                  {msg.action && (
                    <button onClick={msg.action.onClick} className="mt-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 px-4 py-1.5 rounded-full text-xs font-medium shadow-sm transition-colors">
                      {msg.action.label}
                    </button>
                  )}
                </div>
              </div>
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
        <div className="border-t border-slate-200 bg-white shadow-sm z-10">
          {renderSuggestions()}
          <div className="p-3 flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Nhập tin nhắn..."
              className="flex-1 max-h-32 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
