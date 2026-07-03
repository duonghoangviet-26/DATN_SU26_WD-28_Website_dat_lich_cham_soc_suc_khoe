import { Link } from 'react-router-dom'

const features = [
  {
    iconBg: 'bg-brand-100', iconColor: 'text-brand-600',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
    ),
    title: 'Đặt lịch khám',
    desc: 'Đặt lịch với bác sĩ chuyên khoa trong vài giây, không cần chờ đợi.',
  },
  {
    iconBg: 'bg-purple-100', iconColor: 'text-purple-600',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
    title: 'Hồ sơ y tế',
    desc: 'Lưu trữ toàn bộ lịch sử khám bệnh và đơn thuốc của cả gia đình.',
  },
  {
    iconBg: 'bg-green-100', iconColor: 'text-green-600',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: 'Nhắc uống thuốc',
    desc: 'Nhận thông báo đúng giờ để không bỏ lỡ liều thuốc nào.',
  },
  {
    iconBg: 'bg-orange-100', iconColor: 'text-orange-600',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      </svg>
    ),
    title: 'Nhiều bệnh viện',
    desc: 'Kết nối với hàng trăm bệnh viện và phòng khám trên toàn quốc.',
  },
]

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <div className="py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          Đang phát triển tính năng mới
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-tight text-slate-800 sm:text-5xl">
          Chăm sóc sức khỏe<br />
          <span className="text-brand-500">cả gia đình bạn</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
          Đặt lịch khám online, quản lý hồ sơ y tế và nhắc uống thuốc cho mọi thành viên
          trong gia đình — chỉ với một tài khoản.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/dich-vu" className="btn-primary px-6 py-2.5 text-base">
            Khám phá dịch vụ
          </Link>
          <Link to="/register" className="btn-secondary px-6 py-2.5 text-base">
            Bắt đầu miễn phí
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="card-hover p-5">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${f.iconBg} ${f.iconColor}`}>
              {f.icon}
            </div>
            <h3 className="font-semibold text-slate-800">{f.title}</h3>
            <p className="mt-1.5 text-sm text-slate-500">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-slate-400">
        * Một số tính năng (đặt lịch, thanh toán) đang được hoàn thiện.
      </p>
    </div>
  )
}
