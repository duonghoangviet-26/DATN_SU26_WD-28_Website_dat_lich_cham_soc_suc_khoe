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

export default function UpdateDoctor({ doctor, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  // Core Doctor Form States
  const [bangCap, setBangCap] = useState('')
  const [kinhNghiem, setKinhNghiem] = useState('')
  const [soNam, setSoNam] = useState(0)
  const [phiTuVan, setPhiTuVan] = useState(0)
  const [laHien, setLaHien] = useState(true)
  const [anhDaiDien, setAnhDaiDien] = useState<string | null>(doctor.user_id.anh_dai_dien || null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Professional Extended Profile States (Hồ sơ Hồng Ngọc)
  const [chucVuHienTai, setChucVuHienTai] = useState('')
  const [maCCHN, setMaCCHN] = useState('')
  const [bangCapTagsStr, setBangCapTagsStr] = useState('')
  const [ngonNguStr, setNgonNguStr] = useState('')
  const [theManhStr, setTheManhStr] = useState('')

  // Dynamic Array Fields (Đào tạo, Công tác, Giải thưởng)
  const [quaTrinhDaoTao, setQuaTrinhDaoTao] = useState<Array<{ ten_bang: string; truong: string; tu_nam?: number | null; den_nam?: number | null }>>([])
  const [quaTrinhCongTac, setQuaTrinhCongTac] = useState<Array<{ noi_cong_tac: string; chuc_vu: string; tu_nam?: number | null; den_nam?: number | null }>>([])
  const [giaiThuong, setGiaiThuong] = useState<Array<{ ten: string; nam?: number | null }>>([])

  // Fetch full details first to populate form accurately
  useEffect(() => {
    let ignore = false
    doctorService.getById(doctor._id)
      .then((detail) => {
        if (!ignore) {
          setBangCap(detail.bang_cap || '')
          setKinhNghiem(detail.kinh_nghiem || '')
          setSoNam(detail.so_nam_kinh_nghiem || 0)
          setPhiTuVan(detail.phi_kham || 0)
          setLaHien(detail.la_hien ?? true)
          setAnhDaiDien(detail.user_id.anh_dai_dien || null)

          const hs = detail.ho_so_chi_tiet
          if (hs) {
            setChucVuHienTai(hs.chuc_vu_hien_tai || hs.chuc_vu || '')
            setMaCCHN(hs.ma_cchn || '')
            setBangCapTagsStr((hs.bang_cap_hoc_vi_tags || []).join(', '))
            setNgonNguStr((hs.ngon_ngu || ['Tiếng Việt']).join(', '))
            setTheManhStr((hs.the_manh_chuyen_mon || []).join(', '))
            setQuaTrinhDaoTao(hs.qua_trinh_dao_tao?.map(d => ({
              ten_bang: d.ten_bang || '',
              truong: d.truong || '',
              tu_nam: d.tu_nam || null,
              den_nam: d.den_nam || null,
            })) || [])
            setQuaTrinhCongTac(hs.qua_trinh_cong_tac?.map(c => ({
              noi_cong_tac: c.noi_cong_tac || '',
              chuc_vu: c.chuc_vu || '',
              tu_nam: c.tu_nam || null,
              den_nam: c.den_nam || null,
            })) || [])
            setGiaiThuong(hs.giai_thuong?.map(g => ({
              ten: g.ten || '',
              nam: g.nam || null,
            })) || [])
          }

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

  // Quản lý Mảng Đào tạo
  const addDaoTaoRow = () => {
    setQuaTrinhDaoTao([...quaTrinhDaoTao, { ten_bang: '', truong: '', tu_nam: undefined, den_nam: undefined }])
  }
  const removeDaoTaoRow = (index: number) => {
    setQuaTrinhDaoTao(quaTrinhDaoTao.filter((_, i) => i !== index))
  }
  const updateDaoTaoRow = (index: number, field: string, value: any) => {
    const next = [...quaTrinhDaoTao]
    next[index] = { ...next[index], [field]: value }
    setQuaTrinhDaoTao(next)
  }

  // Quản lý Mảng Công tác
  const addCongTacRow = () => {
    setQuaTrinhCongTac([...quaTrinhCongTac, { noi_cong_tac: '', chuc_vu: '', tu_nam: undefined, den_nam: undefined }])
  }
  const removeCongTacRow = (index: number) => {
    setQuaTrinhCongTac(quaTrinhCongTac.filter((_, i) => i !== index))
  }
  const updateCongTacRow = (index: number, field: string, value: any) => {
    const next = [...quaTrinhCongTac]
    next[index] = { ...next[index], [field]: value }
    setQuaTrinhCongTac(next)
  }

  // Quản lý Mảng Giải thưởng
  const addGiaiThuongRow = () => {
    setGiaiThuong([...giaiThuong, { ten: '', nam: undefined }])
  }
  const removeGiaiThuongRow = (index: number) => {
    setGiaiThuong(giaiThuong.filter((_, i) => i !== index))
  }
  const updateGiaiThuongRow = (index: number, field: string, value: any) => {
    const next = [...giaiThuong]
    next[index] = { ...next[index], [field]: value }
    setGiaiThuong(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Parse string arrays
    const bangCapHocViTags = bangCapTagsStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const ngonNgu = ngonNguStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const theManhChuyenMon = theManhStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    // Clean dynamic arrays
    const cleanDaoTao = quaTrinhDaoTao
      .filter(d => d.ten_bang.trim())
      .map(d => ({
        ten_bang: d.ten_bang.trim(),
        truong: d.truong ? d.truong.trim() : null,
        tu_nam: d.tu_nam ? Number(d.tu_nam) : null,
        den_nam: d.den_nam ? Number(d.den_nam) : null,
      }))

    const cleanCongTac = quaTrinhCongTac
      .filter(c => c.noi_cong_tac.trim())
      .map(c => ({
        noi_cong_tac: c.noi_cong_tac.trim(),
        chuc_vu: c.chuc_vu ? c.chuc_vu.trim() : null,
        tu_nam: c.tu_nam ? Number(c.tu_nam) : null,
        den_nam: c.den_nam ? Number(c.den_nam) : null,
      }))

    const cleanGiaiThuong = giaiThuong
      .filter(g => g.ten.trim())
      .map(g => ({
        ten: g.ten.trim(),
        nam: g.nam ? Number(g.nam) : null,
      }))

    const payload: DoctorUpdatePayload = {
      bang_cap: bangCap,
      kinh_nghiem: kinhNghiem,
      so_nam_kinh_nghiem: Number(soNam),
      phi_kham: Number(phiTuVan),
      la_hien: laHien,
      anh_dai_dien: anhDaiDien,
      ho_so_chi_tiet: {
        chuc_vu_hien_tai: chucVuHienTai,
        chuc_vu: chucVuHienTai,
        ma_cchn: maCCHN,
        bang_cap_hoc_vi_tags: bangCapHocViTags,
        ngon_ngu: ngonNgu.length > 0 ? ngonNgu : ['Tiếng Việt'],
        the_manh_chuyen_mon: theManhChuyenMon,
        qua_trinh_dao_tao: cleanDaoTao,
        qua_trinh_cong_tac: cleanCongTac,
        giai_thuong: cleanGiaiThuong,
      },
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
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl transform transition-transform my-8 max-h-[90vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Icon name="edit" className="w-5 h-5 text-brand-600" />
              Cập nhật hồ sơ bác sĩ: {doctor.user_id.ho_ten}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Chuyên khoa Tai Mũi Họng — Hồ sơ nghiệp vụ chuẩn Bệnh viện</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-slate-500 font-medium">Đang tải thông tin hồ sơ...</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2">
                <Icon name="alert-triangle" className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Avatar & Hiển thị */}
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
                <label className="mb-2 block text-sm font-semibold text-slate-700">Ảnh đại diện bác sĩ</label>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                    <Icon name="image" className="h-4 w-4" />
                    {uploadingAvatar ? 'Đang tải...' : 'Tải ảnh mới'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                  </label>
                  {anhDaiDien && (
                    <button type="button" onClick={() => setAnhDaiDien(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">
                      Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Thông tin cơ bản */}
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">I. Thông tin vận hành & Kinh nghiệm</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số năm kinh nghiệm</label>
                  <input 
                    type="number" 
                    min="0"
                    className="input w-full bg-white text-sm" 
                    value={soNam} 
                    onChange={e => setSoNam(Number(e.target.value))} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phí khám cơ bản (VNĐ)</label>
                  <input 
                    type="number" 
                    min="0"
                    className="input w-full bg-white text-sm" 
                    value={phiTuVan} 
                    onChange={e => setPhiTuVan(Number(e.target.value))} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chức vụ hiện tại</label>
                  <input 
                    type="text" 
                    className="input w-full bg-white text-sm" 
                    placeholder="VD: Bác sĩ Tai Mũi Họng..."
                    value={chucVuHienTai} 
                    onChange={e => setChucVuHienTai(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mã CCHN (Chứng chỉ hành nghề)</label>
                  <input 
                    type="text" 
                    className="input w-full bg-white text-sm font-mono" 
                    placeholder="VD: 012345/BYT-CCHN"
                    value={maCCHN} 
                    onChange={e => setMaCCHN(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bằng cấp & Học vị (phân cách bằng phẩy)</label>
                  <input 
                    type="text" 
                    className="input w-full bg-white text-sm" 
                    placeholder="VD: BSCKI, Thạc sĩ Y khoa..."
                    value={bangCapTagsStr} 
                    onChange={e => setBangCapTagsStr(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ngôn ngữ giao tiếp (phân cách bằng phẩy)</label>
                  <input 
                    type="text" 
                    className="input w-full bg-white text-sm" 
                    placeholder="VD: Tiếng Việt, Tiếng Anh..."
                    value={ngonNguStr} 
                    onChange={e => setNgonNguStr(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Học vấn & Quá trình đào tạo */}
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">II. Học vấn & Quá trình đào tạo</h4>
                <button 
                  type="button" 
                  onClick={addDaoTaoRow}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" /> Thêm bằng cấp/đào tạo
                </button>
              </div>

              {quaTrinhDaoTao.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có dòng đào tạo nào. Bấm "Thêm" để điền mốc học vấn.</p>
              ) : (
                <div className="space-y-2">
                  {quaTrinhDaoTao.map((row, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input 
                          type="text" 
                          placeholder="Tên bằng / Chuyên khoa"
                          className="input w-full text-xs" 
                          value={row.ten_bang} 
                          onChange={e => updateDaoTaoRow(idx, 'ten_bang', e.target.value)}
                        />
                      </div>
                      <div className="col-span-4">
                        <input 
                          type="text" 
                          placeholder="Trường / Cơ sở đào tạo"
                          className="input w-full text-xs" 
                          value={row.truong} 
                          onChange={e => updateDaoTaoRow(idx, 'truong', e.target.value)}
                        />
                      </div>
                      <div className="col-span-1">
                        <input 
                          type="number" 
                          placeholder="Từ năm"
                          className="input w-full text-xs p-1 text-center" 
                          value={row.tu_nam || ''} 
                          onChange={e => updateDaoTaoRow(idx, 'tu_nam', e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </div>
                      <div className="col-span-1">
                        <input 
                          type="number" 
                          placeholder="Đến năm"
                          className="input w-full text-xs p-1 text-center" 
                          value={row.den_nam || ''} 
                          onChange={e => updateDaoTaoRow(idx, 'den_nam', e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          type="button" 
                          onClick={() => removeDaoTaoRow(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quá trình công tác */}
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">III. Hoạt động chuyên ngành & Quá trình công tác</h4>
                <button 
                  type="button" 
                  onClick={addCongTacRow}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" /> Thêm mốc công tác
                </button>
              </div>

              {quaTrinhCongTac.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có dòng quá trình công tác. Bấm "Thêm" để điền nơi làm việc.</p>
              ) : (
                <div className="space-y-2">
                  {quaTrinhCongTac.map((row, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input 
                          type="text" 
                          placeholder="Bệnh viện / Nơi công tác"
                          className="input w-full text-xs" 
                          value={row.noi_cong_tac} 
                          onChange={e => updateCongTacRow(idx, 'noi_cong_tac', e.target.value)}
                        />
                      </div>
                      <div className="col-span-4">
                        <input 
                          type="text" 
                          placeholder="Chức vụ đảm nhiệm"
                          className="input w-full text-xs" 
                          value={row.chuc_vu} 
                          onChange={e => updateCongTacRow(idx, 'chuc_vu', e.target.value)}
                        />
                      </div>
                      <div className="col-span-1">
                        <input 
                          type="number" 
                          placeholder="Từ năm"
                          className="input w-full text-xs p-1 text-center" 
                          value={row.tu_nam || ''} 
                          onChange={e => updateCongTacRow(idx, 'tu_nam', e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </div>
                      <div className="col-span-1">
                        <input 
                          type="number" 
                          placeholder="Đến năm"
                          className="input w-full text-xs p-1 text-center" 
                          value={row.den_nam || ''} 
                          onChange={e => updateCongTacRow(idx, 'den_nam', e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          type="button" 
                          onClick={() => removeCongTacRow(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Giải thưởng & Danh hiệu */}
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">IV. Giải thưởng & Danh hiệu ghi nhận</h4>
                <button 
                  type="button" 
                  onClick={addGiaiThuongRow}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" /> Thêm giải thưởng
                </button>
              </div>

              {giaiThuong.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có dòng giải thưởng. Bấm "Thêm" để bổ sung danh hiệu.</p>
              ) : (
                <div className="space-y-2">
                  {giaiThuong.map((row, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-9">
                        <input 
                          type="text" 
                          placeholder="Tên giải thưởng / Danh hiệu"
                          className="input w-full text-xs" 
                          value={row.ten} 
                          onChange={e => updateGiaiThuongRow(idx, 'ten', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" 
                          placeholder="Năm nhận"
                          className="input w-full text-xs p-1 text-center" 
                          value={row.nam || ''} 
                          onChange={e => updateGiaiThuongRow(idx, 'nam', e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          type="button" 
                          onClick={() => removeGiaiThuongRow(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkbox Trạng thái hiển thị */}
            <div className="flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={laHien} onChange={e => setLaHien(e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                <span className="ml-3 text-sm font-medium text-slate-700">Hiển thị hồ sơ công khai trên hệ thống</span>
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 shrink-0">
              <button type="button" onClick={onClose} className="btn-secondary px-6">Hủy</button>
              <button type="submit" disabled={loading} className="btn-primary px-6 flex items-center gap-2">
                {loading && <Icon name="loader" className="w-4 h-4 animate-spin" />}
                Lưu toàn bộ thay đổi
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
