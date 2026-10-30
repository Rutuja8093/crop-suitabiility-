import { BBox } from "@/types/gis";
import { GatFeature, Position } from "@/types/gat";

export class KmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KmlParseError";
  }
}

export interface ParsedKmlResult {
  features: GatFeature[];
  documentName?: string;
  skipped: number;
  warnings: string[];
}

/**
 * Calculates geodesic polygon area in hectares around latitude ~18.15.
 */
function calculatePolygonAreaHa(coords: Position[]): number {
  if (coords.length < 4) return 0.0;

  const lat0 = (18.15 * Math.PI) / 180.0;
  const mPerDegLat = 111132.954 - 559.822 * Math.cos(2 * lat0);
  const mPerDegLon = 111412.84 * Math.cos(lat0);

  let area = 0.0;
  const n = coords.length;
  for (let i = 0; i < n - 1; i++) {
    const x1 = coords[i][0] * mPerDegLon;
    const y1 = coords[i][1] * mPerDegLat;
    const x2 = coords[i + 1][0] * mPerDegLon;
    const y2 = coords[i + 1][1] * mPerDegLat;
    area += x1 * y2 - x2 * y1;
  }

  const areaSqM = Math.abs(area) / 2.0;
  return Math.round((areaSqM / 10000.0) * 100) / 100;
}

/**
 * Parses raw KML text into GeoJSON GatFeature elements.
 */
