import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ success: true, message: "Logged out successfully" });
  res.cookies.delete("soilpilot_session");
  return res;
}
