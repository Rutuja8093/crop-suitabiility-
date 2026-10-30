import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const DEFAULT_DISTRICTS = [
  { id: 1, state_id: 1, name: "Pune", code: "PN", is_active: true },
  { id: 2, state_id: 1, name: "Nashik", code: "NAS", is_active: true }
];

export async function GET(request: NextRequest) {
  const stateId = request.nextUrl.searchParams.get("state_id") || "1";
  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/geography/districts?state_id=${stateId}`, {
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
  return NextResponse.json(DEFAULT_DISTRICTS);
}
