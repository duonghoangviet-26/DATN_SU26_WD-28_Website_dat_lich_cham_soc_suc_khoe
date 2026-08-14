import { useEffect, useMemo, useState } from 'react'
import { EmptyBlock, LoadingBlock, MetricCard, PageShell, Panel, ReceptionistHeader, StatusBadge, TableFrame } from '@/components/receptionist/ReceptionistUI'
import { DispatchSuggestion, OfflineQueueRow, receptionistOfflineQueueService } from '@/services/receptionist-offline-queue.service'

function formatTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function statusLabel(status: OfflineQueueRow['trang_thai']) {
  return ({
    cho_dieu_phoi: 'Cho dieu phoi',
    dang_cho: 'Da gan bac si',
    da_goi: 'Da goi',
    trong_phong: 'Trong phong',
    cho_dich_vu: 'Cho dich vu',
    skipped: 'Bo luot',
    cancelled: 'Da huy',
    hoan_thanh: 'Hoan thanh',
  } as Record<string, string>)[status] ?? status
}

function statusTone(status: OfflineQueueRow['trang_thai']) {
  if (status === 'cho_dieu_phoi') return 'warning'
  if (status === 'dang_cho' || status === 'da_goi') return 'info'
  if (status === 'trong_phong') return 'brand'
  if (status === 'hoan_thanh') return 'success'
  if (status === 'cancelled' || status === 'skipped') return 'danger'
  return 'neutral'
}

export default function OfflineQueue() {
  const [rows, setRows] = useState<OfflineQueueRow[]>([])
  const [suggestions, setSuggestions] = useState<DispatchSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
      setError(requestError?.response?.data?.message || 'Khong the tai hang doi khach vang lai')
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
      await receptionistOfflineQueueService.assign(row.id, best.doctor_id, 'Dieu phoi theo goi y he thong')
      setMessage(`Da dieu phoi ${row.ten_benh_nhan} cho ${best.bac_si || 'bac si phu hop'}.`)
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khong the dieu phoi luot nay')
      await load()
    } finally {
      setActionId(null)
    }
  }

  const cancelCentral = async (row: OfflineQueueRow) => {
    const reason = window.prompt(`Ly do huy luot cho cua ${row.ten_benh_nhan}`)
    if (!reason?.trim()) return
    setActionId(row.id)
    setError('')
    setMessage('')
    try {
      await receptionistOfflineQueueService.cancel(row.id, reason.trim())
      setMessage(`Da huy luot cho cua ${row.ten_benh_nhan}.`)
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khong the huy luot cho')
      await load()
    } finally {
      setActionId(null)
    }
  }

  const returnCentral = async (row: OfflineQueueRow) => {
    const reason = window.prompt(`Ly do tra ${row.ten_benh_nhan} ve hang doi trung tam`)
    if (!reason?.trim()) return
    setActionId(row.id)
    setError('')
    setMessage('')
    try {
      await receptionistOfflineQueueService.returnCentral(row.id, reason.trim())
      setMessage(`Da tra ${row.ten_benh_nhan} ve hang doi trung tam.`)
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Khong the tra ve hang doi trung tam')
      await load()
    } finally {
      setActionId(null)
    }
  }

  return (
    <PageShell>
      <ReceptionistHeader
        eyebrow="Hang doi khach vang lai"
        title="Dieu phoi khach vang lai trong ngay"
        description="Theo doi khach da tiep nhan tai quay, trang thai dieu phoi va gan nhanh cho bac si khi co khoang an toan."
        actions={(
          <button type="button" onClick={load} disabled={loading} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {loading ? 'Dang tai...' : 'Lam moi'}
          </button>
        )}
        metrics={(
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Tong khach vang lai" value={summary.total} />
            <MetricCard label="Cho dieu phoi" value={summary.central} tone="warning" />
            <MetricCard label="Da gan bac si" value={summary.assigned} tone="info" />
            <MetricCard label="Hoan thanh" value={summary.done} tone="success" />
          </div>
        )}
      />

      {(message || error) && (
        <div className="grid gap-2">
          {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{message}</p>}
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{error}</p>}
        </div>
      )}

      <Panel title="Danh sach trong ngay" description="Khach o trang thai cho dieu phoi chua xuat hien trong hang doi bac si cho den khi le tan gan bac si.">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock>Chua co khach vang lai nao trong ngay.</EmptyBlock>
        ) : (
          <TableFrame>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-4 py-3">So / benh nhan</th>
                  <th className="px-4 py-3">Chuyen khoa</th>
                  <th className="px-4 py-3">Trang thai</th>
                  <th className="px-4 py-3">Bac si / phong</th>
                  <th className="px-4 py-3">Goi y dieu phoi</th>
                  <th className="px-4 py-3 text-right">Thao tac</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const suggestion = suggestionByQueueId.get(row.id)
                  const best = suggestion?.de_xuat_tot_nhat
                  return (
                    <tr key={row.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-950">{row.ma_so_thu_tu || '-'}</p>
                        <p className="mt-1 font-semibold text-slate-900">{row.ten_benh_nhan}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.so_dien_thoai || 'Chua co SDT'} - vao luc {formatTime(row.thoi_diem_vao_hang_doi_trung_tam)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.specialty?.ten || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge tone={statusTone(row.trang_thai)}>{statusLabel(row.trang_thai)}</StatusBadge></td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{row.doctor?.ho_ten || 'Chua gan'}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.phong_kham || row.doctor?.phong_kham_mac_dinh || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.trang_thai === 'cho_dieu_phoi' ? (
                          best ? (
                            <div>
                              <p className="font-semibold text-slate-900">{best.bac_si || 'Bac si phu hop'}</p>
                              <p className="mt-1 text-xs text-slate-500">{best.gio_bat_dau || '-'}-{best.gio_ket_thuc || '-'} - {best.phong_kham || '-'}</p>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700">Chua co bac si an toan</span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">Khong can goi y</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {row.trang_thai === 'cho_dieu_phoi' && (
                            <>
                              <button
                                type="button"
                                onClick={() => assignBest(row)}
                                disabled={actionId === row.id || !best}
                                className="min-h-9 rounded-lg bg-brand-700 px-3 text-xs font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Gan bac si
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelCentral(row)}
                                disabled={actionId === row.id}
                                className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Huy cho
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
                              Tra ve hang doi
                            </button>
                          )}
                          {!['cho_dieu_phoi', 'dang_cho'].includes(row.trang_thai) && (
                            <span className="text-xs font-semibold text-slate-400">Khong co thao tac</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Panel>
    </PageShell>
  )
}
