import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const village = searchParams.get("village") || "Malegaon Khurd";
  const villageId = parseInt(searchParams.get("village_id") || "87", 10) || 87;

  try {
    const jsonPath = path.join(process.cwd(), "public", "data", "gat_farmers.json");
    if (fs.existsSync(jsonPath)) {
      const fileData = fs.readFileSync(jsonPath, "utf-8");
      const data = JSON.parse(fileData);
      const byGat = data.by_gat || {};

      const gats = Object.keys(byGat)
        .sort((a, b) => {
          const numA = parseInt(a.replace(/[^\d]/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/[^\d]/g, ""), 10) || 0;
          return numA - numB;
        })
        .map((gat_no) => ({
          gat_no,
          farmer_count: byGat[gat_no]?.length || 0,
        }));

      return NextResponse.json({
        village,
        village_id: villageId,
        total_gats: gats.length,
        total_farmers: data.total_records || 0,
        gats,
      });
    }
  } catch (err) {
    console.error("Error reading gat_farmers.json in Next.js API:", err);
  }

  return NextResponse.json({
    village,
    village_id: villageId,
    total_gats: 0,
    total_farmers: 0,
    gats: [],
  });
}
