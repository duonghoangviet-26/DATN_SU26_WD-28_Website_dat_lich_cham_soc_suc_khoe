import { format } from 'date-fns';

export interface QueueTicketData {
  ticketType: 'kham' | 'cho_dieu_phoi';
  patientName: string;
  queueNumber: string;
  doctorName?: string | null;
  roomNumber?: string | null;
  appointmentTime?: string | null;
  serviceName?: string | null;
  specialtyName?: string | null;
  note?: string | null;
}

interface Props {
  data: QueueTicketData | null;
}

export default function QueueTicketTemplate({ data }: Props) {
  if (!data) return null;
  const isWaiting = data.ticketType === 'cho_dieu_phoi';

  return (
    <div id="queue-ticket-print" className="hidden print:block w-[80mm] bg-white p-4 text-black font-sans">
      <style type="text/css" media="print">
        {`
          @page { size: 80mm 200mm; margin: 0; }
          body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
        `}
      </style>

      <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
        <h1 className="text-xl font-bold uppercase tracking-wider mb-1">ViteFamily</h1>
        <p className="text-xs text-gray-600">Phòng khám Chăm sóc Sức khỏe</p>
      </div>

      <div className="text-center mb-4">
        <p className="text-sm font-semibold uppercase">
          {isWaiting ? 'Phiếu Chờ Điều Phối' : 'Phiếu Vào Phòng Khám'}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">
          Ngày in: {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </p>
      </div>

      <div className="text-center bg-gray-100 py-3 rounded mb-4">
        <p className="text-xs text-gray-600 uppercase tracking-wide">{isWaiting ? 'Mã chờ' : 'Số thứ tự'}</p>
        <p className="text-4xl font-extrabold mt-1">{data.queueNumber}</p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Bệnh nhân:</span>
          <span className="font-bold text-right max-w-[140px] truncate">{data.patientName}</span>
        </div>

        {(data.specialtyName || data.serviceName) && (
          <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
            <span className="text-gray-500">{isWaiting ? 'Chuyên khoa:' : 'Dịch vụ:'}</span>
            <span className="font-medium text-right max-w-[140px] truncate">
              {data.specialtyName || data.serviceName}
            </span>
          </div>
        )}

        {!isWaiting && (
          <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
            <span className="text-gray-500">Bác sĩ:</span>
            <span className="font-medium text-right max-w-[140px] truncate">{data.doctorName || 'Chưa gán'}</span>
          </div>
        )}

        {!isWaiting && (
          <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
            <span className="text-gray-500">Phòng khám:</span>
            <span className="font-bold text-lg">{data.roomNumber || 'Chưa gán'}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
          <span className="text-gray-500">{isWaiting ? 'Giờ tiếp nhận:' : 'Giờ hẹn:'}</span>
          <span className="font-medium">{data.appointmentTime || '-'}</span>
        </div>

        {isWaiting && (
          <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
            <span className="text-gray-500">Trạng thái:</span>
            <span className="font-bold">Chờ điều phối</span>
          </div>
        )}
      </div>

      <div className="mt-6 text-center border-t-2 border-dashed border-gray-300 pt-4">
        <p className="text-[11px] italic text-gray-600">
          {data.note
            ? data.note
            : isWaiting
              ? 'Vui lòng chờ lễ tân điều phối bác sĩ phù hợp.'
              : `Vui lòng ngồi chờ tại khu vực Phòng ${data.roomNumber || ''}.`}
        </p>
        <p className="text-[11px] italic text-gray-600 mt-1">
          Xin cảm ơn quý khách!
        </p>
      </div>
    </div>
  );
}
