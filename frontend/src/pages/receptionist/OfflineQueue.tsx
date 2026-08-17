import { useEffect, useMemo, useState } from 'react'
import { EmptyBlock, LoadingBlock, MetricCard, PageShell, Panel, ReceptionistHeader, StatusBadge, TableFrame } from '@/components/receptionist/ReceptionistUI'
import { DispatchCandidate, DispatchSuggestion, OfflineQueueRow, receptionistOfflineQueueService } from '@/services/receptionist-offline-queue.service'
import QueueTicketTemplate, { QueueTicketData } from '@/components/receptionist/QueueTicketTemplate'
import { examSessionStatusLabel as statusLabel, examSessionStatusTone as statusTone, dispatchBlockReasonLabel } from '@/utils/receptionistLabels'

function formatTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function OfflineQueue() {
  const [rows, setRows] = useState<OfflineQueueRow[]>([])
  const [suggestions, setSuggestions] = useState<DispatchSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [printData, setPrintData] = useState<QueueTicketData | null>(null)

  useEffect(() => {
    if (printData) window.print()
  }, [printData])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [queueRows, suggestionResult] = await Promise.all([
        receptionistOfflineQueueService.list(),
        receptionistOfflineQueueService.suggestions(),
      ])
      setRows(queueRows)
      setSuggestions(suggestionResult.suggestions)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải hàng đợi khách vãng lai')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const suggestionByQueueId = useMemo(() => new Map(suggestions.map((item) => [item.queue_id, item])), [suggestions])
  const summary = useMemo(() => ({
    total: rows.length,
    central: rows.filter((row) => row.trang_thai === 'cho_dieu_phoi').length,
    assigned: rows.filter((row) => ['dang_cho', 'da_goi', 'trong_phong'].includes(row.trang_thai)).length,
    done: rows.filter((row) => row.trang_thai === 'hoan_thanh').length,
  }), [rows])

  const assignBest = async (row: OfflineQueueRow) => {
    const suggestion = suggestionByQueueId.get(row.id)
    const best = suggestion?.de_xuat_tot_nhat
    if (!best) return
    setActionId(row.id)
    setError('')
    setMessage('')
    try {
      await receptionistOfflineQueueService.assign(row.id, best.doctor_id, 'Điều phối theo gợi ý hệ thống')
      setMessage(`Đã điều phối ${row.ten_benh_nhan} cho ${best.bac_si || 'bác sĩ phù hợp'}.`)
      setPrintData({
        ticketType: 'kham',
        patientName: row.ten_benh_nhan,
        queueNumber: row.ma_so_thu_tu || '-',
        doctorName: best.bac_si || 'Chưa gán',
        roomNumber: best.phong_kham || 'Chưa gán',
        appointmentTime: best.gio_bat_dau ? `${best.gio_bat_dau}${best.gio_ket_thuc ? ` - ${best.gio_ket_thuc}` : ''}` : formatTime(new Date().toISOString()),
        specialtyName: row.specialty?.ten,
      })
      setConfirmingId(null)
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể điều phối lượt này')
      await load()
    } finally {
      setActionId(null)
    }
  }

  const cancelCentral = async (row: OfflineQueueRow) => {
    const reason = window.prompt(`Lý do hủy lượt chờ của ${row.ten_benh_nhan}`)
    if (!reason?.trim()) return
    setActionId(row.id)
    setError('')
    setMessage('')
    try {
      await receptionistOfflineQueueService.cancel(row.id, reason.trim())
      setMessage(`Đã hủy lượt chờ của ${row.ten_benh_nhan}.`)
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể hủy lượt chờ')
      await load()
    } finally {
      setActionId(null)
    }
  }

  const returnCentral = async (row: OfflineQueueRow) => {
    const reason = window.prompt(`Lý do trả ${row.ten_benh_nhan} về hàng đợi trung tâm`)
    if (!reason?.trim()) return
    setActionId(row.id)
    setError('')
    setMessage('')
    try {
      await receptionistOfflineQueueService.returnCentral(row.id, reason.trim())
      setMessage(`Đã trả ${row.ten_benh_nhan} về hàng đợi trung tâm.`)
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể trả về hàng đợi trung tâm')
      await load()
    } finally {
      setActionId(null)
    }
  }

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Hàng đợi khách vãng lai"
        title="Điều phối khách vãng lai trong ngày"
        description="Theo dõi khách đã tiếp nhận tại quầy, trạng thái điều phối và gán nhanh cho bác sĩ khi có khoảng an toàn."
        actions={(
          <button type="button" onClick={load} disabled={loading} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        )}
        metrics={(
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Tổng khách vãng lai" value={summary.total} />
            <MetricCard label="Chờ điều phối" value={summary.central} tone="warning" />
            <MetricCard label="Đã gán bác sĩ" value={summary.assigned} tone="info" />
            <MetricCard label="Hoàn thành" value={summary.done} tone="success" />
          </div>
        )}
      />

      {(message || error) && (
        <div className="grid gap-2">
          {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{message}</p>}
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{error}</p>}
        </div>
      )}

      <Panel title="Danh sách trong ngày" description="Khách ở trạng thái chờ điều phối chưa xuất hiện trong hàng đợi bác sĩ cho đến khi lễ tân gán bác sĩ.">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock>Chưa có khách vãng lai nào trong ngày.</EmptyBlock>
        ) : (
          <TableFrame>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Số / bệnh nhân</th>
                  <th className="px-4 py-3">Chuyên khoa</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Bác sĩ / phòng</th>
                  <th className="px-4 py-3">Gợi ý điều phối</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const suggestion = suggestionByQueueId.get(row.id)
                  const best = suggestion?.de_xuat_tot_nhat
                  return (
                    <>
                    <tr key={row.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-950">{row.ma_so_thu_tu || '-'}</p>
                        <p className="mt-1 font-semibold text-slate-900">{row.ten_benh_nhan}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.so_dien_thoai || 'Chưa có SĐT'} - vào lúc {formatTime(row.thoi_diem_vao_hang_doi_trung_tam)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.specialty?.ten || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge tone={statusTone(row.trang_thai)}>{statusLabel(row.trang_thai)}</StatusBadge></td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{row.doctor?.ho_ten || 'Chưa gán'}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.phong_kham || row.doctor?.phong_kham_mac_dinh || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.trang_thai === 'cho_dieu_phoi' ? (
                          best ? (
                            <div>
                              <p className="font-semibold text-slate-900">{best.bac_si || 'Bác sĩ phù hợp'}</p>
                              <p className="mt-1 text-xs text-slate-500">{best.gio_bat_dau || '-'}-{best.gio_ket_thuc || '-'} - {best.phong_kham || '-'}</p>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700">Chưa có bác sĩ an toàn</span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">Không cần gợi ý</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {row.trang_thai === 'cho_dieu_phoi' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmingId(confirmingId === row.id ? null : row.id)}
                                disabled={actionId === row.id || !best}
                                className="min-h-9 rounded-lg bg-brand-700 px-3 text-xs font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Gán theo gợi ý
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelCentral(row)}
                                disabled={actionId === row.id}
                                className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Hủy chờ
                              </button>
                            </>
                          )}
                          {row.trang_thai === 'dang_cho' && (
                            <button
                              type="button"
                              onClick={() => returnCentral(row)}
                              disabled={actionId === row.id}
                              className="min-h-9 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Trả về hàng đợi
                            </button>
                          )}
                          {!['cho_dieu_phoi', 'dang_cho'].includes(row.trang_thai) && (
                            <span className="text-xs font-semibold text-slate-400">Không có thao tác</span>
                          )}
                        </div>
                      </td>
                    </tr>
                      {confirmingId === row.id && suggestion && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50 px-4 py-4">
                            <p className="text-sm font-bold text-slate-800">Căn cứ gợi ý điều phối cho {row.ten_benh_nhan}</p>
                            <div className="mt-3 grid gap-2">
                              {suggestion.ung_vien.map((candidate: DispatchCandidate) => (
                                <div key={candidate.doctor_id} className={`rounded-lg border p-3 text-xs ${candidate.hop_le ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-slate-100 opacity-80'}`}>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-slate-900">{candidate.bac_si || 'Bác sĩ'}</span>
                                    <span className="text-slate-500">Phòng {candidate.phong_kham || '-'} · {candidate.gio_bat_dau || '-'}-{candidate.gio_ket_thuc || '-'} · Đang xử lý {candidate.so_luot_dang_xu_ly} lượt</span>
                                  </div>
                                  {candidate.hop_le ? (
                                    <p className="mt-1 font-semibold text-emerald-700">Phù hợp — còn khung an toàn, phòng sẵn sàng</p>
                                  ) : (
                                    <p className="mt-1 font-semibold text-rose-700">
                                      Bị chặn: {candidate.ly_do_chan.map(dispatchBlockReasonLabel).join('; ')}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                            {best && (
                              <button
                                type="button"
                                onClick={() => assignBest(row)}
                                disabled={actionId === row.id}
                                className="mt-3 min-h-9 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {actionId === row.id ? 'Đang gán...' : `Xác nhận gán ${best.bac_si || 'bác sĩ này'}`}
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Panel>

      <QueueTicketTemplate data={printData} />
      {printData && (
        <div className="print:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
          <span className="text-xs text-slate-600">Phiếu số {printData.queueNumber}</span>
          <button type="button" onClick={() => window.print()} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white hover:bg-brand-700">
            In lại phiếu
          </button>
          <button type="button" onClick={() => setPrintData(null)} className="text-slate-400 hover:text-slate-600" aria-label="Đóng thông báo in phiếu">
            x
          </button>
        </div>
      )}
    </PageShell>
  )
}
