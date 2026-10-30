import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const PUNE_TALUKAS = [
  { id: 6, district_id: 1, name: "Baramati", code: "BRM", is_active: true },
  { id: 1, district_id: 1, name: "Haveli", code: "HVL", is_active: true },
  { id: 2, district_id: 1, name: "Pune City", code: "PNC", is_active: true },
  { id: 3, district_id: 1, name: "Maval", code: "MVL", is_active: true },
  { id: 4, district_id: 1, name: "Mulshi", code: "MLS", is_active: true },
  { id: 5, district_id: 1, name: "Shirur", code: "SHR", is_active: true },
  { id: 7, district_id: 1, name: "Daund", code: "DND", is_active: true },
  { id: 8, district_id: 1, name: "Indapur", code: "IND", is_active: true },
  { id: 9, district_id: 1, name: "Bhor", code: "BHR", is_active: true },
  { id: 10, district_id: 1, name: "Velha", code: "VLH", is_active: true },
  { id: 11, district_id: 1, name: "Purandar", code: "PRN", is_active: true },
  { id: 12, district_id: 1, name: "Khed", code: "KHD", is_active: true },
  { id: 13, district_id: 1, name: "Junnar", code: "JNR", is_active: true },
  { id: 14, district_id: 1, name: "Ambegaon", code: "AMB", is_active: true },
  { id: 15, district_id: 1, name: "Pimpri-Chinchwad", code: "PCMC", is_active: true },
  { id: 16, district_id: 1, name: "Loni Kalbhor", code: "LKB", is_active: true },
];

export async function GET(request: NextRequest) {
  const districtId = request.nextUrl.searchParams.get("district_id") || "1";
  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/geography/talukas?district_id=${districtId}`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch (_err) {
    // Backend offline or timed out, use fallback
  }
  return NextResponse.json(PUNE_TALUKAS);
}
