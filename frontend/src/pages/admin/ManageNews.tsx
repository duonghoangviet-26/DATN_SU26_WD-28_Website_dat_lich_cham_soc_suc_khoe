import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { AdminAutoStagger } from '@/components/admin/motion/AdminMotion'
import NewsEditorForm from '@/components/news/NewsEditorForm'
import { newsService } from '@/services/news.service'
import type { NewsArticle, NewsPayload, NewsStatus } from '@/types'
import NewsHistoryModal from '@/components/admin/NewsHistoryModal'

const STATUS_LABEL: Record<NewsStatus, string> = {
  published: 'Đang hiển thị',
  draft: 'Bản nháp',
  hidden: 'Đã ẩn',
}

const STATUS_COLOR: Record<NewsStatus, 'green' | 'yellow' | 'gray'> = {
  published: 'green',
  draft: 'yellow',
  hidden: 'gray',
}

export default function ManageNews() {
  const [items, setItems] = useState<NewsArticle[]>([])
  const [statistics, setStatistics] = useState({ total: 0, published: 0, draft: 0, hidden: 0 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingNews, setEditingNews] = useState<NewsArticle | null | undefined>(undefined)
  const [viewingNews, setViewingNews] = useState<NewsArticle | null>(null)
  const [deletingNews, setDeletingNews] = useState<NewsArticle | null>(null)
  const [historyArticle, setHistoryArticle] = useState<NewsArticle | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('.action-menu-container')) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const query = useMemo(() => ({ keyword, status, page: pagination.page, limit: pagination.limit }), [keyword, status, pagination.page, pagination.limit])

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await newsService.getAdminList(query)
      setItems(res.items)
      setPagination(res.pagination)
      setStatistics(res.statistics)
    } catch (nextError: any) {
      setItems([])
      setError(nextError?.response?.data?.message || 'Không thể tải danh sách tin tức.')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void fetchNews()
  }, [fetchNews])

  async function handleSubmit(payload: NewsPayload) {
    setSaving(true)
    setError('')
    try {
      if (editingNews?.id) {
        await newsService.updateAdmin(editingNews.id, payload)
      } else {
        await newsService.createAdmin(payload)
      }
      setEditingNews(undefined)
      await fetchNews()
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể lưu tin tức.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: NewsArticle) {
    try {
      await newsService.toggleAdmin(item.id)
      await fetchNews()
    } catch (nextError: any) {
      alert(nextError?.response?.data?.message || 'Không thể đổi trạng thái tin tức.')
    }
  }

  async function handleDelete() {
    if (!deletingNews) return
    const id = deletingNews.id
    setDeletingNews(null)
    try {
      await newsService.deleteAdmin(id)
      await fetchNews()
    } catch (nextError: any) {
      alert(nextError?.response?.data?.message || 'Không thể xóa tin tức.')
    }
  }

  return (
    <AdminAutoStagger className="space-y-6">
      <PageHeader
        title="Quản lý tin tức"
        description="Tạo, kiểm duyệt và xem chi tiết các bài viết hiển thị ở trang Tin tức của người dùng."
      >
        <button type="button" onClick={() => setEditingNews(null)} className="btn-primary inline-flex items-center gap-2">
          <Icon name="plus" className="h-4 w-4" />
          Thêm tin tức
        </button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Tổng bài" value={statistics.total} icon="file-text" />
        <SummaryCard title="Đang hiển thị" value={statistics.published} icon="eye" tone="green" />
        <SummaryCard title="Bản nháp" value={statistics.draft} icon="edit" tone="yellow" />
        <SummaryCard title="Đã ẩn" value={statistics.hidden} icon="eye-off" />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Danh sách tin tức</h3>
            <p className="mt-0.5 text-xs text-slate-400">Nội dung đã xuất bản sẽ hiển thị ở `/tin-tuc`.</p>
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
                className="input h-10 w-full pl-9 sm:w-72"
                placeholder="Tìm tiêu đề, tiêu đề ngắn, tác giả, nội dung"
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
                <th className="px-5 py-3 font-medium">Tin tức</th>
                <th className="px-5 py-3 font-medium">Tiêu đề ngắn</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3 font-medium">Lượt xem</th>
                <th className="px-5 py-3 font-medium">Ngày tạo</th>
                <th className="px-5 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Đang tải tin tức...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Chưa có tin tức phù hợp.</td>
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
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.excerpt}</p>
                          <p className="mt-1 text-xs text-slate-400">Tác giả: {item.author_name || 'ViteFamily'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">{item.slug}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge color={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{item.view_count.toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-4 text-slate-500">{new Date(item.created_at).toLocaleDateString('vi-VN')}</td>
                    <td className="px-5 py-4">
                      <div className="relative flex justify-end action-menu-container">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                          className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors ${
                            activeMenuId === item.id ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                          }`}
                        >
                          <Icon name="more-vertical" className="h-5 w-5" />
                        </button>
                        
                        {activeMenuId === item.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                            <div className="flex flex-col py-1">
                              <Link
                                to={`/tin-tuc/${item.url_slug || item.id}`}
                                target="_blank"
                                onClick={() => setActiveMenuId(null)}
                                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                              >
                                <Icon name="eye" className="h-4 w-4" /> Xem ngoài web
                              </Link>
                              <button
                                type="button"
                                onClick={() => { setViewingNews(item); setActiveMenuId(null); }}
                                className="flex items-center gap-3 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                              >
                                <Icon name="file-text" className="h-4 w-4" /> Xem chi tiết
                              </button>
                              <button
                                type="button"
                                onClick={() => { setHistoryArticle(item); setActiveMenuId(null); }}
                                className="flex items-center gap-3 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                              >
                                <Icon name="rotate-ccw" className="h-4 w-4" /> Lịch sử thao tác
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingNews(item); setActiveMenuId(null); }}
                                className="flex items-center gap-3 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                              >
                                <Icon name="edit" className="h-4 w-4" /> Sửa tin tức
                              </button>
                              <button
                                type="button"
                                onClick={() => { void handleToggle(item); setActiveMenuId(null); }}
                                className="flex items-center gap-3 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-600"
                              >
                                <Icon name={item.status === 'published' ? 'eye-off' : 'eye'} className="h-4 w-4" /> 
                                {item.status === 'published' ? 'Ẩn tin tức' : 'Hiện tin tức'}
                              </button>
                              <div className="my-1 border-t border-slate-100"></div>
                              <button
                                type="button"
                                onClick={() => { setDeletingNews(item); setActiveMenuId(null); }}
                                className="flex items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <Icon name="trash" className="h-4 w-4" /> Xóa tin tức
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm">
          <span className="text-slate-500">Hiển thị {items.length} / {pagination.total} tin tức</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary py-1.5" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>
              Trước
            </button>
            <span className="px-2 font-semibold text-slate-700">Trang {pagination.page} / {pagination.totalPages}</span>
            <button type="button" className="btn-secondary py-1.5" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>
              Sau
            </button>
          </div>
        </div>
      </div>

      {editingNews !== undefined && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingNews ? 'Sửa tin tức' : 'Thêm tin tức'}</h3>
                <p className="mt-1 text-sm text-slate-500">Nhập tiêu đề, tiêu đề ngắn, tác giả, ảnh bìa và nội dung để xuất bản bài viết.</p>
              </div>
              <button type="button" onClick={() => setEditingNews(undefined)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <NewsEditorForm
                initialNews={editingNews}
                submitLabel={editingNews ? 'Cập nhật tin tức' : 'Thêm tin tức'}
                saving={saving}
                onSubmit={handleSubmit}
                onCancel={() => setEditingNews(undefined)}
                onUploadImage={newsService.uploadAdminImage}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {viewingNews && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <article className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <Badge color={STATUS_COLOR[viewingNews.status]}>{STATUS_LABEL[viewingNews.status]}</Badge>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{viewingNews.title}</h3>
              </div>
              <button type="button" onClick={() => setViewingNews(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <img src={viewingNews.image} alt={viewingNews.title} className="aspect-video w-full object-cover" />
            <div className="space-y-4 px-6 py-5 text-sm leading-7 text-slate-600">
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 font-semibold text-slate-700">{viewingNews.excerpt}</p>
              <div className="space-y-4 [&_a]:font-semibold [&_a]:text-brand-600 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:bg-slate-50 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-800 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-800 [&_img]:max-h-[360px] [&_img]:w-full [&_img]:rounded-xl [&_img]:object-cover [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: viewingNews.content }} />
            </div>
          </article>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={!!deletingNews}
        title="Xóa tin tức"
        message={`Bạn có chắc muốn xóa "${deletingNews?.title}"?`}
        confirmText="Xóa tin tức"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeletingNews(null)}
      />

      {historyArticle && (
        <NewsHistoryModal
          article={historyArticle}
          onClose={() => setHistoryArticle(null)}
          isAdmin={true}
        />
      )}
    </AdminAutoStagger>
  )
}

function SummaryCard({ title, value, icon, tone = 'blue' }: { title: string; value: number; icon: string; tone?: 'blue' | 'green' | 'yellow' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-500 border-blue-100/50',
    green: 'bg-emerald-50 text-emerald-500 border-emerald-100/50',
    yellow: 'bg-amber-50 text-amber-500 border-amber-100/50',
  }[tone]

  return (
    <div className="card flex items-center justify-between rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${toneClass}`}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
    </div>
  )
}
