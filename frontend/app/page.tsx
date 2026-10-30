"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { FarmerAccessForm } from "@/components/auth/FarmerAccessForm";

export default function FarmerAccessPage() {
  const { t } = useI18n();
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="w-full py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
      {/* Centered Hero Section */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-soil-primary tracking-tight leading-tight sm:leading-tight">
          {t("hero.heading") || "Digital Soil Mapping & Soil Health Portal"}
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-text-muted font-normal max-w-2xl mx-auto leading-relaxed">
          {t("hero.subheading") ||
            "Access digital soil maps and detailed soil health records tailored to your specific field."}
        </p>
      </div>

      {/* Centered Farmer Access Card */}
      <div className="flex items-center justify-center">
        <FarmerAccessForm />
      </div>
    </div>
  );
}
