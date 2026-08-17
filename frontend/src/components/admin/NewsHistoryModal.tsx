import { useEffect, useState } from 'react'

import Icon from '@/components/admin/icons'
import { newsService } from '@/services/news.service'
import type { NewsArticle, NewsHistoryItem } from '@/types'
import { formatAdminValue } from '@/utils/adminDisplay'

interface Props {
  article: NewsArticle
  onClose: () => void
  isAdmin?: boolean
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  receptionist: 'bg-amber-100 text-amber-700',
  system: 'bg-slate-100 text-slate-700',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  receptionist: 'Lễ tân',
  system: 'Hệ thống',
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_NEWS: 'Tạo bài viết',
  UPDATE_NEWS: 'Cập nhật bài viết',
  PUBLISH_NEWS: 'Xuất bản bài viết',
  HIDE_NEWS: 'Ẩn bài viết',
  DELETE_NEWS: 'Xóa bài viết',
}

export default function NewsHistoryModal({ article, onClose, isAdmin = false }: Props) {
  const [history, setHistory] = useState<NewsHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const fetchHistory = isAdmin
      ? newsService.getAdminHistory(article.id)
      : newsService.getReceptionistHistory(article.id)
      
    fetchHistory
      .then(setHistory)
      .catch((nextError) => setError(nextError?.response?.data?.message || 'Lỗi tải lịch sử'))
      .finally(() => setLoading(false))
  }, [article.id, isAdmin])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Lịch sử thao tác</h3>
            <p className="text-sm text-slate-500">
              Bài viết: <span className="font-medium text-slate-700">{article.title}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="py-10 text-center text-slate-400">Đang tải lịch sử...</div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">{error}</div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-slate-400">Chưa có lịch sử thao tác nào.</div>
          ) : (
            <div className="relative ml-4 space-y-8 border-l-2 border-slate-200">
              {history.map((item) => (
                <div key={item._id} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white bg-blue-500" />

                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{item.nguoi_thuc_hien}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[item.vai_tro] || 'bg-slate-100 text-slate-700'}`}>
                        {ROLE_LABELS[item.vai_tro] || formatAdminValue('role', item.vai_tro)}
                      </span>
                    </div>
                    <time className="text-xs text-slate-500">
                      {new Date(item.thoi_diem).toLocaleString('vi-VN')}
                    </time>
                  </div>

                  {item.nguoi_thuc_hien_email && (
                    <div className="mb-3 text-xs text-slate-500">{item.nguoi_thuc_hien_email}</div>
                  )}

                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
                    <div className="mb-2 text-slate-600">
                      <span className="font-medium text-slate-700">Hành động:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {ACTION_LABELS[item.hanh_dong] || item.hanh_dong}
                      </span>
                    </div>

                    {item.ly_do && (
                      <div className="mt-3 border-t border-slate-200 pt-2">
                        <span className="font-medium text-slate-700">Ghi chú: </span>
                        <span className="text-slate-600">{item.ly_do}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
