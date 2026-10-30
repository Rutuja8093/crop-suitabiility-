import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const rawGat = String(body.gat_no || "22").trim();
  const cleanGat = rawGat.replace(/[^\d]/g, "") || rawGat;
  const fullName = body.full_name || `Farmer (Gat ${cleanGat})`;
  const token = `session_gat_${cleanGat}_${Date.now()}`;

  const responsePayload = {
    success: true,
    message: "Registration successful",
    token,
    field: {
      id: parseInt(cleanGat, 10) || 22,
      gat_no: cleanGat,
      area: 3.68,
      area_unit: "acres",
      is_demo: false,
    },
    farmer: {
      id: parseInt(cleanGat, 10) || 22,
      name: fullName,
      farmer_code: `FARMER-${cleanGat}`,
      role: "farmer",
      gat_number: cleanGat,
    },
    location: {
      state: "Maharashtra",
      district: "Pune",
      taluka: "Baramati",
      village: "Malegaon Kh",
    },
  };

  const res = NextResponse.json(responsePayload, { status: 201 });
  res.cookies.set("soilpilot_session", token, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 86400 * 7,
  });

  return res;
}
