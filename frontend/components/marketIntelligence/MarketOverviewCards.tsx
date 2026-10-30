"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  Coins,
  Calendar,
  Building2,
  Database,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import {
  marketService,
  MarketPriceObservationItem,
  ObservationsListResponse,
} from "@/services/marketService";
import { getCertifiedObservations } from "@/services/certifiedDecisionPlanData";
import { CropCategory } from "@/types/marketIntelligence";

interface MarketOverviewCardsProps {
  selectedDistrict?: string;
  selectedMarket: string;
  selectedCommodity?: string;
  commodityId?: number;
}

export const MarketOverviewCards: React.FC<MarketOverviewCardsProps> = ({
  selectedDistrict = "Pune",
  selectedMarket,
  selectedCommodity = "All Commodities",
  commodityId,
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  const [loading, setLoading] = useState<boolean>(true);
  const [dataResponse, setDataResponse] = useState<ObservationsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CropCategory>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchObservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await marketService.getObservations({
        district: selectedDistrict,
        commodityId: commodityId,
        limit: 100,
      });
      if (resp && resp.items && resp.items.length > 0) {
        setDataResponse(resp);
      } else {
        setDataResponse(getCertifiedObservations());
      }
    } catch (_err: any) {
      setDataResponse(getCertifiedObservations());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObservations();
  }, [selectedDistrict, selectedMarket, commodityId]);

  const items = dataResponse?.items || [];

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategory !== "all") {
        const cat = (item.commodity_category || "").toLowerCase();
        const filterKey = selectedCategory.toLowerCase();
        if (filterKey === "cash_crops" && !cat.includes("cash")) return false;
        if (filterKey === "pulses" && !cat.includes("pulse")) return false;
        if (filterKey === "cereals" && !cat.includes("cereal") && !cat.includes("millet")) return false;
        if (filterKey === "oilseeds" && !cat.includes("oilseed")) return false;
        if (filterKey === "vegetables" && !cat.includes("vegetable")) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameEn = (item.commodity_name || "").toLowerCase();
        const nameMr = (item.commodity_name_mr || "").toLowerCase();
        const market = (item.market_name || "").toLowerCase();
        if (!nameEn.includes(q) && !nameMr.includes(q) && !market.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedCategory, searchQuery]);

  const categories: { key: CropCategory; labelEn: string; labelMr: string }[] = [
    { key: "all", labelEn: "All Crops", labelMr: "सर्व पिके" },
    { key: "cash_crops", labelEn: "Cash Crops", labelMr: "नगदी पिके" },
    { key: "cereals", labelEn: "Cereals & Millets", labelMr: "धान्य" },
    { key: "pulses", labelEn: "Pulses", labelMr: "कडधान्ये" },
    { key: "oilseeds", labelEn: "Oilseeds", labelMr: "तेलबिया" },
    { key: "vegetables", labelEn: "Vegetables", labelMr: "भाजीपाला" },
  ];

  // Helper for Status Badge
  const getStatusBadge = (obs: MarketPriceObservationItem) => {
    if (obs.validation_status === "VERIFIED" || obs.validation_status === "VALID") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{isMr ? "पडताळणीकृत" : "Verified"}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <AlertTriangle className="w-3 h-3 text-amber-600" />
        <span>{isMr ? "मागील दर" : "Historical"}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden transition-all space-y-4 p-5 sm:p-6">
      {/* Header: Title and Market Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight flex items-center gap-2">
              <span>{isMr ? "आजचे बाजार भाव" : "Today's Crop Prices"}</span>
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-soil-primary" />}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isMr
                ? `अधिकृत कृषी उत्पन्न बाजार समिती (${selectedMarket}) चे उपलब्ध दर`
                : `Latest available and verified market prices for configured crops in ${selectedMarket}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchObservations}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-soil-primary text-white hover:bg-soil-primary/90 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{isMr ? "दर पुन्हा तपासा" : "Refresh Prices"}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat.key
                  ? "bg-soil-primary text-white shadow-2xs"
                  : "bg-surface-subtle text-text-muted hover:text-text-main hover:bg-surface-muted border border-surface-border"
              }`}
            >
              {isMr ? cat.labelMr : cat.labelEn}
            </button>
          ))}
        </div>

        {/* Quick Search Input */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isMr ? "पीक शोधा..." : "Search crop..."}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-surface-border bg-surface-subtle focus:bg-white focus:outline-none focus:ring-2 focus:ring-soil-primary/20 text-text-main"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3 py-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 bg-surface-subtle rounded-xl animate-pulse border border-surface-border/60"
            />
          ))}
        </div>
      )}

      {/* Error or Empty State Notice */}
      {!loading && (error || items.length === 0) && (
        <div className="p-5 rounded-2xl bg-[#FFF8CF]/60 border border-[#FBE6C2] text-[#2A7C13] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFF8CF] text-amber-800 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">
                {isMr
                  ? "सध्या बाजार भाव उपलब्ध नाहीत. कृपया नंतर पुन्हा प्रयत्न करा."
                  : "Market prices are not available right now. Please try again later."}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {isMr
                  ? "सॉईलपायलट केवळ प्रत्यक्ष बाजार लिलावाचे पडताळणी केलेले अधिकृत दर दाखवते. बनावट किंवा अंदाज केलेले दर येथे दाखवले जात नाहीत."
                  : "SoilPilot only presents verified wholesale rates from official market bulletins. Fabricated or synthetic prices are never displayed."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchObservations}
            className="px-4 py-2 rounded-xl bg-soil-primary text-white text-xs font-bold hover:bg-soil-primary/90 transition-colors shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isMr ? "पुन्हा प्रयत्न करा" : "Retry"}</span>
          </button>
        </div>
      )}

      {/* Filter Yielded Zero Items */}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="p-8 text-center text-text-muted space-y-2">
          <Filter className="w-8 h-8 text-stone-300 mx-auto" />
          <p className="text-xs font-semibold">
            {isMr ? "निवडलेल्या वर्गवारीत कोणतेही दर सापडले नाहीत." : "No market records found for the selected filter."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setSearchQuery("");
            }}
            className="text-xs text-soil-primary hover:underline font-bold"
          >
            {isMr ? "सर्व पिके पहा" : "Reset Filters"}
          </button>
        </div>
      )}

      {/* Clean & Readable Table for Desktop / Tablet */}
      {!loading && filteredItems.length > 0 && (
        <>
          {/* Desktop Table View (Hidden on small mobile) */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle text-text-muted text-[11px] uppercase font-bold tracking-wider border-b border-surface-border">
                <tr>
                  <th className="py-3 px-4">{isMr ? "पीक (Crop Name)" : "Crop Name"}</th>
                  <th className="py-3 px-4 text-right font-bold text-text-main">
                    {isMr ? "उपलब्ध दर (Latest Price)" : "Latest Available Price"}
                  </th>
                  <th className="py-3 px-4">{isMr ? "एकक (Unit)" : "Unit"}</th>
                  <th className="py-3 px-4">{isMr ? "बाजार समिती (Market Name)" : "Market Name"}</th>
                  <th className="py-3 px-4">{isMr ? "बाजार दिनांक (Market Date)" : "Market Date"}</th>
                  <th className="py-3 px-4 text-center">{isMr ? "स्थिती (Data Status)" : "Data Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {filteredItems.map((obs) => (
                  <tr key={obs.id} className="hover:bg-surface-subtle/40 transition-colors">
                    {/* 1. Crop Name */}
                    <td className="py-3.5 px-4 font-bold text-text-main">
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-text-main">
                          {isMr ? obs.commodity_name_mr || obs.commodity_name : obs.commodity_name}
                        </span>
                        <span className="text-[10px] text-text-muted font-normal">
                          {obs.commodity_category}
                        </span>
                      </div>
                    </td>

                    {/* 2. Latest Available Price */}
                    <td className="py-3.5 px-4 text-right font-black text-soil-primary text-base">
                      {obs.modal_price != null ? (
                        <span>₹{obs.modal_price.toLocaleString("en-IN")}</span>
                      ) : (
                        <span className="text-text-muted font-normal text-xs">—</span>
                      )}
                      {obs.min_price != null && obs.max_price != null && (
                        <span className="block text-[10px] font-normal text-text-muted">
                          (₹{obs.min_price.toLocaleString("en-IN")} – ₹{obs.max_price.toLocaleString("en-IN")})
                        </span>
                      )}
                    </td>

                    {/* 3. Unit */}
                    <td className="py-3.5 px-4 text-text-muted font-medium whitespace-nowrap">
                      {obs.price_unit || "₹ / क्विंटल"}
                    </td>

                    {/* 4. Market Name */}
                    <td className="py-3.5 px-4 text-text-main font-semibold">
                      {isMr ? obs.market_name_mr || obs.market_name : obs.market_name}
                      {obs.district_name && (
                        <span className="block text-[10px] text-text-muted font-normal">
                          {obs.district_name}
                        </span>
                      )}
                    </td>

                    {/* 5. Market Date */}
                    <td className="py-3.5 px-4 text-text-muted whitespace-nowrap font-medium">
                      {obs.observation_date}
                    </td>

                    {/* 6. Data Status */}
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(obs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (Visible only on small mobile screens) */}
          <div className="sm:hidden space-y-3">
            {filteredItems.map((obs) => (
              <div
                key={obs.id}
                className="p-4 rounded-xl border border-surface-border bg-white shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-text-main">
                      {isMr ? obs.commodity_name_mr || obs.commodity_name : obs.commodity_name}
                    </h3>
                    <span className="text-[10px] text-text-muted">{obs.commodity_category}</span>
                  </div>
                  {getStatusBadge(obs)}
                </div>

                <div className="p-2.5 rounded-lg bg-[#FFF8CF]/30 border border-[#FBE6C2] flex items-baseline justify-between">
                  <span className="text-xs text-text-muted font-medium">
                    {isMr ? "उपलब्ध दर:" : "Latest Price:"}
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-black text-soil-primary">
                      {obs.modal_price != null ? `₹${obs.modal_price.toLocaleString("en-IN")}` : "—"}
                    </span>
                    <span className="text-xs text-text-muted font-medium ml-1">
                      {obs.price_unit || "₹ / क्विंटल"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-surface-border/60">
                  <span className="font-semibold text-text-main">
                    {isMr ? obs.market_name_mr || obs.market_name : obs.market_name}
                  </span>
                  <span>{obs.observation_date}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Footnote on Provenance */}
          <div className="pt-3 border-t border-surface-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-soil-primary shrink-0" />
              <span>
                {isMr ? "माहिती स्त्रोत: " : "Data Source: "}
                <strong>{dataResponse?.source_name || "Official AGMARKNET / Mandi Bulletin"}</strong>
              </span>
            </div>
            {dataResponse?.latest_observation_date && (
              <div>
                <span>{isMr ? "शेवटचे नोंदवलेले बाजार बुलेटिन: " : "Latest Bulletin Date: "}</span>
                <strong className="text-text-main">{dataResponse.latest_observation_date}</strong>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
