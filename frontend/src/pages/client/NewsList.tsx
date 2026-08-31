import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { newsService } from '@/services/news.service'
import Breadcrumb from '@/components/common/Breadcrumb'
import Empty from '@/components/common/Empty'
import Skeleton from '@/components/common/Skeleton'
import { getNewsImageSrcSet, getNewsImageUrl } from '@/utils/newsImage'
import type { NewsArticle } from '@/types'
import { RouteTransition } from '@/components/client/ClientMotion'

export default function NewsList() {
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState<NewsArticle[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')
    newsService
      .getPublished({ keyword: searchTerm, page, limit: 4 })
      .then((res) => {
        if (!ignore) {
          setNews(res.items)
          setTotalPages(res.pagination?.totalPages || 1)
        }
      })
      .catch((nextError: any) => {
        if (ignore) return
        setNews([])
        setError(nextError?.response?.data?.message || 'Không thể tải danh sách tin tức.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [searchTerm, page])

  const featuredItem = page === 1 && !searchTerm ? news[0] : null
  const regularItems = featuredItem ? news.slice(1) : news

  return (
    <RouteTransition>
      <div className="mx-auto max-w-6xl px-4 pb-16 space-y-8">
        <Breadcrumb items={[{ label: 'Tin tức & Cẩm nang' }]} />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="text-left space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Cẩm Nang Sức Khỏe Tai Mũi Họng</h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Các kiến thức phòng ngừa viêm xoang, bảo vệ amidan và chăm sóc tai mũi họng cho trẻ từ phác đồ y khoa chính thống.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72 shrink-0">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Tìm bài viết cẩm nang..."
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-8">
          {/* Featured Skeleton */}
          <div className="grid gap-6 md:grid-cols-2 rounded-xl border border-slate-100 bg-white p-6">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
          {/* Grid Skeleton */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-5 space-y-4">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8">
          <Empty title="Không tải được tin tức" description={error} icon="box" />
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8">
          <Empty title="Không tìm thấy bài viết" description="Vui lòng thử tìm kiếm bằng từ khóa khác." icon="search" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* FEATURED ARTICLE CARD */}
          {featuredItem && (
            <Link
              to={`/tin-tuc/${featuredItem.url_slug || featuredItem.id}`}
              className="group grid gap-6 md:grid-cols-2 items-center rounded-xl border border-slate-100 bg-gradient-to-br from-brand-50/60 to-white p-6 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-300 ease-out hover:-translate-y-1"
            >
              <div className="aspect-[16/10] w-full bg-slate-100 rounded-xl overflow-hidden">
                <img
                  src={getNewsImageUrl(featuredItem.image, { width: 960, height: 600 })}
                  srcSet={getNewsImageSrcSet(featuredItem.image, [
                    { width: 640, height: 400 },
                    { width: 960, height: 600 },
                    { width: 1280, height: 800 },
                  ])}
                  sizes="(min-width: 768px) 50vw, calc(100vw - 32px)"
                  alt={featuredItem.title}
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ease-out"
                  decoding="async"
                />
              </div>
              <div className="text-left space-y-4 pr-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">
                  Nổi bật
                </span>
                <h2 className="text-xl font-bold text-slate-800 group-hover:text-brand-600 transition-colors sm:text-2xl leading-tight">
                  {featuredItem.title}
                </h2>
                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {featuredItem.excerpt}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase pt-2">
                  <span>{featuredItem.author_name || 'ViteFamily'}</span>
                  <span>•</span>
                  <span>{new Date(featuredItem.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            </Link>
          )}

          {/* REGULAR NEWS GRID */}
          {regularItems.length > 0 && (
            <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {regularItems.map((n) => (
                <Link
                  key={n.id}
                  to={`/tin-tuc/${n.url_slug || n.id}`}
                  className="group flex flex-col justify-between overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-brand-50/60 to-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10"
                >
                  <div>
                    <div className="aspect-video w-full bg-slate-100 overflow-hidden">
                      <img
                        src={getNewsImageUrl(n.image, { width: 720, height: 405 })}
                        srcSet={getNewsImageSrcSet(n.image, [
                          { width: 480, height: 270 },
                          { width: 720, height: 405 },
                          { width: 960, height: 540 },
                        ])}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, calc(100vw - 32px)"
                        alt={n.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="p-5 space-y-3 text-left">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase">
                        <span>{n.author_name || 'ViteFamily'}</span>
                        <span>•</span>
                        <span>{new Date(n.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                        {n.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {n.excerpt}
                      </p>
                    </div>
                  </div>
                  <div className="p-5 pt-0 text-xs font-semibold text-brand-600 flex items-center gap-1 group-hover:text-brand-800 text-left">
                    Đọc bài viết
                    <svg className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform duration-300 ease-out" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 pt-8">
                <button
                  disabled={page === 1}
                  onClick={() => {
                    setPage(page - 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-500 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setPage(p)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-all ${
                        page === p
                          ? 'border-brand-500 bg-brand-500 text-white shadow-md shadow-brand-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-brand-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  disabled={page === totalPages}
                  onClick={() => {
                    setPage(page + 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-500 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            </>
          )}
        </div>
      )}
      </div>
    </RouteTransition>
  )
}
