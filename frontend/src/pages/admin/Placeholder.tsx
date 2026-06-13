import PageHeader from '@/components/common/PageHeader'

interface Props {
  title: string
}

export default function Placeholder({ title }: Props) {
  return (
    <div>
      <PageHeader title={title} description="Chức năng đang được xây dựng." />
      <div className="card grid place-items-center p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
          </svg>
        </div>
        <p className="mt-4 font-semibold text-slate-700">Trang đang được phát triển</p>
        <p className="mt-1.5 max-w-md text-sm text-slate-500">
          Tạo component cho trang này theo đúng cấu trúc mẫu của{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-xs">ManageUsers.tsx</code>
          {' '}(bộ lọc + bảng dữ liệu + service riêng).
        </p>
      </div>
    </div>
  )
}
