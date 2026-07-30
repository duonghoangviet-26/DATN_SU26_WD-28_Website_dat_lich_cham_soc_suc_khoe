import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NewsEditorForm from '@/components/news/NewsEditorForm'
import { newsService } from '@/services/news.service'
import type { NewsPayload } from '@/types'

export default function ReceptionistNewsCreate() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(payload: NewsPayload) {
    setSaving(true)
    setError('')
    try {
      const created = await newsService.createReceptionist(payload)
      navigate('/receptionist/news', {
        replace: true,
        state: { success: `Đã thêm tin tức "${created.title}" thành công.` },
      })
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể thêm tin tức.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Tin tức</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Thêm tin tức mới</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Lễ tân nhập tiêu đề, tiêu đề ngắn, tác giả, ảnh bìa và nội dung để xuất bản bài viết lên trang tin tức người dùng.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/receptionist/news" className="btn-secondary inline-flex items-center justify-center">
            Danh sách bài viết
          </Link>
          <Link to="/tin-tuc" target="_blank" className="btn-secondary inline-flex items-center justify-center">
            Xem trang tin tức
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <NewsEditorForm
          submitLabel="Thêm tin tức"
          saving={saving}
          onSubmit={handleSubmit}
          onUploadImage={newsService.uploadReceptionistImage}
        />
      </section>
    </div>
  )
}
