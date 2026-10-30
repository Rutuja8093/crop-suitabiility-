"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Tractor,
  FileBadge,
  Map,
  Layers,
  Lightbulb,
  FileText,
  LogOut,
  MapPin,
  TrendingUp,
  Sprout,
} from "lucide-react";
import { translateGeoName, formatGatLabel } from "@/i18n/marathiHelper";

interface NavItem {
  key: string;
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { key: "dashboard", labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "myFarm", labelKey: "nav.myFarm", href: "/my-farm", icon: Tractor },
  { key: "soilHealthCard", labelKey: "nav.soilHealthCard", href: "/soil-health-card", icon: FileBadge },
  { key: "soilMap", labelKey: "nav.soilMap", href: "/soil-map", icon: Map },
  { key: "cropSuitability", labelKey: "nav.cropSuitability", href: "/field-suitability", icon: Sprout },
  { key: "soilTexture", labelKey: "nav.soilTexture", href: "/soil-texture", icon: Layers },
  { key: "recommendations", labelKey: "nav.recommendations", href: "/recommendations", icon: Lightbulb },
  { key: "marketIntelligence", labelKey: "nav.marketIntelligence", href: "/market-intelligence", icon: TrendingUp },
  { key: "reports", labelKey: "nav.reports", href: "/reports", icon: FileText },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { t, language } = useI18n();
  const { isAuthenticated, field, location, logout } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-surface-border min-h-[calc(100vh-4rem)] p-4 shrink-0">
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-soil-primary text-white shadow-sm font-semibold"
                  : "text-text-muted hover:bg-surface-muted hover:text-text-main"
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-soil-primary"}`} />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      {/* Active Farm Context or Platform Status */}
      <div className="mt-auto space-y-3 pt-6 border-t border-surface-border">
        {isAuthenticated && field ? (
          <div className="p-3 bg-soil-primaryLight/40 rounded-xl border border-soil-secondary/30 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-soil-primary">
              <MapPin className="w-3.5 h-3.5" />
              <span>{formatGatLabel(field.gat_no, language === "mr")}</span>
            </div>
            <p className="text-[11px] text-text-muted truncate">
              {translateGeoName(location?.village, language === "mr")}, {translateGeoName(location?.taluka, language === "mr")}
            </p>
          </div>
        ) : null}

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t("auth.logout")}</span>
          </button>
        )}

        <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border text-xs text-text-muted">
          <p className="font-semibold text-text-main">SoilPilot</p>
          <p className="mt-0.5 text-[11px] text-text-light">
            {language === "mr" ? "डिजिटल शेत नकाशा सक्रिय" : "Phase 5: Farm Map Active"}
          </p>

        </div>
      </div>
    </aside>
  );
};
