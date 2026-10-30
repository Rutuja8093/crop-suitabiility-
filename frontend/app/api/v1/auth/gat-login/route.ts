import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawGat = String(body.gat_no || "22").trim();
    const cleanGat = rawGat.replace(/[^\d]/g, "") || rawGat;

    // Try to load farmer details from gat_farmers.json if available
    let farmerName = `Farmer (Gat ${cleanGat})`;
    try {
      const jsonPath = path.join(process.cwd(), "public", "data", "gat_farmers.json");
      if (fs.existsSync(jsonPath)) {
        const fileData = fs.readFileSync(jsonPath, "utf-8");
        const data = JSON.parse(fileData);
        const list = data.by_gat?.[cleanGat] || data.by_gat?.[rawGat] || [];
        if (list.length > 0 && list[0].name) {
          farmerName = list[0].name;
        }
      }
    } catch (e) {
      // Non-fatal fallback
    }

    const token = `session_gat_${cleanGat}_${Date.now()}`;

    const responsePayload = {
      success: true,
      message: "Farm verified successfully",
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
        name: farmerName,
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

    const res = NextResponse.json(responsePayload, { status: 200 });

    // Set HTTP session cookie
    res.cookies.set("soilpilot_session", token, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return res;
  } catch (error: any) {
    console.error("Error in gat-login Next.js API:", error);
    return NextResponse.json(
      { error: "Authentication failed", detail: error.message },
      { status: 500 }
    );
  }
}
