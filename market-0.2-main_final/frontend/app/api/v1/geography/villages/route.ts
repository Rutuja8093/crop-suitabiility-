import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const BARAMATI_VILLAGES = [
  { id: 87, taluka_id: 6, name: "Malegaon Kh", code: "MAL", is_active: true },
  { id: 86, taluka_id: 6, name: "Malegaon Bk", code: "MAL", is_active: true },
  { id: 85, taluka_id: 6, name: "Baramati", code: "BAR", is_active: true },
  { id: 88, taluka_id: 6, name: "Katewadi", code: "KAT", is_active: true },
  { id: 89, taluka_id: 6, name: "Dorlewadi", code: "DOR", is_active: true },
  { id: 90, taluka_id: 6, name: "Gunwadi", code: "GUN", is_active: true },
  { id: 91, taluka_id: 6, name: "Katphal", code: "KAT", is_active: true },
  { id: 92, taluka_id: 6, name: "Korhale Bk", code: "KOR", is_active: true },
  { id: 93, taluka_id: 6, name: "Korhale Kh", code: "KOR", is_active: true },
  { id: 94, taluka_id: 6, name: "Jalgaon Supe", code: "JAL", is_active: true },
  { id: 95, taluka_id: 6, name: "Songaon", code: "SON", is_active: true },
  { id: 96, taluka_id: 6, name: "Morgaon", code: "MOR", is_active: true },
  { id: 97, taluka_id: 6, name: "Supe", code: "SUP", is_active: true },
  { id: 98, taluka_id: 6, name: "Shirsuphal", code: "SHI", is_active: true },
  { id: 99, taluka_id: 6, name: "Khandaj", code: "KHA", is_active: true },
  { id: 100, taluka_id: 6, name: "Anjangaon", code: "ANJ", is_active: true },
];

export async function GET(request: NextRequest) {
  const talukaId = parseInt(request.nextUrl.searchParams.get("taluka_id") || "6", 10) || 6;
  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/geography/villages?taluka_id=${talukaId}`, {
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

  if (talukaId === 6) {
    return NextResponse.json(BARAMATI_VILLAGES);
  }

  return NextResponse.json([
    { id: 87, taluka_id: talukaId, name: "Malegaon Kh", code: "MAL", is_active: true },
    { id: 86, taluka_id: talukaId, name: "Malegaon Bk", code: "MAL", is_active: true },
    { id: 85, taluka_id: talukaId, name: "Baramati", code: "BAR", is_active: true },
  ]);
}
