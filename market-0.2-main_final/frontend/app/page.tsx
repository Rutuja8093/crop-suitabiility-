"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { FarmerAccessForm } from "@/components/auth/FarmerAccessForm";

export default function FarmerAccessPage() {
  const { t, language } = useI18n();
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center py-8 sm:py-12 lg:py-16 px-4 sm:px-6 bg-[#F5F7F3]">
      <div className="w-full max-w-4xl mx-auto space-y-6 sm:space-y-8 flex flex-col items-center">
        {/* Centered Hero Section Matching Reference */}
        <div className="text-center space-y-3 max-w-3xl mx-auto px-2">
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#1B5E20] tracking-tight leading-[1.18]">
            {language === "mr" ? (
              <>
                डिजिटल मृदा नकाशा व मृदा आरोग्य<br className="hidden sm:inline" /> पोर्टल
              </>
            ) : (
              <>
                Digital Soil Mapping & Soil Health<br className="hidden sm:inline" /> Portal
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm lg:text-[15px] text-[#556E5D] font-normal max-w-2xl mx-auto leading-relaxed">
            {language === "mr"
              ? "आपल्या शेतासाठी अचूक डिजिटल मृदा नकाशे व सविस्तर आरोग्य नोंदी."
              : "Access digital soil maps and detailed soil health records tailored to your specific field."}
          </p>
        </div>

        {/* Centered Farmer Access Card */}
        <div className="w-full flex items-center justify-center">
          <FarmerAccessForm />
        </div>
      </div>
    </div>
  );
}
