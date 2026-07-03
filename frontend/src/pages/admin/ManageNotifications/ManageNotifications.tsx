import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import SendNotificationTab from './SendNotificationTab'
import ReceiveNotificationTab from './ReceiveNotificationTab'

type TabType = 'send' | 'receive'

export default function ManageNotifications() {
  const [activeTab, setActiveTab] = useState<TabType>('receive')

  return (
    <div>
      <PageHeader
        title="Quản lý thông báo"
        description="Gửi thông báo đến người dùng và xem các thông báo được gửi đến."
      />

      {/* Điều hướng Tabs */}
      <div className="flex space-x-1 border-b border-slate-200 mt-4">
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'receive'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Icon name="inbox" className="w-4 h-4" />
          Hộp thư đến
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'send'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Icon name="send" className="w-4 h-4" />
          Lịch sử & Gửi đi
        </button>
      </div>

      {/* Nội dung Tab */}
      <div className="mt-4">
        {activeTab === 'receive' && <ReceiveNotificationTab />}
        {activeTab === 'send' && <SendNotificationTab />}
      </div>
    </div>
  )
}
