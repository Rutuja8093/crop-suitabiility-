"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export const AppShell: React.FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  if (isLandingPage) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-[#F5F7F3]">
        <main className="flex-1 w-full overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen bg-[#F5F7F3]">
      {/* Dark Forest-Green Left Sidebar */}
      <Sidebar />

      {/* Right Column: Top Bar + Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
