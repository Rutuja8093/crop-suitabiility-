import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

interface GeneratePdfOptions {
  type: "detailed" | "soil-health-card";
  fieldId: string | number;
  lang?: string;
  farmerName?: string;
  baseUrl?: string;
}

interface GeneratePdfResult {
  buffer: Buffer;
  filename: string;
}

export async function generatePdfFallback(options: GeneratePdfOptions): Promise<GeneratePdfResult> {
  const rootDir = path.resolve(process.cwd(), "..");
  let scriptPath = path.join(rootDir, "scripts", "generate_pdf.py");
  if (!fs.existsSync(scriptPath)) {
    scriptPath = path.resolve(process.cwd(), "scripts", "generate_pdf.py");
  }

  const cleanGat = String(options.fieldId).replace(/[^\d]/g, "") || "104";
  const defaultFilename = `SoilPilot_Soil_Health_Card_Gat_${cleanGat}.pdf`;

  const tmpOut = path.join(os.tmpdir(), `soilpilot_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`);

  const args = [
    scriptPath,
    "--type",
    options.type,
    "--field",
    String(options.fieldId),
    "--lang",
    options.lang || "en",
    "--output",
    tmpOut,
    "--base-url",
    options.baseUrl || "http://localhost:3000",
  ];

  if (options.farmerName) {
    args.push("--farmer-name", options.farmerName);
  }

  return new Promise((resolve, reject) => {
    execFile(
      "python",
      args,
      {
        cwd: rootDir,
        timeout: 25000,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("PDF generation fallback execution error:", error, stderr);
          if (fs.existsSync(tmpOut)) {
            try {
              fs.unlinkSync(tmpOut);
            } catch (_) {}
          }
          return reject(error);
        }

        try {
          if (!fs.existsSync(tmpOut)) {
            return reject(new Error("PDF file was not created by generator script"));
          }
          const buffer = fs.readFileSync(tmpOut);
          try {
            fs.unlinkSync(tmpOut);
          } catch (_) {}

          let filename = defaultFilename;
          const stdoutStr = stdout ? stdout.toString() : "";
          const match = /FILENAME:(.+)/.exec(stdoutStr);
          if (match && match[1]) {
            filename = match[1].trim();
          }

          resolve({ buffer, filename });
        } catch (readErr) {
          reject(readErr);
        }
      }
    );
  });
}
