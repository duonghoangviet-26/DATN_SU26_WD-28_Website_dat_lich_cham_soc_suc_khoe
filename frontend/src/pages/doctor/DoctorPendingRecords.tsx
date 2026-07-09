import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { examinationService } from '@/services/examination.service'
import type { DoctorPendingRecord, ExaminationResult, KetQuaKhamStatus } from '@/types'
import { formatDate } from '@/utils/format'

const KET_QUA_STATUS_LABEL: Record<KetQuaKhamStatus, string> = {
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  yeu_cau_chinh_sua: 'Cần chỉnh sửa',
}
const KET_QUA_STATUS_COLOR: Record<KetQuaKhamStatus, 'yellow' | 'green' | 'red'> = {
  cho_xac_nhan: 'yellow', da_xac_nhan: 'green', yeu_cau_chinh_sua: 'red',
}

const TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'

// ─── Modal xem chi tiết hồ sơ (chỉ xem — xác nhận/yêu cầu chỉnh sửa thực hiện ở
// trang Lịch hẹn của tôi, màn Chi tiết lịch hẹn) ──────────────────────────────
function RecordViewModal({ record, onClose }: { record: DoctorPendingRecord; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ExaminationResult | null>(null)

  useEffect(() => {
    examinationService.getByAppointment(record.appointment_id)
      .then(setResult)
      .finally(() => setLoading(false))
  }, [record.appointment_id])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="font-semibold text-slate-800">Hồ sơ khám</p>
            <p className="text-sm text-slate-500">
              {record.benh_nhan} · {formatDate(record.ngay_kham)}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-slate-400">Đang tải...</div>
        ) : !result ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <Icon name="file-text" className="h-8 w-8 text-slate-200" />
            <p className="text-sm">Không tìm thấy nội dung hồ sơ.</p>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5 text-sm">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dịch vụ</p>
                <p className="mt-0.5 text-slate-700">{record.ten_dich_vu ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Y tá nhập</p>
                <p className="mt-0.5 text-slate-700">{record.nguoi_nhap ?? 'Không rõ'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Trạng thái</p>
                <p className="mt-0.5">
                  <Badge color={KET_QUA_STATUS_COLOR[record.status]}>{KET_QUA_STATUS_LABEL[record.status]}</Badge>
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chẩn đoán</p>
              <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{result.chan_doan}</p>
            </div>

            {result.huong_dan_dieu_tri && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hướng dẫn điều trị</p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{result.huong_dan_dieu_tri}</p>
              </div>
            )}

            {result.ghi_chu && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ghi chú</p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{result.ghi_chu}</p>
              </div>
            )}

            {result.ngay_tai_kham && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ngày tái khám</p>
                <p className="mt-0.5 text-slate-700">{formatDate(result.ngay_tai_kham)}</p>
              </div>
            )}

            {result.thuoc.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Đơn thuốc</p>
                <ul className="space-y-1.5">
                  {result.thuoc.map((t) => (
                    <li key={t.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{t.ten_thuoc}</span>
                      {t.lieu_luong && <span> · {t.lieu_luong}</span>}
                      {t.tan_suat && <span> · {t.tan_suat}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorPendingRecords() {
  const [records, setRecords] = useState<DoctorPendingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [viewing, setViewing] = useState<DoctorPendingRecord | null>(null)

  useEffect(() => {
    doctorAppointmentService.listPendingResults()
      .then(setRecords)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title="Hồ sơ chờ xác nhận"
        description="Hồ sơ khám đang chờ bạn xác nhận (WAITING_DOCTOR_CONFIRM) — của riêng bạn."
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được danh sách hồ sơ chờ xác nhận. Vui lòng thử lại sau.</p>
        </div>
      ) : records.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white">
          <Icon name="file-text" className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Không có hồ sơ nào đang chờ xác nhận.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className={TH_PLAIN}>Ngày khám</th>
                  <th className={TH_PLAIN}>Tên bệnh nhân</th>
                  <th className={TH_PLAIN}>Dịch vụ</th>
                  <th className={TH_PLAIN}>Y tá nhập</th>
                  <th className={TH_PLAIN}>Trạng thái hồ sơ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{formatDate(r.ngay_kham)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {r.benh_nhan.charAt(0)}
                        </div>
                        <p className="font-medium text-slate-800">{r.benh_nhan}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.ten_dich_vu ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.nguoi_nhap ?? 'Không rõ'}</td>
                    <td className="px-4 py-3">
                      <Badge color={KET_QUA_STATUS_COLOR[r.status]}>{KET_QUA_STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setViewing(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <Icon name="eye" className="h-3 w-3" /> Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewing && <RecordViewModal record={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
