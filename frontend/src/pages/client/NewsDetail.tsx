import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { newsService } from '@/services/news.service'
import Breadcrumb from '@/components/common/Breadcrumb'
import Loading from '@/components/common/Loading'
import type { NewsArticle } from '@/types'
import { getNewsImageSrcSet, getNewsImageUrl, optimizeNewsContentImages } from '@/utils/newsImage'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

export default function NewsDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState<NewsArticle | null>(null)
  const [relatedArticles, setRelatedArticles] = useState<NewsArticle[]>([])
  const safeArticleContent = useMemo(
    () => optimizeNewsContentImages(sanitizeHtml(article?.content || '')),
    [article?.content],
  )

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    newsService
      .getPublishedDetail(slug)
      .then((res) => {
        setArticle(res.article)
        setRelatedArticles(res.related)
      })
      .catch(() => {
        setArticle(null)
        setRelatedArticles([])
      })
      .finally(() => setLoading(false))
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
      <Breadcrumb items={[{ label: 'Tin tức', to: '/tin-tuc' }, { label: article.title }]} />

      <div className="grid gap-8 lg:grid-cols-3 items-start">
        {/* LEFT COLUMN: ARTICLE CONTENT */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm text-left space-y-6">
          {/* Article Header */}
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">
              Cẩm nang sức khỏe
            </span>
            <h1 className="text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-400">
              <span>Tác giả: <strong className="text-slate-600 font-semibold">{article.author_name || 'ViteFamily'}</strong></span>
              <span>•</span>
              <span>{new Date(article.created_at).toLocaleDateString('vi-VN')}</span>
              <span>•</span>
              <span>{article.view_count.toLocaleString('vi-VN')} lượt xem</span>
            </div>
          </div>

          {/* Featured Image */}
          <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={getNewsImageUrl(article.image, { width: 1280, height: 720 })}
              srcSet={getNewsImageSrcSet(article.image, [
                { width: 768, height: 432 },
                { width: 1024, height: 576 },
                { width: 1280, height: 720 },
                { width: 1600, height: 900 },
              ])}
              sizes="(min-width: 1024px) 760px, calc(100vw - 32px)"
              alt={article.title}
              className="h-full w-full object-cover"
              decoding="async"
            />
          </div>

          {/* Article Body */}
          <div className="prose prose-slate max-w-none space-y-4 text-sm leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800 text-base italic border-l-4 border-brand-500 pl-4 py-1.5 bg-slate-50 rounded-r-md">
              &ldquo;{article.excerpt}&rdquo;
            </p>
            <div 
              className="space-y-4 text-slate-600 [&_a]:font-semibold [&_a]:text-brand-600 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:bg-slate-50 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-800 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-800 [&_img]:max-h-[420px] [&_img]:w-full [&_img]:rounded-xl [&_img]:object-cover [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: safeArticleContent }}
            />
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
                  to={`/tin-tuc/${n.url_slug || n.id}`}
                  className="group flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                >
                  <div className="h-16 w-16 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                    <img
                      src={getNewsImageUrl(n.image, { width: 160, height: 160 })}
                      srcSet={getNewsImageSrcSet(n.image, [
                        { width: 128, height: 128 },
                        { width: 160, height: 160 },
                        { width: 240, height: 240 },
                      ])}
                      sizes="64px"
                      alt={n.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                      {n.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString('vi-VN')}
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
