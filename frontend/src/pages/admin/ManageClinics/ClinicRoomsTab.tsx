import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type {
  ClinicRoomDoctor,
  ClinicRoomItem,
  ClinicRoomNurse,
  ClinicRoomOptions,
  ClinicRoomPayload,
} from '@/types'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { clinicService } from '@/services/clinic.service'

interface Props {
  rooms: ClinicRoomItem[]
  options: ClinicRoomOptions
  loading: boolean
  onChanged: () => Promise<void>
}

type RoomStatusFilter = 'active' | 'inactive'
const CLINIC_BUILDING_NAME = 'ViteFamily'

const emptyForm: ClinicRoomPayload = {
  ten: '',
  tang: 1,
  toa: CLINIC_BUILDING_NAME,
  loai: '',
  trang_thai: 'active',
  doctor_ids: [],
  nurse_ids: [],
}

export default function ClinicRoomsTab({ rooms, options, loading, onChanged }: Props) {
  const [statusFilter, setStatusFilter] = useState<RoomStatusFilter>('active')
  const [keyword, setKeyword] = useState('')
  const [editingRoom, setEditingRoom] = useState<ClinicRoomItem | null | undefined>(undefined)
  const [deletingRoom, setDeletingRoom] = useState<ClinicRoomItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visibleRooms = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return rooms.filter((room) => {
      if (room.trang_thai !== statusFilter) return false
      if (!normalizedKeyword) return true
      return [room.ten, room.full_name, room.toa, room.loai]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedKeyword))
    })
  }, [keyword, rooms, statusFilter])

  const activeCount = rooms.filter((room) => room.trang_thai === 'active').length
  const inactiveCount = rooms.filter((room) => room.trang_thai === 'inactive').length

  async function saveRoom(payload: ClinicRoomPayload) {
    setSaving(true)
    setError(null)
    try {
      if (editingRoom?._id) {
        await clinicService.updateRoom(editingRoom._id, payload)
      } else {
        await clinicService.createRoom(payload)
      }
      setEditingRoom(undefined)
      await onChanged()
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể lưu phòng khám nhỏ.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRoom() {
    if (!deletingRoom) return
    const id = deletingRoom._id
    setDeletingRoom(null)
    setError(null)
    try {
      await clinicService.deleteRoom(id)
      await onChanged()
    } catch (nextError: any) {
      setError(nextError?.response?.data?.message || nextError.message || 'Không thể xóa phòng khám nhỏ.')
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Danh sách phòng khám nhỏ ({rooms.length})</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Quản lý phòng vật lý, bác sĩ và y tá phụ trách trong từng phòng.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="input h-10 w-full pl-9 sm:w-64"
                placeholder="Tìm phòng, tòa, loại phòng"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setEditingRoom(null)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Icon name="plus" className="h-4 w-4" />
              Thêm phòng
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 border-b border-slate-100 bg-slate-50/50 px-5 pt-3">
          <StatusTab
            active={statusFilter === 'active'}
            label={`Đang sử dụng (${activeCount})`}
            onClick={() => setStatusFilter('active')}
          />
          <StatusTab
            active={statusFilter === 'inactive'}
            label={`Ngừng sử dụng (${inactiveCount})`}
            onClick={() => setStatusFilter('inactive')}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="w-16 px-5 py-3 text-center font-medium">STT</th>
                <th className="px-5 py-3 font-medium">Phòng</th>
                <th className="px-5 py-3 font-medium">Vị trí</th>
                <th className="px-5 py-3 font-medium">Bác sĩ</th>
                <th className="px-5 py-3 font-medium">Y tá</th>
                <th className="px-5 py-3 font-medium">Lịch tương lai</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    Đang tải dữ liệu phòng...
                  </td>
                </tr>
              ) : visibleRooms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    Chưa có phòng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                visibleRooms.map((room, index) => (
                  <tr key={room._id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{room.ten}</p>
                      <p className="mt-1 text-xs text-slate-400">{room.loai}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-700">Tầng {room.tang}, Tòa {room.toa}</p>
                      <p className="mt-1 text-xs text-slate-400">{room.full_name}</p>
                    </td>
                    <td className="min-w-56 px-5 py-4">
                      <StaffPreview people={room.doctor_ids} fallback="Chưa gán bác sĩ" />
                    </td>
                    <td className="min-w-52 px-5 py-4">
                      <StaffPreview people={room.nurse_ids} fallback="Chưa gán y tá" />
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{room.future_schedule_count} ca</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {room.active_appointment_count > 0
                          ? `${room.active_appointment_count} lịch đang xử lý`
                          : 'Không có lịch đang xử lý'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge color={room.trang_thai === 'active' ? 'green' : 'gray'}>
                        {room.trang_thai === 'active' ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null)
                            setEditingRoom(room)
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                          title="Sửa phòng và chuyển nhân sự"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRoom(room)}
                          className="inline-flex items-center justify-center rounded-lg border border-red-100 bg-white p-2 text-red-500 transition-colors hover:bg-red-50"
                          title="Xóa phòng"
                        >
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RoomEditorModal
        key={editingRoom?._id ?? 'new'}
        open={editingRoom !== undefined}
        room={editingRoom ?? null}
        options={options}
        saving={saving}
        onClose={() => {
          setEditingRoom(undefined)
          setError(null)
        }}
        onSubmit={saveRoom}
      />

      <ConfirmDialog
        open={!!deletingRoom}
        title="Xóa phòng khám nhỏ"
        message={`Bạn có chắc muốn xóa "${deletingRoom?.full_name}"? Backend sẽ chặn nếu phòng còn lịch hẹn đang xử lý.`}
        confirmText="Xóa phòng"
        danger
        onConfirm={deleteRoom}
        onCancel={() => setDeletingRoom(null)}
      />
    </div>
  )
}

function StatusTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
        active
          ? 'border-brand-500 text-brand-600'
          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function StaffPreview({ people, fallback }: { people: Array<ClinicRoomDoctor | ClinicRoomNurse>; fallback: string }) {
  if (!people.length) return <span className="text-xs italic text-slate-400">{fallback}</span>

  const first = people.slice(0, 2)
  const extra = people.length - first.length

  return (
    <div className="space-y-1">
      {first.map((person) => (
        <p key={person._id} className="font-medium text-slate-700">{person.ho_ten}</p>
      ))}
      {extra > 0 && <p className="text-xs text-slate-400">+{extra} nhân sự khác</p>}
    </div>
  )
}

function RoomEditorModal({
  open,
  room,
  options,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  room: ClinicRoomItem | null
  options: ClinicRoomOptions
  saving: boolean
  onClose: () => void
  onSubmit: (payload: ClinicRoomPayload) => Promise<void>
}) {
  const [form, setForm] = useState<ClinicRoomPayload>(() => roomToForm(room))
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(roomToForm(room))
    setLocalError(null)
  }, [open, room])

  if (!open) return null

  function updateField<K extends keyof ClinicRoomPayload>(field: K, value: ClinicRoomPayload[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleId(field: 'doctor_ids' | 'nurse_ids', id: string) {
    setForm((current) => {
      const exists = current[field].includes(id)
      return {
        ...current,
        [field]: exists ? current[field].filter((item) => item !== id) : [...current[field], id],
      }
    })
  }

  function validate() {
    if (!form.ten.trim()) return 'Vui lòng nhập tên phòng.'
    if (!Number.isInteger(Number(form.tang)) || Number(form.tang) < 1) return 'Tầng phải là số nguyên lớn hơn 0.'
    if (!form.loai.trim()) return 'Vui lòng nhập loại phòng.'
    return null
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const message = validate()
    if (message) {
      setLocalError(message)
      return
    }
    setLocalError(null)
    await onSubmit({
      ...form,
      ten: form.ten.trim(),
      toa: CLINIC_BUILDING_NAME,
      loai: form.loai.trim(),
      tang: Number(form.tang),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {room ? 'Sửa phòng khám nhỏ' : 'Thêm phòng khám nhỏ'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Thay đổi bác sĩ sẽ cập nhật phòng mặc định và các lịch tương lai còn trống.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {localError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {localError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Tên phòng">
              <input
                value={form.ten}
                onChange={(event) => updateField('ten', event.target.value)}
                className="input w-full"
                placeholder="Phòng 101"
              />
            </Field>
            <Field label="Tầng">
              <input
                type="number"
                min={1}
                max={99}
                value={form.tang}
                onChange={(event) => updateField('tang', Number(event.target.value))}
                className="input w-full"
              />
            </Field>
            <Field label="Trạng thái">
              <select
                value={form.trang_thai}
                onChange={(event) => updateField('trang_thai', event.target.value as ClinicRoomPayload['trang_thai'])}
                className="input w-full"
              >
                <option value="active">Đang sử dụng</option>
                <option value="inactive">Ngừng sử dụng</option>
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Loại phòng">
              <input
                value={form.loai}
                onChange={(event) => updateField('loai', event.target.value)}
                className="input w-full"
                placeholder="Khám nhi, da liễu, tai mũi họng..."
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <StaffPicker
              title="Bác sĩ trong phòng"
              icon="doctor"
              items={options.doctors}
              selectedIds={form.doctor_ids}
              emptyText="Chưa có bác sĩ đủ điều kiện để gán phòng."
              onToggle={(id) => toggleId('doctor_ids', id)}
              describe={(doctor) => doctor.specialties?.map((item) => item.ten).join(', ') || doctor.email || 'Chưa có chuyên khoa'}
            />
            <StaffPicker
              title="Y tá trong phòng"
              icon="user"
              items={options.nurses}
              selectedIds={form.nurse_ids}
              emptyText="Chưa có tài khoản y tá đang hoạt động."
              onToggle={(id) => toggleId('nurse_ids', id)}
              describe={(nurse) => nurse.so_dien_thoai || nurse.email || 'Chưa có số điện thoại'}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Hủy
          </button>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu phòng'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function StaffPicker<T extends ClinicRoomDoctor | ClinicRoomNurse>({
  title,
  icon,
  items,
  selectedIds,
  emptyText,
  onToggle,
  describe,
}: {
  title: string
  icon: string
  items: T[]
  selectedIds: string[]
  emptyText: string
  onToggle: (id: string) => void
  describe: (item: T) => string
}) {
  return (
    <section className="rounded-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name={icon} className="h-4 w-4 text-slate-500" />
          <h4 className="font-semibold text-slate-800">{title}</h4>
        </div>
        <Badge color="blue">{selectedIds.length} đã chọn</Badge>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-400">{emptyText}</p>
        ) : (
          items.map((item) => {
            const checked = selectedIds.includes(item._id)
            return (
              <label
                key={item._id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  checked ? 'bg-brand-50' : 'hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item._id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">{item.ho_ten}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">{describe(item)}</span>
                </span>
              </label>
            )
          })
        )}
      </div>
    </section>
  )
}

function roomToForm(room: ClinicRoomItem | null): ClinicRoomPayload {
  if (!room) return emptyForm
  return {
    ten: room.ten,
    tang: room.tang,
    toa: CLINIC_BUILDING_NAME,
    loai: room.loai,
    trang_thai: room.trang_thai,
    doctor_ids: room.doctor_ids.map((doctor) => doctor._id),
    nurse_ids: room.nurse_ids.map((nurse) => nurse._id),
  }
}
