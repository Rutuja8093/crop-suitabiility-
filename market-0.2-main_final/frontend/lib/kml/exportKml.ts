import { GatCollection, GatStats } from "@/types/gat";

/**
 * Converts a GatCollection to standard OGC KML 2.2 XML with embedded diagnostic stats.
 */
export function collectionToKml(
  collection: GatCollection,
  documentName: string = "SoilPilot Cadastral Gats",
  statsById?: Record<string, GatStats>
): string {
  const placemarksXml = (collection.features || [])
    .map((feature) => {
      const p = feature.properties;
      const stats = statsById?.[p.gat_id] || statsById?.[feature.id];

      // Format coordinates for KML: lon,lat,0
      const geom = feature.geometry;
      let coordsText = "";
      if (geom.type === "Polygon") {
        const ring = geom.coordinates[0] || [];
        coordsText = ring.map((pt) => `${pt[0]},${pt[1]},0`).join(" ");
      } else if (geom.type === "MultiPolygon") {
        const ring = geom.coordinates[0]?.[0] || [];
        coordsText = ring.map((pt) => `${pt[0]},${pt[1]},0`).join(" ");
      }

      const extendedDataLines: string[] = [
        `        <Data name="gat_id"><value>${escapeXml(p.gat_id)}</value></Data>`,
        `        <Data name="area_ha"><value>${p.area_ha ?? 0}</value></Data>`,
        `        <Data name="area_acres"><value>${p.area_acres ?? 0}</value></Data>`,
      ];

      if (stats?.params) {
        if (stats.params.ph) extendedDataLines.push(`        <Data name="ph"><value>${stats.params.ph.mean}</value></Data>`);
        if (stats.params.soc) extendedDataLines.push(`        <Data name="soc"><value>${stats.params.soc.mean}</value></Data>`);
        if (stats.params.nitrogen) extendedDataLines.push(`        <Data name="nitrogen"><value>${stats.params.nitrogen.mean}</value></Data>`);
        if (stats.params.bd) extendedDataLines.push(`        <Data name="bd"><value>${stats.params.bd.mean}</value></Data>`);
        if (stats.params.ndvi) extendedDataLines.push(`        <Data name="ndvi"><value>${stats.params.ndvi.mean}</value></Data>`);
      }

      return `    <Placemark>
      <name>${escapeXml(p.name || `Gat ${p.gat_id}`)}</name>
      <description>${escapeXml(p.description || `Cadastral Parcel Gat No. ${p.gat_id}`)}</description>
      <ExtendedData>
${extendedDataLines.join("\n")}
      </ExtendedData>
      <Polygon>
        <extrude>0</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${coordsText}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(documentName)}</name>
    <Style id="gatPolyStyle">
      <LineStyle>
        <color>ff00e676</color>
        <width>2.5</width>
      </LineStyle>
      <PolyStyle>
        <color>4d00e676</color>
      </PolyStyle>
    </Style>
${placemarksXml}
  </Document>
</kml>`;
}

function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Triggers a browser download of a generated text/KML file.
 */
export function downloadTextFile(filename: string, content: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
