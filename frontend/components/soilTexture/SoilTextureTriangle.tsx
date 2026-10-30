"use client";

import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  SoilComposition,
  USDAClassKey,
} from "@/lib/soilTexture/soilTextureClassification";
import {
  DEFAULT_GEOMETRY,
  compositionToSvgPoint,
  svgPointToComposition,
  USDA_POLYGONS,
  getPolygonSvgPoints,
  getPolygonCentroid,
  generateClayGridLines,
  generateSiltGridLines,
  generateSandGridLines,
  SvgPoint,
  ClassPolygonDef,
} from "@/lib/soilTexture/soilTextureCoordinates";
import {
  USDA_CLASS_METADATA,
} from "@/lib/soilTexture/soilTextureData";

interface SoilTextureTriangleProps {
  composition: SoilComposition;
  isValidComposition: boolean;
  activeClassKey?: USDAClassKey;
  onSelectComposition?: (newComp: SoilComposition) => void;
  showGuideLines?: boolean;
  showClassLabels?: boolean;
  language?: string;
  className?: string;
}

export const SoilTextureTriangle: React.FC<SoilTextureTriangleProps> = ({
  composition,
  isValidComposition,
  activeClassKey,
  onSelectComposition,
  showGuideLines = true,
  showClassLabels = true,
  language = "en",
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredClass, setHoveredClass] = useState<USDAClassKey | null>(null);
  const [hoverPos, setHoverPos] = useState<SvgPoint | null>(null);
  const [hoverComp, setHoverComp] = useState<SoilComposition | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const geo = DEFAULT_GEOMETRY;
  const isMr = language === "mr";

  // Pre-calculate gridlines
  const clayGrid = useMemo(() => generateClayGridLines(geo), [geo]);
  const siltGrid = useMemo(() => generateSiltGridLines(geo), [geo]);
  const sandGrid = useMemo(() => generateSandGridLines(geo), [geo]);

  // Marker point in SVG coordinates
  const markerPoint = useMemo(() => {
    if (!isValidComposition) return null;
    return compositionToSvgPoint(composition, geo);
  }, [composition, isValidComposition, geo]);

  // Convert client pointer event into SVG coordinate
  const getSvgCoordinates = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>): SvgPoint | null => {
      const svg = svgRef.current;
      if (!svg) return null;

      const pt = svg.createSVGPoint();
      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        pt.x = e.touches[0].clientX;
        pt.y = e.touches[0].clientY;
      } else {
        pt.x = e.clientX;
        pt.y = e.clientY;
      }

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    },
    []
  );

  const handlePointerSelect = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      if (!onSelectComposition) return;
      const svgPt = getSvgCoordinates(e);
      if (!svgPt) return;

      const newComp = svgPointToComposition(svgPt, geo);
      onSelectComposition(newComp);
    },
    [getSvgCoordinates, onSelectComposition, geo]
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgPt = getSvgCoordinates(e);
    if (!svgPt) {
      setHoverPos(null);
      setHoverComp(null);
      return;
    }
    setHoverPos(svgPt);
    const comp = svgPointToComposition(svgPt, geo);
    setHoverComp(comp);

    if (isDragging) {
      handlePointerSelect(e);
    }
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    setHoverComp(null);
    setHoverClass(null);
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    handlePointerSelect(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const setHoverClass = (key: USDAClassKey | null) => {
    setHoveredClass(key);
  };

  // Guidelines from marker to all 3 axes
  const guideLines = useMemo(() => {
    if (!markerPoint || !showGuideLines || !isValidComposition) return null;

    // 1. Clay line: horizontal to left edge (silt=0: sand = 100 - clay)
    const clayAxisPt = compositionToSvgPoint(
      { sand: 100 - composition.clay, silt: 0, clay: composition.clay },
      geo
    );

    // 2. Silt line: parallel to left edge down to bottom edge (clay=0: sand = 100 - silt)
    const siltAxisPt = compositionToSvgPoint(
      { sand: 100 - composition.silt, silt: composition.silt, clay: 0 },
      geo
    );

    // 3. Sand line: parallel to right edge down to bottom edge (clay=0: silt = 100 - sand)
    const sandAxisPt = compositionToSvgPoint(
      { sand: composition.sand, silt: 100 - composition.sand, clay: 0 },
      geo
    );

    return {
      clay: { from: markerPoint, to: clayAxisPt },
      silt: { from: markerPoint, to: siltAxisPt },
      sand: { from: markerPoint, to: sandAxisPt },
    };
  }, [markerPoint, showGuideLines, isValidComposition, composition, geo]);

  return (
    <div className={`relative select-none w-full flex flex-col items-center ${className}`}>
      <div className="relative w-full max-w-[650px] aspect-[650/560] bg-surface rounded-2xl border border-surface-border shadow-card p-2 sm:p-4 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          className="w-full h-full cursor-crosshair touch-none"
          role="img"
          aria-label="Interactive USDA Soil Texture Triangle"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={(e) => {
            setIsDragging(true);
            handlePointerSelect(e);
          }}
          onTouchMove={handlePointerSelect}
          onTouchEnd={() => setIsDragging(false)}
        >
          <defs>
            {/* Soft drop shadow for highlighted region */}
            <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#2A7C13" floodOpacity="0.35" />
            </filter>
            <filter id="markerShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* 1. Subtle Triangle Background Fill */}
          <polygon
            points={`${geo.clayVertex.x},${geo.clayVertex.y} ${geo.sandVertex.x},${geo.sandVertex.y} ${geo.siltVertex.x},${geo.siltVertex.y}`}
            fill="#FAFBF8"
            stroke="none"
          />

          {/* 2. Percentage Gridlines */}
          {/* Clay Gridlines (Horizontal) */}
          <g className="gridlines-clay opacity-60">
            {clayGrid.map((line, idx) => (
              <line
                key={`clay-grid-${idx}`}
                x1={line.p1.x}
                y1={line.p1.y}
                x2={line.p2.x}
                y2={line.p2.y}
                stroke="#64748B"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
            ))}
          </g>

          {/* Silt Gridlines (Parallel to Sand-Clay edge) */}
          <g className="gridlines-silt opacity-45">
            {siltGrid.map((line, idx) => (
              <line
                key={`silt-grid-${idx}`}
                x1={line.p1.x}
                y1={line.p1.y}
                x2={line.p2.x}
                y2={line.p2.y}
                stroke="#64748B"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
            ))}
          </g>

          {/* Sand Gridlines (Parallel to Silt-Clay edge) */}
          <g className="gridlines-sand opacity-45">
            {sandGrid.map((line, idx) => (
              <line
                key={`sand-grid-${idx}`}
                x1={line.p1.x}
                y1={line.p1.y}
                x2={line.p2.x}
                y2={line.p2.y}
                stroke="#64748B"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
            ))}
          </g>

          {/* 3. The 12 USDA Class Region Polygons */}
          <g className="class-regions">
            {USDA_POLYGONS.map((poly: ClassPolygonDef) => {
              const meta = USDA_CLASS_METADATA[poly.key];
              const isActive = activeClassKey === poly.key;
              const isHovered = hoveredClass === poly.key;
              const pointsStr = getPolygonSvgPoints(poly, geo);

              return (
                <polygon
                  key={poly.key}
                  points={pointsStr}
                  fill={meta.colorHex}
                  fillOpacity={isActive ? 0.95 : isHovered ? 0.85 : 0.62}
                  stroke={isActive ? "#2A7C13" : isHovered ? meta.colorDarkHex : meta.colorBorder}
                  strokeWidth={isActive ? 2.8 : isHovered ? 1.8 : 1.1}
                  strokeLinejoin="round"
                  filter={isActive ? "url(#activeGlow)" : undefined}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoverClass(poly.key)}
                  onMouseLeave={() => setHoverClass(null)}
                />
              );
            })}
          </g>

          {/* 4. Class Labels on the Polygons */}
          {showClassLabels && (
            <g className="class-labels pointer-events-none">
              {USDA_POLYGONS.map((poly) => {
                const centroid = getPolygonCentroid(poly, geo);
                const isActive = activeClassKey === poly.key;
                const isHovered = hoveredClass === poly.key;
                const meta = USDA_CLASS_METADATA[poly.key];

                return (
                  <g key={`label-${poly.key}`} transform={`translate(${centroid.x}, ${centroid.y})`}>
                    <rect
                      x={-28}
                      y={-9}
                      width={56}
                      height={18}
                      rx={4}
                      fill={isActive ? "#1C2B18" : "#FFFFFF"}
                      fillOpacity={isActive ? 0.92 : 0.82}
                      stroke={isActive ? "#2A7C13" : "#C4D1BE"}
                      strokeWidth={isActive ? 1.2 : 0.6}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={isActive || isHovered ? "10.5" : "9.5"}
                      fontWeight={isActive ? "800" : "600"}
                      fill={isActive ? "#FFFFFF" : "#1C2B18"}
                      className="transition-all tracking-tight"
                    >
                      {poly.shortLabel}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* 5. Outer Equilateral Triangle Border */}
          <polygon
            points={`${geo.clayVertex.x},${geo.clayVertex.y} ${geo.sandVertex.x},${geo.sandVertex.y} ${geo.siltVertex.x},${geo.siltVertex.y}`}
            fill="none"
            stroke="#1C2B18"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />

          {/* 6. Axis Scales, Ticks & Numbers */}

          {/* CLAY AXIS (Left Side: 0 at bottom to 100 at top) */}
          <g className="axis-clay">
            {/* Axis Title */}
            <text
              transform={`translate(${geo.sandVertex.x - 42}, ${(geo.sandVertex.y + geo.clayVertex.y) / 2}) rotate(-60)`}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="#2A7C13"
              letterSpacing="0.08em"
            >
              {isMr ? "← चिकणमाती CLAY (%)" : "← CLAY (%)"}
            </text>

            {/* Clay Ticks & Numbers (0 to 100) */}
            {clayGrid.map((line) => {
              const val = line.value;
              return (
                <g key={`clay-tick-${val}`}>
                  {/* Short tick line pointing outwards left */}
                  <line
                    x1={line.p1.x}
                    y1={line.p1.y}
                    x2={line.p1.x - 7}
                    y2={line.p1.y + 4}
                    stroke="#1C2B18"
                    strokeWidth="1.2"
                  />
                  <text
                    x={line.p1.x - 10}
                    y={line.p1.y + 3.5}
                    textAnchor="end"
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#334155"
                    className="font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}
          </g>

          {/* SILT AXIS (Right Side: 0 at top to 100 at bottom) */}
          <g className="axis-silt">
            {/* Axis Title */}
            <text
              transform={`translate(${geo.siltVertex.x + 44}, ${(geo.siltVertex.y + geo.clayVertex.y) / 2}) rotate(60)`}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="#2A7C13"
              letterSpacing="0.08em"
            >
              {isMr ? "गाळ SILT (%) →" : "SILT (%) →"}
            </text>

            {/* Silt Ticks & Numbers (0 to 100) */}
            {siltGrid.map((line) => {
              const val = line.value;
              return (
                <g key={`silt-tick-${val}`}>
                  <line
                    x1={line.p2.x}
                    y1={line.p2.y}
                    x2={line.p2.x + 7}
                    y2={line.p2.y + 4}
                    stroke="#1C2B18"
                    strokeWidth="1.2"
                  />
                  <text
                    x={line.p2.x + 11}
                    y={line.p2.y + 3.5}
                    textAnchor="start"
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#334155"
                    className="font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}
          </g>

          {/* SAND AXIS (Bottom Side: 0 at right to 100 at left) */}
          <g className="axis-sand">
            {/* Axis Title */}
            <text
              x={(geo.sandVertex.x + geo.siltVertex.x) / 2}
              y={geo.sandVertex.y + 40}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="#2A7C13"
              letterSpacing="0.08em"
            >
              {isMr ? "← वाळू SAND (%)" : "← SAND (%)"}
            </text>

            {/* Sand Ticks & Numbers (0 at right to 100 at left) */}
            {sandGrid.map((line) => {
              const val = line.value;
              return (
                <g key={`sand-tick-${val}`}>
                  <line
                    x1={line.p1.x}
                    y1={line.p1.y}
                    x2={line.p1.x}
                    y2={line.p1.y + 7}
                    stroke="#1C2B18"
                    strokeWidth="1.2"
                  />
                  <text
                    x={line.p1.x}
                    y={line.p1.y + 19}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#334155"
                    className="font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 7. Vertex Corner Callout Badges */}
          <g className="vertex-callouts pointer-events-none">
            {/* Clay 100% Apex */}
            <text
              x={geo.clayVertex.x}
              y={geo.clayVertex.y - 12}
              textAnchor="middle"
              fontSize="12.5"
              fontWeight="900"
              fill="#1C2B18"
            >
              100% {isMr ? "चिकणमाती" : "Clay"}
            </text>

            {/* Sand 100% Bottom-Left */}
            <text
              x={geo.sandVertex.x - 14}
              y={geo.sandVertex.y + 18}
              textAnchor="end"
              fontSize="11.5"
              fontWeight="900"
              fill="#1C2B18"
            >
              100% {isMr ? "वाळू" : "Sand"}
            </text>

            {/* Silt 100% Bottom-Right */}
            <text
              x={geo.siltVertex.x + 14}
              y={geo.siltVertex.y + 18}
              textAnchor="start"
              fontSize="11.5"
              fontWeight="900"
              fill="#1C2B18"
            >
              100% {isMr ? "गाळ" : "Silt"}
            </text>
          </g>

          {/* 8. Active Marker Projection Guidelines */}
          {guideLines && (
            <g className="guidelines pointer-events-none">
              {/* Clay Projection (Horizontal to left) */}
              <line
                x1={guideLines.clay.from.x}
                y1={guideLines.clay.from.y}
                x2={guideLines.clay.to.x}
                y2={guideLines.clay.to.y}
                stroke="#B45309"
                strokeWidth="1.6"
                strokeDasharray="4 3"
              />
              {/* Silt Projection (Parallel to left edge) */}
              <line
                x1={guideLines.silt.from.x}
                y1={guideLines.silt.from.y}
                x2={guideLines.silt.to.x}
                y2={guideLines.silt.to.y}
                stroke="#0284C7"
                strokeWidth="1.6"
                strokeDasharray="4 3"
              />
              {/* Sand Projection (Parallel to right edge) */}
              <line
                x1={guideLines.sand.from.x}
                y1={guideLines.sand.from.y}
                x2={guideLines.sand.to.x}
                y2={guideLines.sand.to.y}
                stroke="#16A34A"
                strokeWidth="1.6"
                strokeDasharray="4 3"
              />
            </g>
          )}

          {/* 9. Movable Sample Dot / Marker */}
          {markerPoint && (
            <g className="sample-marker pointer-events-none" transform={`translate(${markerPoint.x}, ${markerPoint.y})`}>
              {/* Pulsing outer aura ring */}
              <circle r="16" fill="#2A7C13" fillOpacity="0.22" className="animate-pulse" />
              {/* Secondary ring */}
              <circle r="10" fill="#2A7C13" fillOpacity="0.38" />
              {/* Solid prominent dot */}
              <circle
                r="6.5"
                fill="#2A7C13"
                stroke="#FFFFFF"
                strokeWidth="2.6"
                filter="url(#markerShadow)"
              />
            </g>
          )}
        </svg>

        {/* Live Hover Coordinate / Touch Feedback Badge */}
        {hoverComp && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-surface-border text-[11px] font-mono shadow-xs text-text-main flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-soil-primary animate-ping" />
            <span>
              Sand: <strong className="text-soil-primary font-bold">{hoverComp.sand}%</strong> | Silt:{" "}
              <strong className="text-sky-700 font-bold">{hoverComp.silt}%</strong> | Clay:{" "}
              <strong className="text-amber-800 font-bold">{hoverComp.clay}%</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
