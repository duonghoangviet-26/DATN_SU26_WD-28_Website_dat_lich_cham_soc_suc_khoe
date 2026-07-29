import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/admin/icons'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  onUploadImage?: (file: File) => Promise<string>
}

const toolbarGroups = [
  [
    { label: 'B', title: 'In đậm', command: 'bold' },
    { label: 'I', title: 'In nghiêng', command: 'italic' },
    { label: 'U', title: 'Gạch chân', command: 'underline' },
    { label: 'S', title: 'Gạch ngang', command: 'strikeThrough' },
  ],
  [
    { label: '•', title: 'Danh sách chấm', command: 'insertUnorderedList' },
    { label: '1.', title: 'Danh sách số', command: 'insertOrderedList' },
    { label: '"', title: 'Trích dẫn', command: 'formatBlock', value: 'blockquote' },
  ],
]

export default function RichTextEditor({ value, onChange, disabled = false, onUploadImage }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.innerHTML === value) return
    editor.innerHTML = value || ''
  }, [value])

  function runCommand(command: string, commandValue?: string) {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(command, false, commandValue)
    onChange(editorRef.current?.innerHTML || '')
  }

  function createLink() {
    const url = linkValue.trim()
    if (!url) return
    runCommand('createLink', url)
    setLinkDialogOpen(false)
    setLinkValue('')
  }

  async function uploadContentImage(file: File | undefined) {
    if (!file || !onUploadImage || disabled) return

    setUploadingImage(true)
    setLocalError('')
    try {
      const url = await onUploadImage(file)
      runCommand('insertHTML', `<img src="${url}" alt="Ảnh trong nội dung bài viết">`)
    } catch (error: any) {
      setLocalError(error?.response?.data?.message || error.message || 'Không thể tải ảnh trong nội dung.')
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-2">
        <select
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none focus:border-brand-400"
          disabled={disabled}
          defaultValue="p"
          onChange={(event) => runCommand('formatBlock', event.target.value)}
          title="Kiểu đoạn"
        >
          <option value="p">Đoạn văn</option>
          <option value="h2">Tiêu đề 2</option>
          <option value="h3">Tiêu đề 3</option>
        </select>

        {toolbarGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="flex items-center gap-1 border-l border-slate-200 pl-1 first:border-l-0 first:pl-0">
            {group.map((item) => (
              <button
                key={`${item.command}-${item.label}`}
                type="button"
                disabled={disabled}
                title={item.title}
                onMouseDown={(event) => {
                  event.preventDefault()
                  runCommand(item.command, item.value)
                }}
                className="grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-bold text-slate-600 transition-colors hover:bg-white hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}

        <button
          type="button"
          title="Chèn liên kết"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault()
            setLocalError('')
            setLinkDialogOpen(true)
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="link" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Tải ảnh từ máy tính"
          disabled={disabled || uploadingImage || !onUploadImage}
          onMouseDown={(event) => {
            event.preventDefault()
            imageInputRef.current?.click()
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="image" className="h-4 w-4" />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void uploadContentImage(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <button
          type="button"
          title="Xóa định dạng"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault()
            runCommand('removeFormat')
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>

      {linkDialogOpen && (
        <div className="border-b border-slate-100 bg-white px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Nhập liên kết</span>
              <input
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    createLink()
                  }
                  if (event.key === 'Escape') {
                    setLinkDialogOpen(false)
                    setLinkValue('')
                  }
                }}
                className="input h-9 w-full"
                placeholder="https://..."
                autoFocus
              />
            </label>
            <button type="button" onClick={createLink} className="btn-primary h-9 px-3 text-xs">
              Chèn liên kết
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkDialogOpen(false)
                setLinkValue('')
              }}
              className="btn-secondary h-9 px-3 text-xs"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {localError && (
        <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {localError}
        </div>
      )}
      {uploadingImage && (
        <div className="border-b border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
          Đang tải ảnh vào nội dung...
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!disabled}
        role="textbox"
        aria-label="Nội dung tin tức"
        aria-multiline="true"
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="min-h-72 px-4 py-3 text-sm leading-7 text-slate-700 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
        data-placeholder="Nhập nội dung bài viết..."
        suppressContentEditableWarning
      />
    </div>
  )
}
