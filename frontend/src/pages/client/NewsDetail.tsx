import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { mockNews } from '@/mock/news'
import Breadcrumb from '@/components/common/Breadcrumb'
import Loading from '@/components/common/Loading'
import type { NewsItem } from '@/types'

export default function NewsDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState<NewsItem | null>(null)
  const [relatedArticles, setRelatedArticles] = useState<NewsItem[]>([])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      const found = mockNews.find((n) => n.slug === slug)
      if (found) {
        setArticle(found)
        // Load other news as related articles
        const related = mockNews.filter((n) => n.slug !== slug).slice(0, 3)
        setRelatedArticles(related)
      } else {
        setArticle(null)
      }
      setLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [slug])

  if (loading) {
    return <Loading message="Đang tải nội dung bài viết..." />
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-xl text-center py-16 px-4">
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy bài viết</h2>
        <p className="text-sm text-slate-400 mt-2">Bài viết không tồn tại hoặc đã bị gỡ bỏ khỏi hệ thống.</p>
        <Link to="/tin-tuc" className="btn-primary mt-6 inline-block">
          Quay lại cẩm nang tin tức
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 space-y-6">
      <Breadcrumb items={[{ label: 'Tin tức', to: '/tin-tuc' }, { label: article.tieu_de }]} />

      <div className="grid gap-8 lg:grid-cols-3 items-start">
        {/* LEFT COLUMN: ARTICLE CONTENT */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm text-left space-y-6">
          {/* Article Header */}
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">
              💡 Cẩm nang sức khỏe
            </span>
            <h1 className="text-2xl font-extrabold text-slate-850 sm:text-3xl leading-tight">
              {article.tieu_de}
            </h1>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
              <span>Tác giả: <strong className="text-slate-600 font-semibold">{article.nguoi_viet}</strong></span>
              <span>•</span>
              <span>{new Date(article.ngay_tao).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          {/* Featured Image */}
          <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
            <img src={article.anh_dai_dien} alt={article.tieu_de} className="w-full h-full object-cover" />
          </div>

          {/* Article Body */}
          <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4 leading-relaxed">
            <p className="font-semibold text-slate-800 text-base italic border-l-4 border-brand-500 pl-4 py-1 bg-slate-50 rounded-r-md">
              "{article.noi_dung_ngan}"
            </p>
            <p>{article.noi_dung}</p>
            
            <h3 className="text-base font-bold text-slate-800 pt-4">1. Những nguyên nhân gây bệnh phổ biến</h3>
            <p>
              Các thay đổi thất thường về thời tiết, ô nhiễm không khí tại các đô thị lớn cùng thói quen lạm dụng máy lạnh điều hòa trong phòng kín là những tác nhân chính xúc tác vi khuẩn đường hô hấp phát triển nhanh, gây sưng đau và thương tổn niêm mạc tai mũi họng.
            </p>

            <h3 className="text-base font-bold text-slate-800 pt-4">2. Cách phòng ngừa hiệu quả và chăm sóc khoa học</h3>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Súc họng, rửa mũi bằng dung dịch nước muối sinh lý NaCl 0.9% hàng ngày.</li>
              <li>Giữ ấm cổ họng khi chuyển mùa, đeo khẩu trang khi ra đường lọc khói bụi.</li>
              <li>Hạn chế uống nước đá lạnh hoặc đồ ăn cay nóng gây sưng phù nề hầu họng.</li>
              <li>Đến ngay cơ sở phòng khám chuyên khoa thực hiện chụp soi Tai Mũi Họng khi có dấu hiệu sốt đau kéo dài quá 3 ngày.</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 pt-4">3. Khuyến nghị của Bác sĩ chuyên khoa</h3>
            <p>
              Tuyệt đối không tự ý ra tiệm thuốc tây mua kháng sinh uống cắt cơn đau họng tạm thời, do viêm họng phần lớn xuất phát từ virus, kháng sinh không có tác dụng và sẽ gây kháng thuốc nguy hiểm về sau. Hãy đi thăm khám để bác sĩ kê đơn điều trị chuẩn xác.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: RELATED ARTICLES */}
        <div className="space-y-6 text-left">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">
              Bài viết liên quan
            </h2>

            <div className="space-y-4">
              {relatedArticles.map((n) => (
                <Link
                  key={n.id}
                  to={`/tin-tuc/${n.slug}`}
                  className="group flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                >
                  <div className="h-16 w-16 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                    <img src={n.anh_dai_dien} alt={n.tieu_de} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                      {n.tieu_de}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.ngay_tao).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
