import React from 'react';
import { format } from 'date-fns';

export interface QueueTicketData {
  patientName: string;
  doctorName: string;
  roomNumber: string;
  queueNumber: string;
  appointmentTime: string;
  serviceName?: string;
}

interface Props {
  data: QueueTicketData | null;
}

export default function QueueTicketTemplate({ data }: Props) {
  if (!data) return null;

  return (
    <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:z-50 print:p-4 text-black font-sans w-[80mm]">
      <style type="text/css" media="print">
        {`
          @page { size: 80mm 200mm; margin: 0; }
          body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
        `}
      </style>

      <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
        <h1 className="text-xl font-bold uppercase tracking-wider mb-1">VitaFamily</h1>
        <p className="text-xs text-gray-600">Phòng khám Chăm sóc Sức khỏe</p>
      </div>

      <div className="text-center mb-4">
        <p className="text-sm font-semibold uppercase">Phiếu Khám Bệnh</p>
        <p className="text-[10px] text-gray-500 mt-1">
          Ngày in: {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </p>
      </div>

      <div className="text-center bg-gray-100 py-3 rounded mb-4">
        <p className="text-xs text-gray-600 uppercase tracking-wide">Số thứ tự</p>
        <p className="text-4xl font-extrabold mt-1">{data.queueNumber}</p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Bệnh nhân:</span>
          <span className="font-bold text-right max-w-[140px] truncate">{data.patientName}</span>
        </div>
        
        {data.serviceName && (
          <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
            <span className="text-gray-500">Dịch vụ:</span>
            <span className="font-medium text-right max-w-[140px] truncate">{data.serviceName}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
          <span className="text-gray-500">Bác sĩ:</span>
          <span className="font-medium text-right max-w-[140px] truncate">{data.doctorName}</span>
        </div>

        <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
          <span className="text-gray-500">Phòng khám:</span>
          <span className="font-bold text-lg">{data.roomNumber}</span>
        </div>

        <div className="flex justify-between border-t border-dotted border-gray-200 pt-2">
          <span className="text-gray-500">Giờ hẹn:</span>
          <span className="font-medium">{data.appointmentTime}</span>
        </div>
      </div>

      <div className="mt-6 text-center border-t-2 border-dashed border-gray-300 pt-4">
        <p className="text-[11px] italic text-gray-600">
          Vui lòng ngồi chờ tại khu vực Phòng {data.roomNumber}.
        </p>
        <p className="text-[11px] italic text-gray-600 mt-1">
          Xin cảm ơn quý khách!
        </p>
      </div>
    </div>
  );
}
