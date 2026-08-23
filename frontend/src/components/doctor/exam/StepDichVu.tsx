import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { doctorExamSessionService } from '@/services/doctor-exam-session.service'
import type { DichVuHinhAnh, PhienKham } from '@/services/doctor-exam-session.service'
import { formatPrice } from '@/utils/format'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

const TU_KHOA_DICH_VU_CAN_ANH = ['noi soi', 'x quang', 'x-quang', 'sieu am', 'mri', 'ct']

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function serviceRequiresImage(service: PhienKham['dich_vu_kha_dung'][number]) {
  const haystack = normalizeSearch(`${service.ten} ${service.ma_dich_vu ?? ''}`)
  return TU_KHOA_DICH_VU_CAN_ANH.some((keyword) => haystack.includes(keyword))
}

function getExistingImages(phien: PhienKham) {
  const map: Record<string, DichVuHinhAnh[]> = {}
  for (const service of phien.ho_so?.dich_vu_phat_sinh ?? []) {
    map[service.service_id] = (service.hinh_anh ?? []).map((image) => ({
      url: image.url,
      mo_ta: image.mo_ta ?? null,
      uploaded_at: image.uploaded_at ?? null,
    }))
  }
  return map
}

// Bác sĩ KHÔNG chạm tiền (quyết định Q2) — payload chỉ gửi service_id + so_luong + ảnh kết quả,
// đơn giá/thành tiền hiển thị ở đây chỉ là ước tính để bác sĩ tham khảo, backend tự tính lại từ DichVu.gia.
export default function StepDichVu({ phien, saving, onNext }: Props) {
  const [soLuong, setSoLuong] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const d of phien.ho_so?.dich_vu_phat_sinh ?? []) {
      map[d.service_id] = d.so_luong
    }
    return map
  })
  const [hinhAnh, setHinhAnh] = useState<Record<string, DichVuHinhAnh[]>>(() => getExistingImages(phien))
  const [uploadingServiceId, setUploadingServiceId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const dsKhaDung = phien.dich_vu_kha_dung
  const dichVuCanAnhDaChon = useMemo(
    () => dsKhaDung.filter((dv) => dv.service_id in soLuong && serviceRequiresImage(dv)),
    [dsKhaDung, soLuong],
  )

  function toggle(serviceId: string) {
    setLocalError(null)
    setSoLuong((prev) => {
      const next = { ...prev }
      if (serviceId in next) {
        delete next[serviceId]
        setHinhAnh((current) => {
          const copy = { ...current }
          delete copy[serviceId]
          return copy
        })
      } else {
        next[serviceId] = 1
      }
      return next
    })
  }

  function setSoLuongDong(serviceId: string, value: string) {
    const n = Math.max(1, Number(value) || 1)
    setSoLuong((prev) => ({ ...prev, [serviceId]: n }))
  }

  async function handleUpload(serviceId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const currentCount = hinhAnh[serviceId]?.length ?? 0
    if (currentCount + files.length > 10) {
      setLocalError('Mỗi dịch vụ chỉ được đính kèm tối đa 10 ảnh.')
      return
    }

    setLocalError(null)
    setUploadingServiceId(serviceId)
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => ({
          url: await doctorExamSessionService.uploadExamImage(file),
          mo_ta: null,
        })),
      )
      setHinhAnh((prev) => ({
        ...prev,
        [serviceId]: [...(prev[serviceId] ?? []), ...uploaded],
      }))
    } catch {
      setLocalError('Không thể tải ảnh lên. Vui lòng kiểm tra file ảnh và thử lại.')
    } finally {
      setUploadingServiceId(null)
    }
  }

  function removeImage(serviceId: string, url: string) {
    setHinhAnh((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] ?? []).filter((image) => image.url !== url),
    }))
  }

  const tongTien = useMemo(
    () =>
      dsKhaDung.reduce((sum, dv) => {
        const sl = soLuong[dv.service_id]
        return sl ? sum + sl * dv.gia : sum
      }, 0),
    [dsKhaDung, soLuong],
  )

  function buildPayload() {
    return {
      dich_vu_phat_sinh: Object.entries(soLuong).map(([service_id, so_luong]) => ({
        service_id,
        so_luong,
        hinh_anh: hinhAnh[service_id] ?? [],
      })),
    }
  }

  function handleSubmit() {
    const missing = dichVuCanAnhDaChon.filter((dv) => (hinhAnh[dv.service_id]?.length ?? 0) === 0)
    if (missing.length > 0) {
      setLocalError(`Cần thêm ảnh kết quả cho dịch vụ: ${missing.map((dv) => dv.ten).join(', ')}.`)
      return
    }
    setLocalError(null)
    onNext(buildPayload())
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Chỉ định dịch vụ</h2>
        {dsKhaDung.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Chuyên khoa hiện chưa cấu hình dịch vụ liên quan. Có thể bỏ qua bước này.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-xs font-semibold text-slate-600">Dịch vụ</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-600">Đơn giá</th>
                  <th className="w-24 px-3 py-2 text-xs font-semibold text-slate-600">Số lượng</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-600">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dsKhaDung.map((dv) => {
                  const daChon = dv.service_id in soLuong
                  const sl = soLuong[dv.service_id] ?? 1
                  const canAnh = serviceRequiresImage(dv)
                  return (
                    <tr key={dv.service_id} className={daChon ? 'bg-brand-50/40' : undefined}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={daChon}
                          onChange={() => toggle(dv.service_id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{dv.ten}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {dv.ma_dich_vu && <p className="text-xs text-slate-400">{dv.ma_dich_vu}</p>}
                          {canAnh && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              Cần ảnh kết quả
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatPrice(dv.gia)}</td>
                      <td className="px-3 py-2">
                        {daChon && (
                          <input
                            type="number"
                            min={1}
                            value={sl}
                            onChange={(e) => setSoLuongDong(dv.service_id, e.target.value)}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {daChon ? formatPrice(sl * dv.gia) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dichVuCanAnhDaChon.length > 0 && (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Ảnh kết quả dịch vụ</h3>
            <p className="mt-1 text-sm text-slate-500">
              Dịch vụ nội soi hoặc chẩn đoán hình ảnh cần có ảnh kèm hồ sơ trước khi chuyển bước.
            </p>
          </div>

          <div className="space-y-4">
            {dichVuCanAnhDaChon.map((dv) => {
              const images = hinhAnh[dv.service_id] ?? []
              const uploading = uploadingServiceId === dv.service_id
              return (
                <div key={dv.service_id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{dv.ten}</p>
                      <p className="text-xs text-slate-500">{images.length} ảnh đã tải lên</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      {uploading ? 'Đang tải...' : 'Thêm ảnh'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={saving || uploading}
                        onChange={(event) => handleUpload(dv.service_id, event)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {images.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {images.map((image) => (
                        <div key={image.url} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img src={image.url} alt={`Ảnh kết quả ${dv.ten}`} className="aspect-square w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(dv.service_id, image.url)}
                            className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-red-600 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Chưa có ảnh kết quả cho dịch vụ này.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {localError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {localError}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-500">
          Bác sĩ không thu tiền. Lễ tân thu ở quầy khi bệnh nhân ra về.
        </p>
        <p className="text-sm font-semibold text-slate-900">Tổng (ước tính): {formatPrice(tongTien)}</p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          disabled={saving || uploadingServiceId !== null}
          onClick={() => onNext({ dich_vu_phat_sinh: [] })}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40"
        >
          Bỏ qua bước này
        </button>
        <button
          type="button"
          disabled={saving || uploadingServiceId !== null}
          onClick={handleSubmit}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Đang lưu...' : 'Đã thực hiện xong → Kê đơn'}
        </button>
      </div>
    </div>
  )
}
