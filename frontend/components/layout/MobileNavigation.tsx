"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import {
  LayoutDashboard,
  Tractor,
  FileBadge,
  Map,
  Lightbulb,
  FileText,
} from "lucide-react";

export const MobileNavigation: React.FC = () => {
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems = [
    { key: "dashboard", labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
    { key: "myFarm", labelKey: "nav.myFarm", href: "/my-farm", icon: Tractor },
    { key: "soilHealthCard", labelKey: "nav.soilHealthCard", href: "/soil-health-card", icon: FileBadge },
    { key: "soilMap", labelKey: "nav.soilMap", href: "/soil-map", icon: Map },
    { key: "reports", labelKey: "nav.reports", href: "/reports", icon: FileText },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-border shadow-lg">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                isActive
                  ? "text-soil-primary font-bold bg-soil-primaryLight/40"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-soil-primary" : "text-text-light"}`} />
              <span className="text-[10px] truncate max-w-[54px] mt-1">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
