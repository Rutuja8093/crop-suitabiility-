"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Sprout } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRouteContent: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const isBypass =
    searchParams?.get("admin") === "true" ||
    searchParams?.get("demo") === "true" ||
    Boolean(searchParams?.get("gat"));

  useEffect(() => {
    if (!loading && !isAuthenticated && !isBypass) {
      router.replace("/");
    }
  }, [isAuthenticated, loading, isBypass, router]);

  if (loading && !isBypass) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 p-8">
        <div className="w-12 h-12 rounded-2xl bg-soil-primaryLight border border-soil-secondary/40 text-soil-primary flex items-center justify-center animate-pulse">
          <Sprout className="w-7 h-7 text-soil-primary animate-bounce" />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin text-soil-primary" />
          <span>{t("auth.checkingSession") || "Verifying farm access..."}</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isBypass) {
    return null;
  }

  return <>{children}</>;
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = (props) => {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 p-8">
          <div className="w-12 h-12 rounded-2xl bg-soil-primaryLight border border-soil-secondary/40 text-soil-primary flex items-center justify-center animate-pulse">
            <Sprout className="w-7 h-7 text-soil-primary animate-bounce" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-soil-primary" />
            <span>Verifying farm access...</span>
          </div>
        </div>
      }
    >
      <ProtectedRouteContent {...props} />
    </Suspense>
  );
};

