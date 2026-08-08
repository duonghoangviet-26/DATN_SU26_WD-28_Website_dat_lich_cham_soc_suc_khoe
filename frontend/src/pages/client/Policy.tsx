import { motion } from 'framer-motion'
import { ShieldCheck, CalendarClock, CreditCard, UserCheck, AlertCircle } from 'lucide-react'

export default function Policy() {
  const policies = [
    {
      title: 'Quy định Đặt lịch khám trực tuyến',
      icon: CalendarClock,
      content: (
        <>
          <p className="mb-4">Hệ thống đặt lịch của ViteFamily được thiết kế tự động để đảm bảo tính công bằng và tối ưu thời gian cho tất cả bệnh nhân:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li><strong>Thời gian đặt trước tối thiểu:</strong> Lịch khám trực tuyến cần được đặt trước ít nhất <strong>30 phút</strong> so với giờ khám. Các suất khám trống dưới 30 phút (Cut-off T-30') sẽ tự động chuyển sang phục vụ bệnh nhân đến trực tiếp tại quầy (walk-in).</li>
            <li><strong>Thời hạn thanh toán:</strong> Sau khi đặt lịch, quý khách cần hoàn tất thanh toán trong thời gian quy định. Nếu quá hạn thanh toán, hệ thống sẽ tự động hủy lịch (auto-cancel) để nhường chỗ cho bệnh nhân khác.</li>
            <li><strong>Giờ đến khám:</strong> Vui lòng có mặt tại phòng khám trước 15 phút để hoàn tất thủ tục check-in tại quầy lễ tân.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Quy định Dời lịch khám (Reschedule)',
      icon: CalendarClock,
      content: (
        <>
          <p className="mb-4">Chúng tôi hiểu rằng quý khách có thể gặp sự cố đột xuất. Tuy nhiên, để tránh ảnh hưởng đến bệnh nhân khác, quy định dời lịch được áp dụng như sau:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li><strong>Bệnh nhân chủ động dời lịch:</strong> Mỗi lịch hẹn chỉ được phép yêu cầu dời lịch <strong>1 lần duy nhất</strong> qua hệ thống (áp dụng khi báo trước khung giờ quy định).</li>
            <li><strong>Phòng khám chủ động dời lịch:</strong> Trong trường hợp bất khả kháng (bác sĩ bận đột xuất, nghỉ phép), phòng khám sẽ gửi đề xuất lịch khám thay thế. 
              <br/><em>Đặc quyền:</em> Hệ thống luôn <strong>giữ sẵn một suất khám</strong> cho quý khách. Nếu quý khách không kịp phản hồi trước hạn chót, hệ thống sẽ <strong>tự động áp dụng phương án đã giữ sẵn</strong> để đảm bảo quý khách không bao giờ bị mất chỗ.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: 'Quy định Hủy lịch, Vắng mặt (No-show) và Hoàn phí',
      icon: CreditCard,
      content: (
        <>
          <p className="mb-4">Nhằm hạn chế tình trạng đặt chỗ ảo, phòng khám áp dụng chính sách thanh toán và hoàn phí vô cùng nghiêm ngặt:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li><strong>Vắng mặt (No-show):</strong> Nếu hết ca làm việc của bác sĩ mà bệnh nhân vẫn chưa check-in tại quầy lễ tân, hệ thống sẽ tự động quét và đánh dấu là vắng mặt (no-show). Trong trường hợp này, bệnh nhân sẽ <strong>bị trừ 100% phí khám đã thanh toán (không hoàn tiền)</strong>.</li>
            <li><strong>Điều khoản không hoàn tiền:</strong> Bệnh nhân bắt buộc phải đọc và đồng ý với điều khoản "Không hoàn tiền nếu vắng mặt" trước khi thanh toán. Việc hoàn tiền (nếu có) chỉ được xem xét nếu bệnh nhân hủy lịch từ rất sớm theo quy định, hoặc lỗi xuất phát từ phía phòng khám.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Chính sách Bảo mật thông tin',
      icon: ShieldCheck,
      content: (
        <>
          <p className="mb-4">Phòng khám ViteFamily cam kết bảo vệ tuyệt đối thông tin cá nhân và hồ sơ bệnh án của tất cả bệnh nhân.</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>Thông tin cá nhân chỉ được thu thập nhằm mục đích phục vụ quá trình đăng ký khám, thông báo lịch hẹn và hỗ trợ tư vấn y tế.</li>
            <li>Hồ sơ bệnh án được mã hóa và lưu trữ an toàn. Chúng tôi tuyệt đối không cung cấp dữ liệu của bệnh nhân cho bên thứ ba với mục đích thương mại.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Quyền và nghĩa vụ của bệnh nhân',
      icon: UserCheck,
      content: (
        <>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">Quyền lợi</h4>
              <ul className="list-disc pl-5 space-y-2 text-slate-600 text-sm">
                <li>Được đối xử công bằng, tôn trọng, không phân biệt.</li>
                <li>Được giải thích rõ ràng về tình trạng bệnh và phác đồ điều trị.</li>
                <li>Được bảo vệ sự riêng tư trong suốt quá trình thăm khám.</li>
              </ul>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">Nghĩa vụ</h4>
              <ul className="list-disc pl-5 space-y-2 text-slate-600 text-sm">
                <li>Cung cấp thông tin trung thực về tiền sử bệnh lý.</li>
                <li>Tuân thủ phác đồ điều trị và các quy định đặt lịch, check-in.</li>
                <li>Thanh toán đầy đủ viện phí theo quy định.</li>
              </ul>
            </div>
          </div>
        </>
      ),
    }
  ]

  return (
    <div className="bg-[#f7faf9] min-h-screen">
      {/* Header */}
      <div className="bg-teal-900 py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Chính sách và Quy định
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-lg text-teal-100"
          >
            ViteFamily luôn đề cao sự minh bạch, an toàn và quyền lợi hợp pháp của người bệnh. Vui lòng đọc kỹ các thông tin dưới đây.
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-12">
          {policies.map((policy, index) => (
            <motion.div 
              key={policy.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.03)] border border-slate-100"
            >
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
                  <policy.icon className="h-6 w-6 text-teal-600" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{policy.title}</h2>
              </div>
              <div className="text-base leading-7 text-slate-600 prose-p:mb-4 prose-ul:my-4 prose-li:my-2">
                {policy.content}
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-16 bg-blue-50 border border-blue-100 rounded-3xl p-8 flex gap-6 items-start">
          <AlertCircle className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Bạn cần hỗ trợ thêm?</h3>
            <p className="text-slate-600 mb-4">Nếu có bất kỳ thắc mắc nào về chính sách và quy định của chúng tôi, đừng ngần ngại liên hệ qua hotline hoặc gửi phản hồi trực tiếp cho ban quản lý phòng khám.</p>
            <div className="flex gap-4">
              <a href="tel:0365747888" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors">
                Gọi hotline 0365 747 888
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
