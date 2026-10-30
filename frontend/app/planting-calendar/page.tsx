"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlantingCalendarRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/market-intelligence");
  }, [router]);

  return (
    <div className="max-w-7xl mx-auto py-16 text-center text-sm font-semibold text-text-muted animate-pulse">
      Loading Planting Calendar & Crop Planning...
    </div>
  );
}