export function parseKml(
  kmlText: string,
  source: "sample" | "upload" = "sample"
): ParsedKmlResult {
  if (!kmlText || !kmlText.trim()) {
    throw new KmlParseError("KML file is empty");
  }

  let doc: Document | null = null;
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(kmlText, "application/xml");
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        throw new KmlParseError(parseError.textContent || "Invalid XML format");
      }
    } catch (e) {
      if (e instanceof KmlParseError) throw e;
    }
  }

  const features: GatFeature[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let documentName = "Cadastral Boundary";

  if (doc) {
    const docNameEl = doc.querySelector("Document > name, kml > name");
    if (docNameEl?.textContent) {
      documentName = docNameEl.textContent.trim();
    }

    const placemarks = Array.from(doc.querySelectorAll("Placemark"));
    if (placemarks.length === 0) {
      throw new KmlParseError("No Placemarks found in KML");
    }

    for (const pm of placemarks) {
      const nameEl = pm.querySelector("name");
      const descEl = pm.querySelector("description");
      const name = nameEl?.textContent?.trim() || "";
      const description = descEl?.textContent?.trim() || null;

      // Extract attributes from ExtendedData
      const attributes: Record<string, string> = {};
      const simpleData = Array.from(pm.querySelectorAll("SimpleData, Data"));
      for (const d of simpleData) {
        const attrName = d.getAttribute("name");
        const val = d.textContent?.trim();
        if (attrName && val) {
          attributes[attrName] = val;
        }
      }

      // Check coordinates in Polygon or MultiGeometry
      const coordEls = Array.from(pm.querySelectorAll("coordinates"));
      if (coordEls.length === 0) {
        skipped++;
        continue;
      }

      // Collect all polygon rings
      const rings: Position[][] = [];
      let minLon = Infinity,
        maxLon = -Infinity,
        minLat = Infinity,
        maxLat = -Infinity;
      let totalLon = 0,
        totalLat = 0,
        coordCount = 0;

      for (const cEl of coordEls) {
        const rawCoords = cEl.textContent?.trim() || "";
        const points = rawCoords
          .split(/\s+/)
          .map((pt) => {
            const parts = pt.split(",").map((n) => parseFloat(n.trim()));
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              const lon = parts[0];
              const lat = parts[1];
              if (lon < minLon) minLon = lon;
              if (lon > maxLon) maxLon = lon;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
              totalLon += lon;
              totalLat += lat;
              coordCount++;
              return [lon, lat] as Position;
            }
            return null;
          })
          .filter((p): p is Position => p !== null);

        if (points.length >= 3) {
          // Close the ring if not already closed
          if (
            points[0][0] !== points[points.length - 1][0] ||
            points[0][1] !== points[points.length - 1][1]
          ) {
            points.push([...points[0]]);
          }
          rings.push(points);
        }
      }

      if (rings.length === 0 || coordCount === 0) {
        skipped++;
        continue;
      }

      const subMatch = name.match(/\d+\/[A-Za-z0-9]+/);
      const numMatch = name.match(/\d+/);
      const cleanGat = subMatch ? subMatch[0].toUpperCase() : (numMatch ? numMatch[0] : (name || `gat_${features.length + 1}`));

      const areaHa = calculatePolygonAreaHa(rings[0]);
      const areaSqm = Math.round(areaHa * 10000);
      const areaAcres = Number((areaHa * 2.47105).toFixed(2));

      const centroid: Position = [
        Number((totalLon / coordCount).toFixed(6)),
        Number((totalLat / coordCount).toFixed(6)),
      ];
      const bounds: BBox = [minLon, minLat, maxLon, maxLat];

      const isVillage =
        name.toLowerCase().includes("village") ||
        (name.toLowerCase().includes("boundary") && !name.toLowerCase().includes("gat"));

      features.push({
        type: "Feature",
        id: cleanGat,
        properties: {
          gat_id: cleanGat,
          name: name || `Gat ${cleanGat}`,
          description,
          area_sqm: areaSqm,
          area_ha: areaHa,
          area_acres: areaAcres,
          centroid,
          bounds,
          source,
          is_village_boundary: isVillage,
          attributes,
        },
        geometry: {
          type: "Polygon",
          coordinates: rings,
        },
      });
    }
  } else {
    // Regex fallback for non-DOM environments
    const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
    const matches = kmlText.match(placemarkRegex) || [];

    for (const pmText of matches) {
      const nameMatch = pmText.match(/<name>([^<]+)<\/name>/i);
      const name = nameMatch ? nameMatch[1].trim() : `gat_${features.length + 1}`;
      const subMatch = name.match(/\d+\/[A-Za-z0-9]+/);
      const numMatch = name.match(/\d+/);
      const cleanGat = subMatch ? subMatch[0].toUpperCase() : (numMatch ? numMatch[0] : name);

      const coordMatch = pmText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
      if (!coordMatch) {
        skipped++;
        continue;
      }

      const points: Position[] = [];
      let minLon = Infinity,
        maxLon = -Infinity,
        minLat = Infinity,
        maxLat = -Infinity;
      let totalLon = 0,
        totalLat = 0;

      for (const line of coordMatch[1].trim().split(/\s+/)) {
        const p = line.split(",").map((n) => parseFloat(n.trim()));
        if (p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1])) {
          points.push([p[0], p[1]]);
          if (p[0] < minLon) minLon = p[0];
          if (p[0] > maxLon) maxLon = p[0];
          if (p[1] < minLat) minLat = p[1];
          if (p[1] > maxLat) maxLat = p[1];
          totalLon += p[0];
          totalLat += p[1];
        }
      }

      if (points.length < 3) {
        skipped++;
        continue;
      }

      if (
        points[0][0] !== points[points.length - 1][0] ||
        points[0][1] !== points[points.length - 1][1]
      ) {
        points.push([...points[0]]);
      }

      const areaHa = calculatePolygonAreaHa(points);
      const areaSqm = Math.round(areaHa * 10000);
      const areaAcres = Number((areaHa * 2.47105).toFixed(2));

      features.push({
        type: "Feature",
        id: cleanGat,
        properties: {
          gat_id: cleanGat,
          name,
          description: null,
          area_sqm: areaSqm,
          area_ha: areaHa,
          area_acres: areaAcres,
          centroid: [totalLon / points.length, totalLat / points.length],
          bounds: [minLon, minLat, maxLon, maxLat],
          source,
          attributes: {},
        },
        geometry: {
          type: "Polygon",
          coordinates: [points],
        },
      });
    }
  }

  if (features.length === 0) {
    throw new KmlParseError("No valid polygonal parcel geometries found in KML");
  }

  return {
    features,
    documentName,
    skipped,
    warnings,
  };
}
