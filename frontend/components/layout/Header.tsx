"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { useSelectedFarmer } from "@/context/FarmerContext";
import { Sprout, Globe, LogOut, User } from "lucide-react";
import { translateFarmerName, formatGatLabel } from "@/i18n/marathiHelper";

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  const { isAuthenticated, farmer, field, logout } = useAuth();
  const { selectedFarmer } = useSelectedFarmer();
  const pathname = usePathname();

  const navItems = [
    { key: "dashboard", labelKey: "nav.dashboard", href: "/dashboard" },
    { key: "myFarm", labelKey: "nav.myFarm", href: "/my-farm" },
    { key: "soilMap", labelKey: "nav.soilMap", href: "/soil-map" },
    { key: "cropSuitability", labelKey: "nav.cropSuitability", href: "/field-suitability" },
    { key: "soilTexture", labelKey: "nav.soilTexture", href: "/soil-texture" },
    { key: "soilHealthCard", labelKey: "nav.soilHealthCard", href: "/soil-health-card" },
    { key: "marketIntelligence", labelKey: "nav.marketIntelligence", href: "/market-intelligence" },
    { key: "reports", labelKey: "nav.reports", href: "/reports" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-surface-border shadow-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* LEFT: Brand identity */}
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3 group shrink-0">
          <div className="w-10 h-10 rounded-lg bg-soil-primary text-white flex items-center justify-center shadow-sm group-hover:bg-soil-primaryHover transition-colors">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-text-main group-hover:text-soil-primary transition-colors">
                SoilPilot
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-soil-cream text-soil-primary border border-soil-secondary/40 rounded-full">
                {t("brand.portalTag") || "DSM Portal"}
              </span>
            </div>
            <p className="text-xs text-text-muted hidden sm:block font-normal">
              {t("brand.subtitle")}
            </p>
          </div>
        </Link>

        {/* CENTER: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {isAuthenticated ? (
            navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    isActive
                      ? "text-soil-primary bg-soil-primaryLight border border-soil-secondary/40 shadow-xs"
                      : "text-text-muted hover:text-text-main hover:bg-surface-subtle"
                  }`}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })
          ) : (
            <Link
              href="/"
              className={`text-sm font-medium px-3.5 py-1.5 rounded-lg transition-colors ${
                pathname === "/"
                  ? "text-soil-primary font-semibold bg-soil-primaryLight/50"
                  : "text-text-muted hover:text-text-main hover:bg-surface-subtle"
              }`}
            >
              {t("nav.home") || "Home"}
            </Link>
          )}
        </nav>

        {/* RIGHT: Controls (Active Farmer, Language Switcher, Logout) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Active farmer badge if authenticated */}
          {isAuthenticated && (farmer || field || selectedFarmer) && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-subtle border border-surface-border text-xs font-semibold text-text-main shadow-xs">
              <User className="w-3.5 h-3.5 text-soil-primary" />
              <span className="max-w-[130px] truncate">
                {translateFarmerName(selectedFarmer?.name || farmer?.name, language === "mr")}
              </span>
              {(selectedFarmer?.gat_no || field?.gat_no) && (
                <span className="px-2 py-0.5 rounded-md bg-soil-primaryLight text-soil-primary text-[11px] font-bold border border-soil-primary/20">
                  {formatGatLabel(selectedFarmer?.gat_no || field?.gat_no || "", language === "mr")}
                </span>
              )}
            </div>
          )}

          {/* Language Switcher */}
          <div className="inline-flex items-center p-1 rounded-lg bg-surface-muted border border-surface-border">
            <Globe className="w-3.5 h-3.5 text-text-light mx-1 hidden sm:inline" />
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                language === "en"
                  ? "bg-soil-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text-main"
              }`}
              aria-label="Switch to English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("mr")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                language === "mr"
                  ? "bg-soil-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text-main"
              }`}
              aria-label="मराठी मध्ये बदला"
            >
              मराठी
            </button>
          </div>

          {/* Logout Action */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs font-semibold shadow-xs"
              title={t("auth.logout")}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("auth.logout")}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
