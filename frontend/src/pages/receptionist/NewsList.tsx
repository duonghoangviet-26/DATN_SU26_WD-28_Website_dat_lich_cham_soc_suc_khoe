import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Badge from '@/components/common/Badge'
import Empty from '@/components/common/Empty'
import Skeleton from '@/components/common/Skeleton'
import Icon from '@/components/admin/icons'
import { newsService } from '@/services/news.service'
import type { NewsArticle, NewsStatus } from '@/types'
import NewsHistoryModal from '@/components/admin/NewsHistoryModal'

const STATUS_LABEL: Record<NewsStatus, string> = {
  published: 'Đã xuất bản',
  draft: 'Bản nháp',
  hidden: 'Đã ẩn',
}

const STATUS_COLOR: Record<NewsStatus, 'green' | 'yellow' | 'gray'> = {
  published: 'green',
  draft: 'yellow',
  hidden: 'gray',
}

interface LocationState {
  success?: string
}

export default function ReceptionistNewsList() {
  const location = useLocation()
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsArticle[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success] = useState((location.state as LocationState | null)?.success || '')
  const [historyArticle, setHistoryArticle] = useState<NewsArticle | null>(null)

  const query = useMemo(
    () => ({ keyword, status, page: pagination.page, limit: pagination.limit }),
    [keyword, status, pagination.page, pagination.limit]
  )

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await newsService.getReceptionistList(query)
      setItems(res.items)
      setPagination(res.pagination)
    } catch (nextError: any) {
      setItems([])
      setError(nextError?.response?.data?.message || 'Không thể tải danh sách tin tức đã thêm.')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void fetchNews()
  }, [fetchNews])

  useEffect(() => {
    if (!success) return
    navigate('.', { replace: true, state: {} })
  }, [navigate, success])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Tin tức</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Danh sách bài viết đã thêm</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Theo dõi các bài viết do tài khoản lễ tân hiện tại đã nhập vào hệ thống.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/tin-tuc" target="_blank" className="btn-secondary inline-flex items-center justify-center gap-2">
            <Icon name="eye" className="h-4 w-4" />
            Xem trang tin tức
          </Link>
          <Link to="/receptionist/news/create" className="btn-primary inline-flex items-center justify-center gap-2">
            <Icon name="plus" className="h-4 w-4" />
            Thêm tin tức
          </Link>
        </div>
      </div>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Bài viết của tôi</h2>
            <p className="mt-0.5 text-xs text-slate-500">Tổng cộng {pagination.total.toLocaleString('vi-VN')} bài viết.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPagination((current) => ({ ...current, page: 1 }))
                }}
                className="input h-10 w-full pl-9 sm:w-80"
                placeholder="Tìm tiêu đề, tác giả, nội dung"
              />
            </div>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPagination((current) => ({ ...current, page: 1 }))
              }}
              className="input h-10 sm:w-44"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản</option>
              <option value="draft">Bản nháp</option>
              <option value="hidden">Đã ẩn</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Bài viết</th>
                <th className="px-5 py-3 font-medium">Tác giả</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3 font-medium">Lượt xem</th>
                <th className="px-5 py-3 font-medium">Ngày tạo</th>
                <th className="px-5 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-5 py-4"><Skeleton className="h-14 w-80" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-5 py-4"><Skeleton className="ml-auto h-9 w-20" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12">
                    <Empty
                      title="Chưa có bài viết nào"
                      description="Bắt đầu bằng cách thêm một bài viết tin tức mới."
                      icon="box"
                    />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50">
                    <td className="min-w-80 px-5 py-4">
                      <div className="flex gap-3">
                        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100">
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.author_name || 'ViteFamily'}</td>
                    <td className="px-5 py-4">
                      <Badge color={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{item.view_count.toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-4 text-slate-500">{new Date(item.created_at).toLocaleDateString('vi-VN')}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/receptionist/news/${item.id}/edit`}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                          Sửa
                        </Link>
                        <Link
                          to={`/tin-tuc/${item.url_slug || item.id}`}
                          target="_blank"
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <Icon name="eye" className="h-4 w-4" />
                          Xem
                        </Link>
                        <button
                          type="button"
                          onClick={() => setHistoryArticle(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Icon name="history" className="h-4 w-4" />
                          Lịch sử
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-slate-500">Hiển thị {items.length} / {pagination.total} bài viết</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary py-1.5"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
            >
              Trước
            </button>
            <span className="px-2 font-semibold text-slate-700">Trang {pagination.page} / {pagination.totalPages}</span>
            <button
              type="button"
              className="btn-secondary py-1.5"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
            >
              Sau
            </button>
          </div>
        </div>
      </section>

      {historyArticle && (
        <NewsHistoryModal
          article={historyArticle}
          onClose={() => setHistoryArticle(null)}
          isAdmin={false}
        />
      )}
    </div>
  )
}
