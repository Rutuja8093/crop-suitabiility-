"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MobileNavigation } from "@/components/layout/MobileNavigation";

export const AppShell: React.FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  if (isLandingPage) {
    return (
      <main className="flex-1 w-full overflow-y-auto">
        {children}
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 overflow-y-auto">
        {children}
      </main>
      <MobileNavigation />
    </>
  );
};
