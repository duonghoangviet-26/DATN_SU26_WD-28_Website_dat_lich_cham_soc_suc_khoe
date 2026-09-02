import { useEffect, useState } from 'react'
import Modal from '@/components/common/Modal'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Icon from '@/components/admin/icons'
import ExamHistoryDetailModal from '@/components/doctor/ExamHistoryDetailModal'
import { doctorAppointmentService } from '@/services/doctor-appointment.service'
import { formatDateTime } from '@/utils/format'

interface Props {
  patientProfileId: string
  patientName: string
  onClose: () => void
}

const TH = 'px-4 py-3 text-xs font-semibold text-slate-600'

export default function PatientHistoryModal({ patientProfileId, patientName, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<{ profile: any; visits: any[] } | null>(null)
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    doctorAppointmentService
      .getPatientProfileHistory(patientProfileId)
      .then(setHistory)
      .catch((e) => {
        const msg = (e as any).response?.data?.message || 'Không thể tải lịch sử khám bệnh.'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [patientProfileId])

  return (
    <Modal isOpen title={`Lịch sử khám - ${patientName}`} onClose={onClose} size="xl">
      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Đang tải lịch sử...</div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : history && history.visits.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200 text-left">
                <th className={TH}>Thời gian</th>
                <th className={TH}>Nguồn</th>
                <th className={TH}>Chẩn đoán</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {history.visits.map((v, i) => {
                const isExamined = v.ket_qua || (v.status === 'hoan_thanh' || v.status === 'completed')
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(v.ngay_kham)}
                    </td>
                    <td className="px-4 py-3">
                      {v.source === 'offline' ? (
                        <Badge color="yellow">Vãng lai</Badge>
                      ) : (
                        <Badge color="blue">Đặt online</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">
                      {v.ket_qua?.chan_doan || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={isExamined ? 'green' : 'gray'}>
                        {isExamined ? 'Đã khám' : 'Chưa khám'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {v.hang_doi_id && isExamined ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Icon name="eye" className="h-3.5 w-3.5" />}
                          onClick={() => setActiveQueueId(v.hang_doi_id)}
                        >
                          Chi tiết
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Không có hồ sơ</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-slate-500">
          Chưa có lịch sử khám bệnh nào cho bệnh nhân này.
        </div>
      )}

      {activeQueueId && (
        <ExamHistoryDetailModal
          queueId={activeQueueId}
          onClose={() => setActiveQueueId(null)}
          onAmended={() => {}}
        />
      )}
    </Modal>
  )
}
