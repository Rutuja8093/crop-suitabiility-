import fs from 'fs';

const targets = [
  'C:/Users/Pranav/Downloads/soil_pranav_updation-main/soil_pranav_updation-main/frontend/components/soilTexture/SoilTextureCalculator.tsx',
  'C:/Users/Pranav/Downloads/soilpilot_02-main (1)/soilpilot_02-main/frontend/components/soilTexture/SoilTextureCalculator.tsx',
  'C:/Users/Pranav/Downloads/SoilPilot_texturetriangle-main/SoilPilot_texturetriangle-main/frontend/components/soilTexture/SoilTextureCalculator.tsx'
];

// Read master source from soil_pranav_updation-main
const srcFile = targets[0];
if (!fs.existsSync(srcFile)) {
  console.error('Source file does not exist:', srcFile);
  process.exit(1);
}

let content = fs.readFileSync(srcFile, 'utf8');

// 1. Replace selectedGat useState initialization to be SSR-safe
const oldInitPattern = `  // Gat resolution from URL, local storage, auth context, or fallback "18"
  const [selectedGat, setSelectedGat] = useState<string>(() => {
    const validGats: string[] = [...KML_AVAILABLE_GATS];
    if (urlGat && validGats.includes(urlGat.replace(/[^\\d]/g, ""))) {
      return urlGat.replace(/[^\\d]/g, "");
    }
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("soilpilot_selected_gat");
      if (stored && validGats.includes(stored.replace(/[^\\d]/g, ""))) {
        return stored.replace(/[^\\d]/g, "");
      }
    }
    const fieldGat = field?.gat_no?.replace(/[^\\d]/g, "");
    if (fieldGat && validGats.includes(fieldGat)) return fieldGat;
    return "18";
  });`;

const newInitPattern = `  // SSR-safe Gat resolution: deterministic on both server and initial client render
  const [selectedGat, setSelectedGat] = useState<string>(() => {
    const validGats: string[] = [...KML_AVAILABLE_GATS];
    if (urlGat && validGats.includes(urlGat.replace(/[^\\d]/g, ""))) {
      return urlGat.replace(/[^\\d]/g, "");
    }
    const fieldGat = field?.gat_no?.replace(/[^\\d]/g, "");
    if (fieldGat && validGats.includes(fieldGat)) return fieldGat;
    return "18";
  });

  const [hasMounted, setHasMounted] = useState<boolean>(false);`;

if (content.includes(oldInitPattern)) {
  content = content.replace(oldInitPattern, newInitPattern);
  console.log('Replaced selectedGat initialization successfully.');
} else {
  console.log('Old init pattern not matched exactly, checking alternate...');
}

// 2. Replace useEffect syncing selectedGat
const oldSyncPattern = `  // Sync selectedGat with URL or auth
  useEffect(() => {
    if (urlGat) {
      const clean = urlGat.replace(/[^\\d]/g, "");
      if (clean && clean !== selectedGat) {
        setSelectedGat(clean);
        if (typeof window !== "undefined") {
          localStorage.setItem("soilpilot_selected_gat", clean);
        }
      }
    }
  }, [urlGat]);`;

const newSyncPattern = `  // Sync selectedGat with URL or auth and localStorage after mount (hydration safe)
  useEffect(() => {
    setHasMounted(true);
    const validGats: string[] = [...KML_AVAILABLE_GATS];
    if (urlGat) {
      const clean = urlGat.replace(/[^\\d]/g, "");
      if (clean && clean !== selectedGat && validGats.includes(clean)) {
        setSelectedGat(clean);
        try {
          localStorage.setItem("soilpilot_selected_gat", clean);
        } catch (_) {}
      }
    } else {
      try {
        const stored = localStorage.getItem("soilpilot_selected_gat");
        if (stored) {
          const clean = stored.replace(/[^\\d]/g, "");
          if (clean && clean !== selectedGat && validGats.includes(clean)) {
            setSelectedGat(clean);
          }
        }
      } catch (_) {}
    }
  }, [urlGat]);`;

if (content.includes(oldSyncPattern)) {
  content = content.replace(oldSyncPattern, newSyncPattern);
  console.log('Replaced sync pattern successfully.');
} else {
  console.log('Old sync pattern not matched exactly.');
}

// 3. Add suppressHydrationWarning to texture-gat-select
content = content.replace(
  'id="texture-gat-select"\n              value={selectedGat}',
  'id="texture-gat-select"\n              value={selectedGat}\n              suppressHydrationWarning'
);

// 4. Add suppressHydrationWarning to Sync Card Data span
content = content.replace(
  '<span>\n              {isMr ? `मृदा कार्ड सिंक करा (गट ${selectedGat})` : `Sync Card Data (Gat #${selectedGat})`}\n            </span>',
  '<span suppressHydrationWarning>\n              {isMr ? `मृदा कार्ड सिंक करा (गट ${selectedGat})` : `Sync Card Data (Gat #${selectedGat})`}\n            </span>'
);

// 5. Add suppressHydrationWarning to View Card link span
content = content.replace(
  '<span>{isMr ? "आरोग्य पत्रक पहा" : "View Card"}</span>',
  '<span suppressHydrationWarning>{isMr ? "आरोग्य पत्रक पहा" : "View Card"}</span>'
);

// 6. Write patched file to all targets
for (const target of targets) {
  try {
    fs.writeFileSync(target, content, 'utf8');
    console.log(`Updated ${target}`);
  } catch (err) {
    console.error(`Failed to update ${target}:`, err.message);
  }
}

console.log('Hydration fix applied across all workspaces!');
