import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Send, MessageSquare, Image as ImageIcon, X } from 'lucide-react'
import { feedbackService } from '@/services/feedback.service'
import { message } from 'antd'

export default function Feedback() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setPreviewUrl(null)
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    const formData = new FormData(e.currentTarget)
    const ho_ten = formData.get('name') as string
    const email_sdt = formData.get('email') as string
    const noi_dung = formData.get('message') as string

    if (!ho_ten || !email_sdt || !noi_dung) {
      message.error('Vui lòng điền đầy đủ các thông tin bắt buộc.')
      return
    }

    setIsSubmitting(true)
    try {
      let hinh_anh = null
      if (selectedImage) {
        hinh_anh = await fileToBase64(selectedImage)
      }

      await feedbackService.createFeedback({
        ho_ten,
        email_sdt,
        noi_dung,
        hinh_anh
      })

      message.success('Cảm ơn bạn đã gửi phản hồi!')
      
      // Reset form
      if (formRef.current) formRef.current.reset()
      removeImage()
    } catch (error) {
      console.error(error)
      message.error('Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại sau.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-[#f7faf9] py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-10"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <MessageSquare size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gửi phản hồi</h1>
              <p className="text-sm text-slate-500">Chúng tôi luôn lắng nghe để phục vụ bạn tốt hơn</p>
            </div>
          </div>
          
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">Họ và tên *</label>
              <div className="mt-2">
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  className="block w-full rounded-xl border-0 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm"
                  placeholder="Nguyễn Văn A"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email hoặc số điện thoại *</label>
              <div className="mt-2">
                <input
                  type="text"
                  name="email"
                  id="email"
                  required
                  className="block w-full rounded-xl border-0 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm"
                  placeholder="contact@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-slate-700">Nội dung phản hồi *</label>
              <div className="mt-2">
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  className="block w-full rounded-xl border-0 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm"
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Đính kèm hình ảnh (không bắt buộc)</label>
              <div className="mt-2 flex items-center gap-4">
                <label htmlFor="image-upload" className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors ${isSubmitting ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-50'}`}>
                  <ImageIcon size={18} className="text-slate-500" />
                  <span>Chọn ảnh tải lên</span>
                  <input
                    id="image-upload"
                    name="image-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                  />
                </label>
                
                {previewUrl && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={isSubmitting}
                      className="absolute right-0 top-0 flex h-6 w-6 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                      title="Xóa ảnh"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Send size={18} />
              {isSubmitting ? 'Đang gửi...' : 'Gửi ý kiến'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

