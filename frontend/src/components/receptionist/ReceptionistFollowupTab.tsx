import { useState, useEffect } from 'react';
import { followupService, type ReceptionistFollowUpRecord } from '@/services/followup.service';

export default function ReceptionistFollowupTab() {
  const [followups, setFollowups] = useState<ReceptionistFollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFollowups();
  }, []);

  const loadFollowups = async () => {
    try {
      setLoading(true);
      const data = await followupService.getPendingFollowUps();
      setFollowups(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải danh sách tái khám');
    } finally {
      setLoading(false);
    }
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    alert('Đã sao chép SĐT: ' + phone);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Tái khám</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Danh sách bệnh nhân cần tái khám nhưng chưa đặt lịch hẹn. Lễ tân có thể gọi điện để nhắc nhở và lên lịch.
          </p>
        </div>
        <button type="button" onClick={loadFollowups} disabled={loading} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">{error}</p>}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">Bệnh nhân / SĐT</th>
                <th className="px-4 py-3">Ngày khám cũ</th>
                <th className="px-4 py-3">Bác sĩ khám</th>
                <th className="px-4 py-3">Ngày tái khám dự kiến</th>
                <th className="px-4 py-3">Chẩn đoán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
              ) : followups.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Không có danh sách tái khám nào cần xử lý.</td></tr>
              ) : followups.map((item) => (
                <tr key={item.lich_hen_goc_id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{item.ten_khach}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.so_dien_thoai}</span>
                      <button 
                        onClick={() => copyPhone(item.so_dien_thoai)} 
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200"
                        title="Copy số điện thoại"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(item.ngay_kham_cu).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {item.bac_si}
                  </td>
                  <td className="px-4 py-3">
                    {item.ngay_tai_kham ? (
                      <span className="font-bold text-orange-600">
                        {new Date(item.ngay_tai_kham).toLocaleDateString('vi-VN')}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Không ấn định ngày</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {item.chan_doan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
