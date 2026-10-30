"use client";

import React, { useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { useSelectedFarmer } from "@/context/FarmerContext";
import { useSidebar } from "@/context/SidebarContext";
import {
  Menu,
  Search,
  Globe,
  Bell,
  User,
  ChevronDown,
  LogOut,
  MapPin,
  Check,
} from "lucide-react";
import { translateFarmerName, formatGatLabel } from "@/i18n/marathiHelper";

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  const { isAuthenticated, farmer, field, logout } = useAuth();
  const { selectedFarmer } = useSelectedFarmer();
  const { toggleSidebar } = useSidebar();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isMr = language === "mr";

  // Active farmer identity
  const currentGat =
    field?.gat_no ||
    (mounted && typeof window !== "undefined" ? localStorage.getItem("soilpilot_selected_gat") : null) ||
    "22";

  const rawFarmerName =
    (selectedFarmer && String(selectedFarmer.gat_no) === String(currentGat)
      ? selectedFarmer.name
      : null) ||
    farmer?.name ||
    "Pradip Bhauso Shelar";

  const displayName = translateFarmerName(rawFarmerName, isMr);

  return (
    <header className="sticky top-0 z-20 w-full bg-white border-b border-[#E6E9E5] h-16 shrink-0 flex items-center px-4 sm:px-6 lg:px-8">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Left Side: Hamburger & Search Bar */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-lg">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle navigation menu"
            className="p-2 -ml-1 text-gray-600 hover:text-[#0B4D2B] hover:bg-[#F5F7F3] rounded-lg transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search Bar matching screenshot */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#4A6B67] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMr ? "अहवाल, गट अथवा शेतकरी शोधा..." : "Search reports, gates, or farmers..."}
              className="w-full bg-[#FFFFFF] hover:bg-[#F5F7F3]/50 focus:bg-white text-xs text-[#1A2E22] placeholder:text-[#4A6B67] pl-9 pr-4 py-2 rounded-full border border-[#E6E9E5] focus:border-[#176B38] focus:outline-none transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* Right Side: Language Pill, Notification Bell, Farmer Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E6E9E5] bg-white hover:bg-[#F5F7F3] text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
              aria-label="Language selector"
            >
              <Globe className="w-4 h-4 text-[#176B38]" />
              <span className="font-semibold text-xs text-gray-800">
                {language === "mr" ? "मराठी" : "English"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {langDropdownOpen && (
              <div
                className="absolute right-0 mt-1.5 w-32 bg-white rounded-xl border border-[#E6E9E5] shadow-lg py-1 z-50 animate-in fade-in duration-100"
                onClick={() => setLangDropdownOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                    language === "en" ? "bg-[#EAF5EC] text-[#0B4D2B]" : "text-gray-700 hover:bg-[#F5F7F3]"
                  }`}
                >
                  <span>English</span>
                  {language === "en" && <Check className="w-3.5 h-3.5 text-[#176B38]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("mr")}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                    language === "mr" ? "bg-[#EAF5EC] text-[#0B4D2B]" : "text-gray-700 hover:bg-[#F5F7F3]"
                  }`}
                >
                  <span>मराठी</span>
                  {language === "mr" && <Check className="w-3.5 h-3.5 text-[#176B38]" />}
                </button>
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative p-2 text-gray-600 hover:text-[#0B4D2B] hover:bg-[#F5F7F3] rounded-full transition-colors cursor-pointer"
            title={isMr ? "सूचना" : "Notifications"}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#176B38] ring-2 ring-white" />
          </button>

          {/* Farmer Profile Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-full hover:bg-[#F5F7F3] transition-colors cursor-pointer"
              aria-label="User profile menu"
            >
              <div className="w-8 h-8 rounded-full bg-[#0B4D2B] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-bold text-[#0B4D2B] truncate max-w-[140px]">
                  {displayName}
                </p>
                <p className="text-[10.5px] text-[#4A6B67] font-medium">
                  {isMr ? "शेतकरी" : "Farmer"}
                  {currentGat ? ` • ${formatGatLabel(currentGat, isMr)}` : ""}
                </p>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[#E6E9E5] shadow-lg py-2 z-50 animate-in fade-in duration-100"
                onClick={() => setProfileDropdownOpen(false)}
              >
                <div className="px-4 py-2 border-b border-[#E6E9E5]">
                  <p className="text-xs font-bold text-[#0B4D2B]">{displayName}</p>
                  <p className="text-[11px] text-[#4A6B67] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#176B38]" />
                    <span>{formatGatLabel(currentGat, isMr)}</span>
                  </p>
                </div>

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t("auth.logout") || (isMr ? "बाहेर पडा" : "Logout")}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
