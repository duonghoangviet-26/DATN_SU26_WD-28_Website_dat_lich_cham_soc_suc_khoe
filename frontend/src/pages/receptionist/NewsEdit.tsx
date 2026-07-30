import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Empty from '@/components/common/Empty'
import Loading from '@/components/common/Loading'
import NewsEditorForm from '@/components/news/NewsEditorForm'
import { newsService } from '@/services/news.service'
import type { NewsArticle, NewsPayload } from '@/types'

export default function ReceptionistNewsEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [news, setNews] = useState<NewsArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let ignore = false
    setLoading(true)
    setError('')

    newsService
      .getReceptionistDetail(id)
      .then((item) => {
        if (!ignore) setNews(item)
      })
      .catch((nextError: any) => {
        if (ignore) return
        setNews(null)
        setError(nextError?.response?.data?.message || 'Không thể tải bài viết cần sửa.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id])

  async function handleSubmit(payload: NewsPayload) {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      const updated = await newsService.updateReceptionist(id, payload)
      navigate('/receptionist/news', {
        replace: true,
        state: { success: `Đã cập nhật tin tức "${updated.title}" thành công.` },
      })
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể cập nhật tin tức.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Tin tức</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Sửa bài viết</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Cập nhật tiêu đề, tiêu đề ngắn, tác giả, ảnh bìa và nội dung của bài viết đã thêm.
          </p>
        </div>
        <Link to="/receptionist/news" className="btn-secondary inline-flex items-center justify-center">
          Danh sách bài viết
        </Link>
      </div>

      {loading ? (
        <Loading message="Đang tải bài viết..." />
      ) : !news ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Empty title="Không tìm thấy bài viết" description={error || 'Bài viết không tồn tại hoặc không thuộc tài khoản lễ tân hiện tại.'} icon="box" />
        </section>
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <NewsEditorForm
              initialNews={news}
              submitLabel="Cập nhật tin tức"
              saving={saving}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/receptionist/news')}
              onUploadImage={newsService.uploadReceptionistImage}
            />
          </section>
        </>
      )}
    </div>
  )
}
