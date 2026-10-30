import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const cookie = request.cookies.get("soilpilot_session")?.value || "";

    let gatNo = "22";
    const tokenMatch = (authHeader + " " + cookie).match(/session_gat_(\d+)/);
    if (tokenMatch && tokenMatch[1]) {
      gatNo = tokenMatch[1];
    }

    let farmerName = `Farmer (Gat ${gatNo})`;
    try {
      const jsonPath = path.join(process.cwd(), "public", "data", "gat_farmers.json");
      if (fs.existsSync(jsonPath)) {
        const fileData = fs.readFileSync(jsonPath, "utf-8");
        const data = JSON.parse(fileData);
        const list = data.by_gat?.[gatNo] || [];
        if (list.length > 0 && list[0].name) {
          farmerName = list[0].name;
        }
      }
    } catch (e) {
      // Non-fatal
    }

    return NextResponse.json({
      authenticated: true,
      field: {
        id: parseInt(gatNo, 10) || 22,
        gat_no: gatNo,
        area: 3.68,
        area_unit: "acres",
        is_demo: false,
      },
      farmer: {
        id: parseInt(gatNo, 10) || 22,
        name: farmerName,
        farmer_code: `FARMER-${gatNo}`,
        role: "farmer",
        gat_number: gatNo,
      },
      location: {
        state: "Maharashtra",
        district: "Pune",
        taluka: "Baramati",
        village: "Malegaon Kh",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, detail: error.message },
      { status: 200 }
    );
  }
}
