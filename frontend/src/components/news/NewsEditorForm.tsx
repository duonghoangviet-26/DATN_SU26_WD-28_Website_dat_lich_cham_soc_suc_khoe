import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { NewsArticle, NewsPayload, NewsStatus } from '@/types'
import Icon from '@/components/admin/icons'
import RichTextEditor from './RichTextEditor'

interface Props {
  initialNews?: NewsArticle | null
  submitLabel: string
  saving?: boolean
  onSubmit: (payload: NewsPayload) => Promise<void> | void
  onCancel?: () => void
  onUploadImage?: (file: File) => Promise<string>
}

const STATUS_OPTIONS: Array<{ value: NewsStatus; label: string }> = [
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'hidden', label: 'Đã ẩn' },
]

function stripTags(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function NewsEditorForm({
  initialNews,
  submitLabel,
  saving = false,
  onSubmit,
  onCancel,
  onUploadImage,
}: Props) {
  const [title, setTitle] = useState(initialNews?.title || '')
  const [slug, setSlug] = useState(initialNews?.slug || '')
  const [authorName, setAuthorName] = useState(initialNews?.author_name || '')
  const [image, setImage] = useState(initialNews?.image || '')
  const [content, setContent] = useState(initialNews?.content || '')
  const [status, setStatus] = useState<NewsStatus>(initialNews?.status || 'published')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setTitle(initialNews?.title || '')
    setSlug(initialNews?.slug || '')
    setAuthorName(initialNews?.author_name || '')
    setImage(initialNews?.image || '')
    setContent(initialNews?.content || '')
    setStatus(initialNews?.status || 'published')
    setError('')
  }, [initialNews])

  const excerpt = useMemo(() => stripTags(content).slice(0, 160), [content])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextTitle = title.trim()
    const nextSlug = slug.trim()
    const nextAuthorName = authorName.trim()
    const nextImage = image.trim()
    const plainContent = stripTags(content)

    if (!nextTitle) return setError('Vui lòng nhập tiêu đề.')
    if (!nextSlug) return setError('Vui lòng nhập tiêu đề ngắn.')
    if (!nextAuthorName) return setError('Vui lòng nhập tác giả.')
    if (!nextImage) return setError('Vui lòng nhập hoặc tải ảnh bìa.')
    if (!plainContent) return setError('Vui lòng nhập nội dung.')

    setError('')
    await onSubmit({
      title: nextTitle,
      slug: nextSlug,
      author_name: nextAuthorName,
      image: nextImage,
      content,
      status,
    })
  }

  async function handleUpload(file: File | undefined) {
    if (!file || !onUploadImage) return
    setUploading(true)
    setError('')
    try {
      const url = await onUploadImage(file)
      setImage(url)
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Tải ảnh thất bại.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Tiêu đề</span>
          <input
            value={title}
            onChange={(event) => {
              const value = event.target.value
              setTitle(value)
              if (!slug || slug === title) setSlug(value)
            }}
            className="input w-full"
            placeholder="Ví dụ: 5 dấu hiệu viêm xoang ở trẻ em"
            disabled={saving}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Tiêu đề ngắn</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="input w-full"
            placeholder="Ví dụ: Nguyên nhân, triệu chứng và cách điều trị"
            disabled={saving}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Tác giả</span>
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          className="input w-full"
          placeholder="Ví dụ: Bộ Y tế, Vinmec, ThS.BS Nguyễn Văn A"
          disabled={saving}
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-[180px_1fr_auto] lg:items-end">
        <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {image ? (
            <img src={image} alt={title || 'Ảnh tin tức'} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-xs font-semibold text-slate-400">Chưa có ảnh</div>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Ảnh bìa</span>
          <input
            value={image}
            onChange={(event) => setImage(event.target.value)}
            className="input w-full"
            placeholder="/img/... hoặc đường dẫn ảnh"
            disabled={saving}
          />
        </label>

        {onUploadImage && (
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100">
            <Icon name="image" className="h-4 w-4" />
            {uploading ? 'Đang tải...' : 'Tải ảnh'}
            <input
              type="file"
              accept="image/*"
              disabled={saving || uploading}
              className="hidden"
              onChange={(event) => {
                void handleUpload(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
        )}
      </div>

      <label className="block max-w-sm">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Trạng thái</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as NewsStatus)}
          className="input w-full"
          disabled={saving}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-700">Nội dung</span>
          <span className="text-xs text-slate-400">{excerpt.length} ký tự xem trước</span>
        </div>
        <RichTextEditor value={content} onChange={setContent} disabled={saving} onUploadImage={onUploadImage} />
      </div>

      {excerpt && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tóm tắt tự động</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{excerpt}</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary">
            Hủy
          </button>
        )}
        <button type="submit" disabled={saving || uploading} className="btn-primary disabled:opacity-50">
          {saving ? 'Đang lưu...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
