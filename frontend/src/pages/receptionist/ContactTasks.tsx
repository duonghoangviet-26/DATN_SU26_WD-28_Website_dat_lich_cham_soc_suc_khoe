import { useEffect, useState } from 'react'
import { ContactTask, receptionistContactTasksService } from '@/services/receptionist-contact-tasks.service'

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function contactResultLabel(value?: string | null) {
  return ({
    khach_xac_nhan_se_den: 'Khách xác nhận sẽ đến',
    khach_bao_khong_den: 'Khách báo không đến',
    khong_lien_he_duoc: 'Không liên hệ được',
    da_thong_bao: 'Đã thông báo',
    khach_dong_y: 'Khách đồng ý',
    khac: 'Khác',
  } as Record<string, string>)[value ?? ''] ?? value
}

interface DoneModalState {
  auditId: string
  tenKhach: string | null
  loaiViec: ContactTask['loai_viec']
}

export default function ContactTasks() {
  const [tab, setTab] = useState<'chua_goi' | 'da_goi'>('chua_goi')
  const [tasks, setTasks] = useState<ContactTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [doneModal, setDoneModal] = useState<DoneModalState | null>(null)
  const [ghiChu, setGhiChu] = useState('')
  const [ketQua, setKetQua] = useState('khach_xac_nhan_se_den')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    receptionistContactTasksService
      .list({ trang_thai: tab })
      .then((result) => setTasks(result))
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Không thể tải danh sách liên hệ khách hàng'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const openDoneModal = (task: ContactTask) => {
    setDoneModal({ auditId: task.audit_id, tenKhach: task.ten_khach, loaiViec: task.loai_viec })
    setGhiChu('')
    setKetQua(task.loai_viec === 'xac_nhan_den_muon' ? 'khach_xac_nhan_se_den' : 'da_thong_bao')
  }

  const confirmDone = async () => {
    if (!doneModal) return
    setSubmitting(true)
    try {
      await receptionistContactTasksService.markDone(doneModal.auditId, ghiChu.trim() || undefined, ketQua)
      setDoneModal(null)
      load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể ghi nhận cuộc gọi này')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Vận hành · Xác nhận thông tin khách</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-800">Liên Hệ Khách Hàng</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Theo dõi khách cần gọi do thay đổi lịch, không có kênh thông báo app, hoặc đã quá giờ khám 10 phút nhưng chưa check-in tại quầy.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('chua_goi')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === 'chua_goi' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          Chưa liên hệ
        </button>
        <button
          type="button"
          onClick={() => setTab('da_goi')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === 'da_goi' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          Đã liên hệ
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Đang tải danh sách...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {tab === 'chua_goi' ? 'Không còn khách nào cần liên hệ.' : 'Chưa có cuộc gọi nào được ghi nhận.'}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.audit_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-slate-800">{task.ten_khach || 'Khách vãng lai'}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${task.loai_viec === 'xac_nhan_den_muon' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {task.loai_viec === 'xac_nhan_den_muon' ? 'Trễ hẹn' : 'Thông báo'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {task.so_dien_thoai || 'Chưa có số điện thoại'}{task.ma_lich_hen ? ` · ${task.ma_lich_hen}` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{formatDateTime(task.ngay_tao)}</span>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold">{task.tieu_de || 'Cần liên hệ khách'}</p>
                {task.noi_dung && <p className="mt-1 text-slate-600">{task.noi_dung}</p>}
                {task.loai_viec === 'xac_nhan_den_muon' && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    Đã quá giờ khám {task.phut_tre ?? 10} phút, chưa có check-in. Cần xác nhận khách có đến hay không trước khi điều phối thêm.
                  </p>
                )}
                {(task.gio_kham_cu || task.gio_kham_moi) && (
                  <p className="mt-2 text-xs text-slate-500">
                    Giờ hẹn: {task.gio_kham_cu || '—'} → {task.gio_kham_moi || '—'}
                    {task.bac_si ? ` · Bác sĩ: ${task.bac_si}` : ''}
                  </p>
                )}
              </div>

              {task.trang_thai === 'chua_goi' ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => openDoneModal(task)}
                    className="min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Đã liên hệ
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-emerald-700">
                  Đã liên hệ lúc {formatDateTime(task.da_goi_luc)}{task.da_goi_boi ? ` bởi ${task.da_goi_boi}` : ''}
                  {task.ket_qua_cuoc_goi ? ` · Kết quả: ${contactResultLabel(task.ket_qua_cuoc_goi)}` : ''}
                  {task.ghi_chu_cuoc_goi ? ` — ${task.ghi_chu_cuoc_goi}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {doneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-xl font-bold text-slate-800">Xác nhận đã liên hệ</h3>
            <p className="mt-1 text-sm text-slate-500">{doneModal.tenKhach || 'Khách vãng lai'}</p>

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Kết quả cuộc gọi
              <select
                value={ketQua}
                onChange={(event) => setKetQua(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {doneModal.loaiViec === 'xac_nhan_den_muon' ? (
                  <>
                    <option value="khach_xac_nhan_se_den">Khách xác nhận sẽ đến</option>
                    <option value="khach_bao_khong_den">Khách báo không đến</option>
                    <option value="khong_lien_he_duoc">Không liên hệ được</option>
                    <option value="khac">Khác</option>
                  </>
                ) : (
                  <>
                    <option value="da_thong_bao">Đã thông báo</option>
                    <option value="khach_dong_y">Khách đồng ý</option>
                    <option value="khong_lien_he_duoc">Không liên hệ được</option>
                    <option value="khac">Khác</option>
                  </>
                )}
              </select>
            </label>

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Ghi chú cuộc gọi
              <textarea
                rows={2}
                value={ghiChu}
                onChange={(event) => setGhiChu(event.target.value)}
                placeholder={doneModal.loaiViec === 'xac_nhan_den_muon' ? 'Vd: khách đang tới, dự kiến đến sau 5 phút' : 'Vd: đã báo lịch mới, khách đồng ý'}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDoneModal(null)} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                Đóng
              </button>
              <button
                type="button"
                onClick={confirmDone}
                disabled={submitting}
                className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Đang lưu...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
