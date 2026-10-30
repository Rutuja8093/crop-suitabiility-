/**
 * Utility functions for formatting and retrieving the live date.
 * Ensures the Soil Health Card and reports always reflect today's current date in Asia/Kolkata (India) timezone.
 */

/**
 * Format date in Asia/Kolkata (IST) timezone as DD-MM-YYYY.
 * If no date or legacy static placeholder is provided, formats today's live runtime date.
 */
export const formatReportDateIndia = (dateInput?: Date | string | null): string => {
  const isStaticPlaceholder =
    dateInput === "20-09-2026" ||
    dateInput === "01-10-2026" ||
    dateInput === "02-10-2026" ||
    dateInput === "03/10/2026" ||
    dateInput === "Pending";

  if (!dateInput || isStaticPlaceholder) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formatter.format(now).replace(/\//g, "-");
  }

  if (typeof dateInput === "string" && /^\d{2}-\d{2}-\d{4}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return formatter.format(now).replace(/\//g, "-");
    }
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formatter.format(d).replace(/\//g, "-");
  } catch {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formatter.format(now).replace(/\//g, "-");
  }
};

/**
 * Live date string helper for Soil Health Card components.
 */
export const getLiveDateStr = (dateInput?: string | null): string => {
  return formatReportDateIndia(dateInput);
};

export const getLiveSampleDateStr = (daysAgo = 5): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(d).replace(/\//g, "-");
};
