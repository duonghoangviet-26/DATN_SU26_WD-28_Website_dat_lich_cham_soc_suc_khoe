import { motion } from 'framer-motion'
import { Users, Shield, HeartPulse, Award, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AboutUs() {
  const stats = [
    { id: 1, name: 'Khách hàng tin tưởng', value: '50,000+' },
    { id: 2, name: 'Bác sĩ chuyên khoa', value: '20+' },
    { id: 3, name: 'Năm kinh nghiệm', value: '15+' },
    { id: 4, name: 'Tỷ lệ hài lòng', value: '99%' },
  ]

  const values = [
    {
      name: 'Tận tâm chăm sóc',
      description: 'Mỗi bệnh nhân đều được chăm sóc bằng sự thấu hiểu và đồng cảm sâu sắc nhất từ đội ngũ y bác sĩ.',
      icon: HeartPulse,
    },
    {
      name: 'Chuyên môn hàng đầu',
      description: 'Liên tục cập nhật kiến thức y khoa mới nhất, tuân thủ nghiêm ngặt phác đồ điều trị chuẩn quốc tế.',
      icon: Award,
    },
    {
      name: 'Minh bạch rõ ràng',
      description: 'Mọi thông tin về bệnh lý, phương pháp điều trị và chi phí đều được tư vấn công khai, minh bạch.',
      icon: Shield,
    },
    {
      name: 'Phục vụ chu đáo',
      description: 'Quy trình tinh gọn, tiết kiệm thời gian chờ đợi. Hỗ trợ khách hàng 24/7 với thái độ nhiệt tình nhất.',
      icon: Star,
    },
  ]

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-teal-900 py-24 text-white sm:py-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-no-repeat opacity-20 mix-blend-overlay"></div>
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Về ViteFamily
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-teal-100"
          >
            Phòng khám chuyên khoa Tai Mũi Họng hàng đầu, mang đến dịch vụ chăm sóc sức khỏe chất lượng cao, an toàn và tận tâm cho mọi gia đình Việt.
          </motion.p>
        </div>
      </section>

      {/* Story Section */}
      <section className="overflow-hidden py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-16 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:pr-8 lg:pt-4"
            >
              <h2 className="text-base font-semibold leading-7 text-teal-600">Câu chuyện của chúng tôi</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Hành trình 15 năm vì sức khỏe cộng đồng</p>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Được thành lập từ năm 2011, ViteFamily khởi nguồn từ một phòng khám nhỏ với mong muốn mang lại dịch vụ y tế tận tâm, chuyên nghiệp cho người dân. Trải qua hơn một thập kỷ không ngừng nỗ lực, chúng tôi tự hào trở thành một trong những hệ thống phòng khám chuyên khoa Tai Mũi Họng uy tín nhất tại Hà Nội.
              </p>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Sự tin tưởng của hàng chục ngàn bệnh nhân chính là động lực to lớn nhất để đội ngũ y bác sĩ ViteFamily liên tục đổi mới, áp dụng các công nghệ điều trị tiên tiến trên thế giới vào quá trình khám chữa bệnh tại Việt Nam.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img
                src="https://images.unsplash.com/photo-1551076805-e1869045e55b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
                alt="Đội ngũ bác sĩ ViteFamily"
                className="w-[48rem] max-w-none rounded-2xl shadow-xl ring-1 ring-slate-900/10 sm:w-[57rem] md:-ml-4 lg:-ml-0"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-teal-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <motion.div 
                key={stat.id} 
                className="mx-auto flex max-w-xs flex-col gap-y-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: stat.id * 0.1 }}
              >
                <dt className="text-base leading-7 text-slate-600">{stat.name}</dt>
                <dd className="order-first text-4xl font-bold tracking-tight text-teal-700 sm:text-5xl">
                  {stat.value}
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-teal-600">Giá trị cốt lõi</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Nền tảng vững chắc cho mọi dịch vụ
            </p>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Mỗi quyết định và hành động của tập thể nhân viên ViteFamily đều dựa trên 4 giá trị cốt lõi, nhằm mang lại trải nghiệm khám chữa bệnh hoàn hảo nhất.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
              {values.map((value, index) => (
                <motion.div 
                  key={value.name} 
                  className="flex flex-col items-center text-center lg:items-start lg:text-left"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100">
                    <value.icon className="h-7 w-7 text-teal-700" aria-hidden="true" />
                  </div>
                  <dt className="text-xl font-semibold leading-7 text-slate-900">
                    {value.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                    <p className="flex-auto">{value.description}</p>
                  </dd>
                </motion.div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-slate-900">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Bạn đang gặp vấn đề về sức khỏe?
              <br />
              Hãy để chúng tôi chăm sóc bạn.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Đội ngũ bác sĩ chuyên khoa luôn sẵn sàng tư vấn và thăm khám. Đặt lịch trực tuyến ngay hôm nay để tiết kiệm thời gian chờ đợi.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-x-6">
              <Link
                to="/booking"
                className="w-full sm:w-auto rounded-full bg-teal-600 px-8 py-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 transition-all"
              >
                Đặt lịch khám ngay
              </Link>
              <Link to="/bac-si" className="w-full sm:w-auto text-sm font-semibold leading-6 text-white hover:text-teal-300 transition-colors">
                Tìm hiểu đội ngũ bác sĩ <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
