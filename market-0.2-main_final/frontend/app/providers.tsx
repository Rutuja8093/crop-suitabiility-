"use client";

import React, { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/context";
import { AuthProvider } from "@/context/AuthContext";
import { FarmerProvider } from "@/context/FarmerContext";
import { SidebarProvider } from "@/context/SidebarContext";

export const Providers: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <FarmerProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </FarmerProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
};

