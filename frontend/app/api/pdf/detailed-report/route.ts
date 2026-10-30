import { NextRequest, NextResponse } from "next/server";
import { generatePdfFallback } from "@/lib/pdfGeneratorFallback";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fieldId = searchParams.get("fieldId") || "104";
  const lang = searchParams.get("lang") || "en";
  const token = searchParams.get("token") || "";
  const farmerName = searchParams.get("farmer_name") || "";
  const farmerId = searchParams.get("farmer_id") || "";

  // 1. First, attempt to proxy via live backend HTTP server
  try {
    let backendUrl =
      process.env.BACKEND_URL ||
      process.env.BACKEND_INTERNAL_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:8000");
    if (backendUrl && !backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
      backendUrl = `https://${backendUrl}`;
    }
    const targetUrl = new URL(`/api/v1/reports/${encodeURIComponent(fieldId)}/detailed/pdf`, backendUrl);
    targetUrl.searchParams.set("lang", lang);
    if (token) {
      targetUrl.searchParams.set("token", token);
    }
    if (farmerName) {
      targetUrl.searchParams.set("farmer_name", farmerName);
    }
    if (farmerId) {
      targetUrl.searchParams.set("farmer_id", farmerId);
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const backendRes = await fetch(targetUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (backendRes.ok) {
      const pdfBuffer = await backendRes.arrayBuffer();
      const dispositionHeader = backendRes.headers.get("content-disposition");

      const { formatReportDateIndia } = await import("@/lib/dateUtils");
      const liveDate = formatReportDateIndia();
      let cleanFilename = `SoilPilot_Detailed_Soil_Report_Gat_${String(fieldId).replace(/^demo-field-gat-/, "")}_${liveDate}.pdf`;
      if (dispositionHeader) {
        const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i.exec(dispositionHeader);
        if (match && match[1]) {
          const extracted = match[1].replace(/['"]/g, "").trim();
          if (extracted) {
            cleanFilename = extracted.toLowerCase().endsWith(".pdf") ? extracted : `${extracted}.pdf`;
          }
        }
      }

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${cleanFilename}"`,
          "Access-Control-Expose-Headers": "Content-Disposition",
          "Content-Length": pdfBuffer.byteLength.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }
  } catch (err: any) {
    console.warn("Backend HTTP proxy unreachable, attempting local generator fallback:", err.message);
  }

  // 2. Standalone generator fallback: directly invokes the Python PDF engine
  try {
    const { buffer, filename } = await generatePdfFallback({
      type: "detailed",
      fieldId,
      lang,
      farmerName,
      baseUrl: request.nextUrl.origin || "http://localhost:3000",
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (fallbackErr: any) {
    console.error("PDF generation fallback also failed:", fallbackErr);
    return new NextResponse("Internal Server Error generating Detailed Report PDF", { status: 500 });
  }
}

