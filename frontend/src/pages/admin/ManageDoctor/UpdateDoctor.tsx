import React, { useState, useEffect } from 'react'
import { doctorService } from '@/services/doctor.service'
import { clinicService } from '@/services/clinic.service'
import type { DoctorProfileAPI, DoctorDetailAPI, DoctorUpdatePayload } from '@/types'
import Icon from '@/components/admin/icons'

interface Props {
  doctor: DoctorProfileAPI | DoctorDetailAPI
  onClose: () => void
  onSuccess: () => void
}

// Giả lập admin_id cho đến khi có auth thực sự
const CURRENT_ADMIN_ID = "000000000000000000000099"

export default function UpdateDoctor({ doctor, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [tieuSu, setTieuSu] = useState('')
  const [bangCap, setBangCap] = useState('')
  const [kinhNghiem, setKinhNghiem] = useState('')
  const [soNam, setSoNam] = useState(0)
  const [phiTuVan, setPhiTuVan] = useState(0)
  const [laHien, setLaHien] = useState(true)
  const [anhDaiDien, setAnhDaiDien] = useState<string | null>(doctor.user_id.anh_dai_dien || null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Fetch full details first to populate form accurately
  useEffect(() => {
    let ignore = false
    doctorService.getById(doctor._id)
      .then((detail) => {
        if (!ignore) {
          setTieuSu(detail.tieu_su || '')
          setBangCap(detail.bang_cap || '')
          setKinhNghiem(detail.kinh_nghiem || '')
          setSoNam(detail.so_nam_kinh_nghiem || 0)
          setPhiTuVan(detail.phi_kham || 0)
          setLaHien(detail.la_hien ?? true)
          setAnhDaiDien(detail.user_id.anh_dai_dien || null)
          setFetching(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError('Không thể tải thông tin chi tiết bác sĩ: ' + err.message)
          setFetching(false)
        }
      })
    return () => { ignore = true }
  }, [doctor._id])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadingAvatar(true)
    setError('')
    try {
      const url = await clinicService.uploadImage(file)
      setAnhDaiDien(url)
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Tải ảnh đại diện thất bại')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload: DoctorUpdatePayload = {
      tieu_su: tieuSu,
      bang_cap: bangCap,
      kinh_nghiem: kinhNghiem,
      so_nam_kinh_nghiem: Number(soNam),
      phi_kham: Number(phiTuVan),
      la_hien: laHien,
      anh_dai_dien: anhDaiDien,
      admin_id: CURRENT_ADMIN_ID
    }

    try {
      await doctorService.update(doctor._id, payload)
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Cập nhật thất bại')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-opacity overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl transform transition-transform my-8">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Icon name="edit" className="w-5 h-5 text-brand-600" />
            Cập nhật thông tin: {doctor.user_id.ho_ten}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {fetching ? (
          <div className="p-10 text-center text-slate-500">Đang tải thông tin...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2">
                <Icon name="alert-triangle" className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
                  {anhDaiDien ? (
                    <img src={anhDaiDien} alt={doctor.user_id.ho_ten} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-brand-600">
                      {(doctor.user_id.ho_ten || 'B').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Ảnh đại diện</label>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      <Icon name="image" className="h-4 w-4" />
                      {uploadingAvatar ? 'Đang tải...' : 'Chọn ảnh'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    </label>
                    {anhDaiDien && (
                      <button type="button" onClick={() => setAnhDaiDien(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Số năm kinh nghiệm</label>
                  <input 
                    type="number" 
                    min="0"
                    className="input w-full bg-slate-50 focus:bg-white" 
                    value={soNam} 
                    onChange={e => setSoNam(Number(e.target.value))} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Phí tư vấn (VNĐ)</label>
                  <input 
                    type="number" 
                    min="0"
                    className="input w-full bg-slate-50 focus:bg-white" 
                    value={phiTuVan} 
                    onChange={e => setPhiTuVan(Number(e.target.value))} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tiểu sử</label>
                <textarea 
                  rows={3} 
                  className="input w-full bg-slate-50 focus:bg-white resize-none" 
                  placeholder="Giới thiệu chung về bác sĩ..."
                  value={tieuSu} 
                  onChange={e => setTieuSu(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bằng cấp</label>
                <textarea 
                  rows={2} 
                  className="input w-full bg-slate-50 focus:bg-white resize-none" 
                  placeholder="Các bằng cấp, chứng chỉ..."
                  value={bangCap} 
                  onChange={e => setBangCap(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kinh nghiệm công tác</label>
                <textarea 
                  rows={3} 
                  className="input w-full bg-slate-50 focus:bg-white resize-none" 
                  placeholder="Nơi làm việc, chức vụ..."
                  value={kinhNghiem} 
                  onChange={e => setKinhNghiem(e.target.value)} 
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={laHien} onChange={e => setLaHien(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700">Hiển thị hồ sơ công khai</span>
                </label>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary px-6">Hủy</button>
              <button type="submit" disabled={loading} className="btn-primary px-6 flex items-center gap-2">
                {loading && <Icon name="loader" className="w-4 h-4 animate-spin" />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
