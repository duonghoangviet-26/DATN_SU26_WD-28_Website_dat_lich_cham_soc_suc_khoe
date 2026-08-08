import { motion } from 'framer-motion'
import { ShieldCheck, CalendarClock, CreditCard, UserCheck, AlertCircle } from 'lucide-react'

export default function Policy() {
  const policies = [
    {
      title: 'Chính sách bảo mật thông tin',
      icon: ShieldCheck,
      content: (
        <>
          <p className="mb-4">Phòng khám ViteFamily cam kết bảo vệ tuyệt đối thông tin cá nhân và hồ sơ bệnh án của tất cả bệnh nhân. Chúng tôi tuân thủ nghiêm ngặt các quy định pháp luật về bảo mật dữ liệu y tế.</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>Thông tin cá nhân (họ tên, số điện thoại, địa chỉ, email) chỉ được thu thập nhằm mục đích phục vụ cho quá trình đăng ký khám, thông báo lịch hẹn và hỗ trợ tư vấn.</li>
            <li>Hồ sơ bệnh án được mã hóa và lưu trữ an toàn trên hệ thống máy chủ nội bộ có tính bảo mật cao.</li>
            <li>Chúng tôi tuyệt đối không mua bán, trao đổi hoặc cung cấp dữ liệu của bệnh nhân cho bên thứ ba với mục đích thương mại.</li>
            <li>Thông tin chỉ được cung cấp cho cơ quan nhà nước có thẩm quyền khi có yêu cầu bằng văn bản hợp pháp.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Quy định đặt lịch và đến khám',
      icon: CalendarClock,
      content: (
        <>
          <p className="mb-4">Để đảm bảo quy trình vận hành trơn tru và tiết kiệm thời gian chờ đợi cho quý khách, vui lòng lưu ý các quy định sau khi đặt lịch:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>Bệnh nhân nên đặt lịch hẹn qua hệ thống website hoặc hotline trước ít nhất 2 giờ so với thời gian mong muốn đến khám.</li>
            <li>Hệ thống sẽ gửi tin nhắn SMS hoặc Zalo xác nhận lịch hẹn thành công cùng với mã số khám.</li>
            <li>Vui lòng có mặt tại phòng khám trước 15 phút so với giờ hẹn để hoàn tất thủ tục đăng ký tại quầy lễ tân.</li>
            <li>Nếu đến muộn quá 15 phút so với giờ hẹn, lịch khám có thể bị hủy hoặc được sắp xếp chuyển sang khung giờ trống tiếp theo (tùy thuộc vào tình trạng thực tế của phòng khám lúc đó).</li>
            <li>Trong trường hợp có việc đột xuất không thể đến đúng lịch, bệnh nhân vui lòng chủ động hủy hoặc dời lịch trên hệ thống trước 1 giờ.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Quy định thanh toán và hoàn phí',
      icon: CreditCard,
      content: (
        <>
          <p className="mb-4">ViteFamily áp dụng các hình thức thanh toán linh hoạt, minh bạch và an toàn nhất cho người bệnh.</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li><strong>Hình thức thanh toán:</strong> Chấp nhận thanh toán bằng tiền mặt, chuyển khoản ngân hàng, thẻ ATM/Visa/Mastercard, và ví điện tử (VNPAY, Momo).</li>
            <li><strong>Chính sách minh bạch:</strong> Tất cả chi phí khám, xét nghiệm, nội soi, và tiểu phẫu đều được niêm yết công khai. Bác sĩ sẽ tư vấn rõ ràng về chi phí trước khi chỉ định bất kỳ dịch vụ phát sinh nào. Bệnh nhân có quyền từ chối nếu không đồng ý.</li>
            <li><strong>Hoàn phí đặt lịch (đối với dịch vụ thu tiền trước):</strong> 
              <ul className="list-[circle] pl-5 mt-2 space-y-1">
                <li>Hoàn 100% nếu bệnh nhân hủy lịch trước 12 giờ.</li>
                <li>Không áp dụng hoàn tiền nếu bệnh nhân không đến khám mà không thông báo hủy lịch trước.</li>
                <li>Tiền hoàn sẽ được chuyển lại qua tài khoản ngân hàng trong vòng 3-5 ngày làm việc.</li>
              </ul>
            </li>
          </ul>
        </>
      ),
    },
    {
      title: 'Quyền và nghĩa vụ của bệnh nhân',
      icon: UserCheck,
      content: (
        <>
          <p className="mb-4">Sự tôn trọng và hợp tác giữa bệnh nhân và đội ngũ y bác sĩ là chìa khóa để việc điều trị đạt hiệu quả cao nhất.</p>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">Quyền lợi</h4>
              <ul className="list-disc pl-5 space-y-2 text-slate-600 text-sm">
                <li>Được đối xử công bằng, tôn trọng, không phân biệt đối xử.</li>
                <li>Được giải thích rõ ràng về tình trạng bệnh, phương pháp điều trị, và các rủi ro có thể xảy ra.</li>
                <li>Được bảo vệ sự riêng tư trong suốt quá trình thăm khám.</li>
                <li>Được quyền khiếu nại, góp ý về thái độ phục vụ của nhân viên và bác sĩ.</li>
              </ul>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">Nghĩa vụ</h4>
              <ul className="list-disc pl-5 space-y-2 text-slate-600 text-sm">
                <li>Cung cấp thông tin trung thực về tiền sử bệnh lý, dị ứng thuốc.</li>
                <li>Tuân thủ tuyệt đối phác đồ điều trị và hướng dẫn uống thuốc của bác sĩ.</li>
                <li>Giữ gìn trật tự, vệ sinh chung và tôn trọng quy định nội quy phòng khám.</li>
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
