export default function BookingSkeleton() {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
        <div className="h-4 w-1/3 bg-slate-200 rounded"></div>
        <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
      </div>
      <div className="flex gap-4 mb-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 w-24 bg-slate-200 rounded-xl"></div>
        ))}
      </div>
      <div className="h-4 w-1/4 bg-slate-200 rounded mb-4 mt-8"></div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-12 bg-slate-200 rounded-xl"></div>
        ))}
      </div>
    </div>
  )
}
