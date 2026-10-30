import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawGat = searchParams.get("gat_no") || "";
  const village = searchParams.get("village") || "Malegaon Khurd";
  const villageId = parseInt(searchParams.get("village_id") || "87", 10) || 87;

  if (!rawGat.trim()) {
    return NextResponse.json(
      { error: "Gat number is required" },
      { status: 400 }
    );
  }

  const cleanNum = rawGat.replace(/[^\d]/g, "") || rawGat.trim();

  try {
    const jsonPath = path.join(process.cwd(), "public", "data", "gat_farmers.json");
    if (fs.existsSync(jsonPath)) {
      const fileData = fs.readFileSync(jsonPath, "utf-8");
      const data = JSON.parse(fileData);
      const list =
        data.by_gat?.[cleanNum] ||
        data.by_gat?.[rawGat.trim()] ||
        data.by_gat?.[`Gat ${cleanNum}`] ||
        [];

      return NextResponse.json({
        village,
        village_id: villageId,
        gat_no: rawGat,
        total: list.length,
        farmers: list.map((item: any) => ({
          id: item.id,
          name: item.name,
        })),
      });
    }
  } catch (err) {
    console.error("Error reading gat_farmers.json in Next.js API:", err);
  }

  return NextResponse.json({
    village,
    village_id: villageId,
    gat_no: rawGat,
    total: 0,
    farmers: [],
  });
}
