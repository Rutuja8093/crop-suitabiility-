"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  iconBgClass?: string;
  badge?: string;
  ctaText: string;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  href,
  icon,
  iconBgClass = "bg-soil-primaryLight text-soil-primary",
  badge,
  ctaText,
}) => {
  return (
    <Link
      href={href}
      className="group bg-white p-5 rounded-xl border border-surface-border hover:border-soil-secondary transition-all shadow-subtle hover:shadow-card flex flex-col justify-between"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${iconBgClass}`}
          >
            {icon}
          </div>
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-muted text-text-muted border border-surface-border">
              {badge}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <h4 className="font-bold text-text-main group-hover:text-soil-primary transition-colors text-sm sm:text-base">
            {title}
          </h4>
          <p className="text-xs text-text-muted leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-xs font-semibold text-soil-primary">
        <span>{ctaText}</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};
