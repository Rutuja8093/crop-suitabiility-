"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import {
  Home,
  Map,
  Sprout,
  Compass,
  Lightbulb,
  FileText,
  TrendingUp,
  Layers,
  Tractor,
  Globe,
  LogOut,
  X,
  ChevronDown,
} from "lucide-react";

interface NavItem {
  key: string;
  label: string;
  labelMr: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", labelMr: "डॅशबोर्ड", href: "/dashboard", icon: Home },
  { key: "myFarm", label: "My Farm", labelMr: "माझे शेत", href: "/my-farm", icon: Tractor },
  { key: "cropSuitability", label: "Crop Suitability", labelMr: "पीक उपयुक्तता", href: "/field-suitability", icon: Compass },
  { key: "soilMap", label: "My Soil Map", labelMr: "माती नकाशा", href: "/soil-map", icon: Map },
  { key: "soilHealthCard", label: "Soil Health Card", labelMr: "मृदा चाचणी अहवाल", href: "/soil-health-card", icon: Sprout },
  { key: "soilTexture", label: "Soil Texture", labelMr: "मृदा पोत वर्गीकरण त्रिकोण", href: "/soil-texture", icon: Layers },
  { key: "marketIntelligence", label: "Market & Crop Planner", labelMr: "बाजार व पीक नियोजन", href: "/market-intelligence", icon: TrendingUp },
  { key: "reports", label: "Report", labelMr: "अहवाल", href: "/reports", icon: FileText },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { language, setLanguage } = useI18n();
  const { isAuthenticated, logout } = useAuth();
  const { isOpen, closeSidebar } = useSidebar();
  const isMr = language === "mr";

  const renderContent = () => (
    <div className="flex flex-col h-full bg-[#0B4D2B] text-white">
      {/* Top Branding Section */}
      <div className="p-5 pb-4 border-b border-white/10 flex items-start justify-between">
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-xs group-hover:bg-white/25 transition-colors">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white">SoilPilot</span>
            </div>
            <p className="text-[10.5px] text-[#A5D6A7] font-normal leading-tight mt-0.5">
              {isMr ? "डिजिटल माती नकाशा व आरोग्य पोर्टल" : "Digital Soil Mapping & Soil Health Portal"}
            </p>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={closeSidebar}
          className="md:hidden p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={closeSidebar}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm transition-all font-medium ${
                isActive
                  ? "bg-[#176B38] text-white font-semibold shadow-xs border border-white/10"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-white/80"}`} />
              <span className="truncate">{isMr ? item.labelMr : item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Area: Language, Logout, and Brand Footer */}
      <div className="p-4 border-t border-white/10 space-y-3 bg-[#083A20]">
        {/* Language selector */}
        <div className="flex items-center justify-between px-2 py-1.5 text-xs text-white/90">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#A5D6A7]" />
            <span className="font-medium">{isMr ? "भाषा" : "Language"}</span>
          </div>

          <div className="inline-flex items-center bg-white/10 rounded-lg p-0.5 border border-white/15">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                language === "en" ? "bg-white text-[#0B4D2B] shadow-xs font-bold" : "text-white/70 hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("mr")}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                language === "mr" ? "bg-white text-[#0B4D2B] shadow-xs font-bold" : "text-white/70 hover:text-white"
              }`}
            >
              मराठी
            </button>
          </div>
        </div>

        {/* Logout action */}
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => {
              closeSidebar();
              logout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4 text-white/70" />
            <span>{isMr ? "बाहेर पडा" : "Logout"}</span>
          </button>
        )}

        {/* Footer Brand Mark */}
        <div className="pt-2 border-t border-white/10 flex items-center gap-2.5 px-1">
          <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center shrink-0">
            <Sprout className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white tracking-wide">SoilPilot</p>
            <p className="text-[10px] text-[#A5D6A7] leading-none mt-0.5">
              {isMr ? "सुदृढ माती • समृद्ध शेती" : "Healthy Soil • Better Tomorrow"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Persistent left column) */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 z-30 shadow-md">
        {renderContent()}
      </aside>

      {/* Mobile Sidebar Drawer with Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={closeSidebar}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
};
