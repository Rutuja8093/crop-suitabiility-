import { api } from "@/lib/api/client";
import { SoilHealthReport } from "@/types/soilHealth";

export interface ReportVerificationResult {
  verified: boolean;
  status: string;
  report_no?: string;
  receipt_no?: string;
  farmer_name?: string;
  gat_no?: string;
  village?: string;
  taluka?: string;
  district?: string;
  report_date?: string;
  sample_date?: string;
  is_demo?: boolean;
  laboratory_name?: string;
}

export const reportService = {
  /**
   * Fetch complete Soil Health Report metadata and parameters.
   */
  async getFieldReport(fieldId: string | number): Promise<SoilHealthReport> {
    try {
      const response = await api.get<SoilHealthReport>(`/reports/${fieldId}`);
      if (response.data && response.data.parameters && response.data.parameters.length > 0) {
        return response.data;
      }
      const { soilHealthService } = await import("./soilHealthService");
      return soilHealthService.getFieldReport(fieldId);
    } catch (err) {
      const { soilHealthService } = await import("./soilHealthService");
      return soilHealthService.getFieldReport(fieldId);
    }
  },

  /**
   * Fetch Soil Health Card specific diagnostics.
   */
  async getSoilHealthCard(fieldId: string | number): Promise<SoilHealthReport> {
    try {
      const response = await api.get<SoilHealthReport>(`/reports/${fieldId}/soil-health-card`);
      if (response.data && response.data.parameters && response.data.parameters.length > 0) {
        return response.data;
      }
      const { soilHealthService } = await import("./soilHealthService");
      return soilHealthService.getFieldReport(fieldId);
    } catch (err) {
      const { soilHealthService } = await import("./soilHealthService");
      return soilHealthService.getFieldReport(fieldId);
    }
  },

  /**
   * Get direct URL for Soil Health Card PDF.
   */
  getSoilHealthCardPdfUrl(fieldId: string | number, lang: string = "en", farmerName?: string): string {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("soilpilot_token") || "" : "";
    let url = `/api/pdf/soil-health-card?fieldId=${encodeURIComponent(fieldId)}&lang=${encodeURIComponent(lang)}`;
    if (token) url += `&token=${encodeURIComponent(token)}`;
    if (farmerName) url += `&farmer_name=${encodeURIComponent(farmerName)}`;
    return url;
  },

  /**
   * Get direct URL for Detailed Soil Report PDF.
   */
  getDetailedReportPdfUrl(fieldId: string | number, lang: string = "en", farmerName?: string): string {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("soilpilot_token") || "" : "";
    let url = `/api/pdf/detailed-report?fieldId=${encodeURIComponent(fieldId)}&lang=${encodeURIComponent(lang)}`;
    if (token) url += `&token=${encodeURIComponent(token)}`;
    if (farmerName) url += `&farmer_name=${encodeURIComponent(farmerName)}`;
    return url;
  },

  /**
   * Trigger download of official Soil Health Card PDF from backend.
   */
  async downloadSoilHealthCardPdf(fieldId: string | number, lang: string = "en", farmerName?: string): Promise<void> {
    const cleanGat = String(fieldId).replace(/[^\d]/g, "") || "18";
    const { formatReportDateIndia } = await import("@/lib/dateUtils");
    const liveDate = formatReportDateIndia();
    const filename = `SoilPilot_Soil_Health_Card_Gat_${cleanGat}_${liveDate}.pdf`;
    const directUrl = this.getSoilHealthCardPdfUrl(fieldId, lang, farmerName);

    try {
      const res = await fetch(directUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        let targetFilename = filename;
        const disposition = res.headers.get("content-disposition");
        if (disposition) {
          const match = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)["']?/i.exec(disposition);
          if (match && match[1]) {
            targetFilename = decodeURIComponent(match[1].trim().replace(/['"]/g, ""));
          }
        }
        if (!targetFilename.toLowerCase().endsWith(".pdf")) {
          targetFilename += ".pdf";
        }

        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = blobUrl;
        a.download = targetFilename;
        a.setAttribute("download", targetFilename);
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        }, 2000);
        return;
      }
    } catch (e) {
      console.warn("Proxy download failed, falling back to direct navigation:", e);
    }

    // Direct browser navigation stream fallback
    window.location.assign(directUrl);
  },

  /**
   * Trigger download of official Detailed Soil Report PDF from backend.
   */
  async downloadDetailedReportPdf(fieldId: string | number, lang: string = "en", farmerName?: string): Promise<void> {
    const cleanGat = String(fieldId).replace(/[^\d]/g, "") || "18";
    const { formatReportDateIndia } = await import("@/lib/dateUtils");
    const liveDate = formatReportDateIndia();
    const filename = `SoilPilot_Detailed_Soil_Report_Gat_${cleanGat}_${liveDate}.pdf`;
    const directUrl = this.getDetailedReportPdfUrl(fieldId, lang, farmerName);

    try {
      const res = await fetch(directUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        let targetFilename = filename;
        const disposition = res.headers.get("content-disposition");
        if (disposition) {
          const match = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)["']?/i.exec(disposition);
          if (match && match[1]) {
            targetFilename = decodeURIComponent(match[1].trim().replace(/['"]/g, ""));
          }
        }
        if (!targetFilename.toLowerCase().endsWith(".pdf")) {
          targetFilename += ".pdf";
        }

        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = blobUrl;
        a.download = targetFilename;
        a.setAttribute("download", targetFilename);
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        }, 2000);
        return;
      }
    } catch (e) {
      console.warn("Detailed report proxy download failed, falling back to direct navigation:", e);
    }

    // Direct browser navigation stream fallback
    window.location.assign(directUrl);
  },

  /**
   * Verify authenticity of a report number.
   */
  async verifyReport(reportNo: string): Promise<ReportVerificationResult> {
    const response = await api.get<ReportVerificationResult>(`/reports/verify/${encodeURIComponent(reportNo)}`);
    return response.data;
  },
};
