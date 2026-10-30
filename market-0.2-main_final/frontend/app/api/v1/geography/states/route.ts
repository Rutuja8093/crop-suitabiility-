import { NextResponse } from "next/server";

const BACKEND_BASE = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const DEFAULT_STATES = [
  { id: 1, name: "Maharashtra", code: "MH", is_active: true }
];

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/geography/states`, {
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
  return NextResponse.json(DEFAULT_STATES);
}
