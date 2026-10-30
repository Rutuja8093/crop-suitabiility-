"use client";

import React from "react";

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      {/* Welcome Skeleton */}
      <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-surface-muted" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-surface-muted rounded" />
              <div className="h-4 w-72 bg-surface-muted rounded" />
            </div>
          </div>
          <div className="h-6 w-32 bg-surface-muted rounded-full" />
        </div>
        <div className="h-4 w-96 bg-surface-muted rounded" />
      </div>

      {/* Farm & Map Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4 h-64">
          <div className="h-5 w-32 bg-surface-muted rounded" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-16 bg-surface-subtle rounded-xl" />
            <div className="h-16 bg-surface-subtle rounded-xl" />
            <div className="h-16 bg-surface-subtle rounded-xl" />
            <div className="h-16 bg-surface-subtle rounded-xl" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4 h-64">
          <div className="h-5 w-36 bg-surface-muted rounded" />
          <div className="h-40 bg-surface-subtle rounded-xl" />
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-44 bg-surface-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-surface-border shadow-subtle h-36 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-surface-muted" />
                <div className="h-4 w-28 bg-surface-muted rounded" />
                <div className="h-3 w-40 bg-surface-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
