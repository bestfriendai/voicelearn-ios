import { Suspense } from 'react';
import { Dashboard } from '@/components/dashboard';

// Loading skeleton for initial page load
function DashboardSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-16 bg-slate-900/80 border-b border-slate-700/30" />
        {/* Nav skeleton */}
        <div className="h-12 bg-slate-900/80 border-b border-slate-700/30" />
        <div className="h-12 bg-slate-800/50 border-b border-slate-700/50" />
        {/* Content skeleton */}
        <div className="p-6 space-y-4">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-slate-800 rounded" />
            <div className="h-24 bg-slate-800 rounded" />
            <div className="h-24 bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
