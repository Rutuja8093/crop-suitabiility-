"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RecommendationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-text-muted">
      Redirecting to Dashboard...
    </div>
  );
}
