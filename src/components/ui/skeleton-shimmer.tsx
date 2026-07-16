export function SkeletonShimmer({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

export function StatSkeleton() {
  return (
    <div className="glass rounded-xl p-5">
      <div className="shimmer mb-3 h-3 w-20 rounded" />
      <div className="shimmer h-8 w-28 rounded" />
    </div>
  )
}
