/**
 * SoilPilot — USDA Soil Texture Data & Localization
 *
 * Rich metadata, color palettes, scientific descriptions, and Marathi
 * localization for all 12 USDA soil texture classes.
 */

import type { USDAClassKey } from './soilTextureClassification';

export interface SoilTextureClassMetadata {
  key: USDAClassKey;
  nameEn: string;
  nameMr: string;
  abbreviation: string;
  colorHex: string;
  colorBorder: string;
  colorDarkHex: string;
  descriptionEn: string;
  descriptionMr: string;
  managementEn: string;
  managementMr: string;
  drainageRate: 'Very Slow' | 'Slow' | 'Moderate' | 'Rapid' | 'Excessive';
  waterHoldingCapacity: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  typicalRange: string;
}

export const USDA_CLASS_METADATA: Record<USDAClassKey, SoilTextureClassMetadata> = {
  clay: {
    key: 'clay',
    nameEn: 'Clay',
    nameMr: 'चिकणमाती (काळी कसदार माती)',
    abbreviation: 'Clay',
    colorHex: '#D4A373',
    colorBorder: '#B88656',
    colorDarkHex: '#7F4F24',
    descriptionEn:
      'Fine-textured soil containing ≥40% clay particles. Characterized by high plasticity, heavy consistency, and high nutrient-adsorption capacity. Predominant in Maharashtra Deccan Vertisols.',
    descriptionMr:
      'किमान ४०% चिकण कणांचे प्रमाण असलेली बारीक पोताची माती. उच्च पाणी व पोषणद्रव्ये साठवण क्षमता. महाराष्ट्रातील दख्खन पठारावरील काळ्या कसदार जमिनीत आढळते.',
    managementEn:
      'Prone to waterlogging and swelling-shrinking cracks. Implement broad-bed furrow (BBF) drainage and cultivate at optimum moisture.',
    managementMr:
      'अति पावसात पाणी साचण्याची शक्यता; रुंद वरंबा-सरी (BBF) पद्धत वापरावी आणि जमीन ओलसर असताना योग्य वेळेत मशागत करावी.',
    drainageRate: 'Very Slow',
    waterHoldingCapacity: 'Very High',
    typicalRange: 'Clay ≥ 40%, Sand ≤ 45%, Silt < 40%',
  },
  silty_clay: {
    key: 'silty_clay',
    nameEn: 'Silty Clay',
    nameMr: 'गाळयुक्त चिकणमाती',
    abbreviation: 'SiCl',
    colorHex: '#CCD5AE',
    colorBorder: '#A9B58A',
    colorDarkHex: '#606C38',
    descriptionEn:
      'Fine-textured soil with high clay (≥40%) and high silt (≥40%). Holds considerable moisture and dissolved nutrients, with smooth physical tilth.',
    descriptionMr:
      'किमान ४०% चिकणमाती आणि किमान ४०% गाळ असलेली बारीक पोताची माती. मुबलक ओलावा आणि विरघळलेली अन्नद्रव्ये टिकवून ठेवते.',
    managementEn:
      'Maintain surface organic matter to prevent surface crusting and preserve soil aggregation under irrigation.',
    managementMr:
      'पाण्याचा योग्य वापर करावा; जमिनीवर पापुद्रा धरू नये म्हणून सेंद्रिय खतांचा व आच्छादनाचा वापर करावा.',
    drainageRate: 'Slow',
    waterHoldingCapacity: 'High',
    typicalRange: 'Clay ≥ 40%, Silt ≥ 40%, Sand ≤ 20%',
  },
  sandy_clay: {
    key: 'sandy_clay',
    nameEn: 'Sandy Clay',
    nameMr: 'वालुकामय चिकणमाती',
    abbreviation: 'SaCl',
    colorHex: '#E9EDC9',
    colorBorder: '#CCD59B',
    colorDarkHex: '#6B705C',
    descriptionEn:
      'Soil with ≥35% clay and ≥45% sand. Combines strong nutrient-binding power from clay with improved root-zone aeration from the sand fraction.',
    descriptionMr:
      'किमान ३५% चिकणमाती आणि किमान ४५% वाळू असलेली माती. चिकण कणांमुळे सुपीकता टिकते आणि वाळूमुळे मुळांना हवा खेळती राहते.',
    managementEn:
      'Well-suited for deep-rooted field crops; manage organic manure to enhance soil structure and reduce crusting.',
    managementMr:
      'खोल मुळे असणाऱ्या पिकांसाठी अनुकूल; जमिनीची सुपीकता व पोत टिकवण्यासाठी शेणखत व सेंद्रिय घटकांचा नियमित वापर करावा.',
    drainageRate: 'Slow',
    waterHoldingCapacity: 'High',
    typicalRange: 'Clay ≥ 35%, Sand ≥ 45%, Silt ≤ 20%',
  },
  clay_loam: {
    key: 'clay_loam',
    nameEn: 'Clay Loam',
    nameMr: 'चिकण दुमट माती',
    abbreviation: 'ClLo',
    colorHex: '#FAEDCD',
    colorBorder: '#DFCE9F',
    colorDarkHex: '#A68A56',
    descriptionEn:
      'Moderately fine soil with 27–40% clay and 20–45% sand. A resilient agricultural texture with favorable moisture retention and balanced workability.',
    descriptionMr:
      '२७ ते ४०% चिकणमाती आणि २० ते ४५% वाळू असलेली मध्यम पोताची माती. ओलावा टिकवून ठेवणारी आणि शेतीकामास अत्यंत योग्य अशी कसदार जमीन.',
    managementEn:
      'Highly productive across cereals, pulses, and sugarcane. Regular crop rotation and moderate tillage maintain optimal aggregation.',
    managementMr:
      'तृणधान्ये, कडधान्ये व ऊस पिकांसाठी अत्यंत फायदेशीर; पिकांची फेरपालट आणि वेळेवर मशागत करावी.',
    drainageRate: 'Moderate',
    waterHoldingCapacity: 'High',
    typicalRange: 'Clay 27–40%, Sand 20–45%, Silt 15–53%',
  },
  silty_clay_loam: {
    key: 'silty_clay_loam',
    nameEn: 'Silty Clay Loam',
    nameMr: 'गाळयुक्त चिकण दुमट माती',
    abbreviation: 'SiClLo',
    colorHex: '#D8E2DC',
    colorBorder: '#B0C2B6',
    colorDarkHex: '#52796F',
    descriptionEn:
      'Soil with 27–40% clay and <20% sand, dominated by silt. Excellent moisture-holding capacity with high cation exchange characteristics.',
    descriptionMr:
      '२७ ते ४०% चिकणमाती, २०% पेक्षा कमी वाळू आणि गाळाचे उच्च प्रमाण असणारी माती. पाणी धरून ठेवण्याची क्षमता उत्कृष्ट असते.',
    managementEn:
      'Avoid heavy machinery on wet fields to prevent compaction. Practice green manuring to sustain soil tilth.',
    managementMr:
      'जमीन ओली असताना जड यंत्रांचा वापर टाळावा जेणेकरून जमीन कडक होणार नाही; ताग/धैंचाचे हिरवळीचे खत वापरावे.',
    drainageRate: 'Slow',
    waterHoldingCapacity: 'High',
    typicalRange: 'Clay 27–40%, Sand < 20%, Silt 40–73%',
  },
  sandy_clay_loam: {
    key: 'sandy_clay_loam',
    nameEn: 'Sandy Clay Loam',
    nameMr: 'वालुकामय चिकण दुमट माती',
    abbreviation: 'SaClLo',
    colorHex: '#FFE5D9',
    colorBorder: '#E6BDB0',
    colorDarkHex: '#9D6B53',
    descriptionEn:
      'Soil with 20–35% clay, <28% silt, and ≥45% sand. Balances structural cohesion with reliable percolation and internal drainage.',
    descriptionMr:
      '२० ते ३५% चिकणमाती, २८% पेक्षा कमी गाळ आणि किमान ४५% वाळू असलेली जमीन. पाण्याचा चांगला निचरा आणि समाधानकारक पोषण क्षमता.',
    managementEn:
      'Warm and early to cultivate. Suitable for vegetables, cotton, and orchards with micro-irrigation.',
    managementMr:
      'भाजीपाला, कपाशी आणि फळबागांसाठी उत्तम; ठिबक सिंचनाचा वापर करून खतांचे योग्य व्यवस्थापन करावे.',
    drainageRate: 'Moderate',
    waterHoldingCapacity: 'Medium',
    typicalRange: 'Clay 20–35%, Silt < 28%, Sand ≥ 45%',
  },
  loam: {
    key: 'loam',
    nameEn: 'Loam',
    nameMr: 'दुमट माती (आदर्श कृषी पोत)',
    abbreviation: 'Loam',
    colorHex: '#C7E8AC',
    colorBorder: '#96C774',
    colorDarkHex: '#2A7C13',
    descriptionEn:
      'Balanced medium-textured soil (7–27% clay, 28–50% silt, 23–52% sand). Widely regarded as the benchmark agricultural soil for aeration and water balance.',
    descriptionMr:
      'वाळू, गाळ आणि चिकण कणांचे परिपूर्ण संतुलन (७-२७% चिकणमाती, २८-५०% गाळ, २३-५२% वाळू). शेतीसाठी सर्वात आदर्श मानली जाणारी सुपीक जमीन.',
    managementEn:
      'Universal cropping suitability. Maintain continuous organic matter return and balanced N-P-K fertilization.',
    managementMr:
      'सर्व प्रकारच्या पिकांसाठी सर्वोत्तम; सेंद्रिय घटकांचा नियमित पुरवठा व संतुलित खत व्यवस्थापन चालू ठेवावे.',
    drainageRate: 'Moderate',
    waterHoldingCapacity: 'High',
    typicalRange: 'Clay 7–27%, Silt 28–50%, Sand 23–52%',
  },
  silt_loam: {
    key: 'silt_loam',
    nameEn: 'Silt Loam',
    nameMr: 'गाळयुक्त दुमट माती',
    abbreviation: 'SiLo',
    colorHex: '#D8F3DC',
    colorBorder: '#A3D9AE',
    colorDarkHex: '#40916C',
    descriptionEn:
      'Smooth, floury-textured soil with ≥50% silt and 12–27% clay. Boasts exceptional plant-available water storage capacity in the root zone.',
    descriptionMr:
      'मऊ मखमली पोताची माती (किमान ५०% गाळ आणि १२-२७% चिकणमाती). पिकांना आवश्यक पाण्याचा साठा करण्यात अत्यंत कार्यक्षम.',
    managementEn:
      'High erosion potential on slopes. Employ contour bunding, cover crops, and minimum tillage practices.',
    managementMr:
      'उतारावर मातीची धूप होण्याची शक्यता असते; समपातळी बांध, आच्छादन पिके व कमी मशागतीचा अवलंब करावा.',
    drainageRate: 'Moderate',
    waterHoldingCapacity: 'Very High',
    typicalRange: 'Silt ≥ 50%, Clay 12–27% (or Silt 50–80% & Clay < 12%)',
  },
  silt: {
    key: 'silt',
    nameEn: 'Silt',
    nameMr: 'मऊ गाळ माती',
    abbreviation: 'Silt',
    colorHex: '#B7E4C7',
    colorBorder: '#74C69D',
    colorDarkHex: '#1B4332',
    descriptionEn:
      'Soil containing ≥80% silt and <12% clay. Velvety and non-plastic, prone to surface crusting after intense rainfall.',
    descriptionMr:
      'किमान ८०% गाळ आणि १२% पेक्षा कमी चिकणमाती असलेली अत्यंत बारीक माती. अति पावसानंतर जमिनीवर घट्ट पापुद्रा धरू शकतो.',
    managementEn:
      'Protect surface soil structure with residue mulching; apply light frequent irrigation to prevent seal formation.',
    managementMr:
      'जमिनीवर पापुद्रा धरू नये म्हणून भुसभुशीतपणा ठेवावा; आच्छादन करावे व हलके पाणी द्यावे.',
    drainageRate: 'Moderate',
    waterHoldingCapacity: 'High',
    typicalRange: 'Silt ≥ 80%, Clay < 12%',
  },
  sandy_loam: {
    key: 'sandy_loam',
    nameEn: 'Sandy Loam',
    nameMr: 'वालुकामय दुमट माती',
    abbreviation: 'SaLo',
    colorHex: '#FFF1C5',
    colorBorder: '#E5D08C',
    colorDarkHex: '#8C7326',
    descriptionEn:
      'Coarse-to-medium soil with 43–85% sand and <20% clay. Easily workable with excellent drainage and root penetration.',
    descriptionMr:
      '४३ ते ८५% वाळू आणि २०% पेक्षा कमी चिकणमाती असलेली हलकी ते मध्यम माती. मशागतीस सुलभ आणि मुळांच्या वाढीसाठी मोकळी जागा देणारी.',
    managementEn:
      'Higher fertilizer leaching risk. Split nitrogen applications and practice fertigation alongside FYM additions.',
    managementMr:
      'खते वाहून जाण्याचा धोका जास्त असतो; रासायनिक खतांचे हप्ते विभागून द्यावेत आणि शेणखताचा मुबलक वापर करावा.',
    drainageRate: 'Rapid',
    waterHoldingCapacity: 'Medium',
    typicalRange: 'Sand 43–85%, Clay < 20%, Silt < 50%',
  },
  loamy_sand: {
    key: 'loamy_sand',
    nameEn: 'Loamy Sand',
    nameMr: 'दुमट वाळू माती',
    abbreviation: 'LoSa',
    colorHex: '#FDE2B8',
    colorBorder: '#D8B57D',
    colorDarkHex: '#7C5318',
    descriptionEn:
      'Coarse soil with 70–90% sand and low binding clay/silt. Loose consistency with low moisture-holding capacity.',
    descriptionMr:
      '७० ते ९०% वाळू आणि अत्यल्प चिकणमाती असणारी हलकी जमीन. सैल रचना असून ओलावा फार काळ टिकत नाही.',
    managementEn:
      'Drip irrigation is essential. Frequent fertigation, organic mulching, and green manure build organic matter.',
    managementMr:
      'ठिबक सिंचन अत्यंत गरजेचे; वारंवार पाणी व खते देणे आणि हिरवळीच्या खतांनी सेंद्रिय कर्ब वाढवणे आवश्यक.',
    drainageRate: 'Rapid',
    waterHoldingCapacity: 'Low',
    typicalRange: 'Sand 70–90%, Silt + 1.5×Clay ≥ 15% & Silt + 2×Clay < 30%',
  },
  sand: {
    key: 'sand',
    nameEn: 'Sand',
    nameMr: 'वाळू / रेती',
    abbreviation: 'Sand',
    colorHex: '#F5D6A7',
    colorBorder: '#CCA56E',
    colorDarkHex: '#6D4917',
    descriptionEn:
      'Very coarse soil with ≥85% sand particles. Loose, non-cohesive matrix with rapid percolation and low nutrient retention.',
    descriptionMr:
      'किमान ८५% वाळू असणारी अतिहलकी जमीन. कण एकमेकांना चिकटून राहत नाहीत; पाणी व खते तात्काळ पाझरतात.',
    managementEn:
      'High risk of drought and nutrient loss. Incorporate bulky organic compost, biochar, and consider drought-hardy crops.',
    managementMr:
      'ओलावा व खते टिकत नाहीत; मोठ्या प्रमाणावर कंपोस्ट खत, शेणखत मिसळावे आणि कमी पाण्याच्या पिकांची निवड करावी.',
    drainageRate: 'Excessive',
    waterHoldingCapacity: 'Very Low',
    typicalRange: 'Sand ≥ 85%, Silt + 1.5×Clay < 15%',
  },
};

/** Realistic soil composition presets for farmers to test */
export interface SoilPreset {
  id: string;
  nameEn: string;
  nameMr: string;
  sand: number;
  silt: number;
  clay: number;
  sourceLabel: string;
  badge: string;
}

export const SAMPLE_SOIL_PRESETS: SoilPreset[] = [
  {
    id: 'baramati_vertisol',
    nameEn: 'Malegaon Kh / Baramati Vertisol',
    nameMr: 'माळेगाव खुर्द / बारामती काळी जमीन',
    sand: 32,
    silt: 29,
    clay: 39,
    sourceLabel: 'DSM Root-Zone Standardized (0–30 cm)',
    badge: 'Local Soil',
  },
  {
    id: 'ideal_loam',
    nameEn: 'Balanced Agricultural Loam',
    nameMr: 'संतुलित कृषी दुमट माती',
    sand: 40,
    silt: 40,
    clay: 20,
    sourceLabel: 'USDA Standard Reference Sample',
    badge: 'Benchmark',
  },
  {
    id: 'clay_vertisol',
    nameEn: 'Heavy Black Cotton Clay',
    nameMr: 'भारी काळी कसदार चिकणमाती',
    sand: 20,
    silt: 25,
    clay: 55,
    sourceLabel: 'Deccan Deep Vertisol Lab Profile',
    badge: 'Heavy Clay',
  },
  {
    id: 'alluvial_silt_loam',
    nameEn: 'Riverine Alluvial Silt Loam',
    nameMr: 'नदीकाठची सुपीक गाळ माती',
    sand: 18,
    silt: 65,
    clay: 17,
    sourceLabel: 'Krishna-Bhima Basin Alluvial Survey',
    badge: 'Alluvial',
  },
  {
    id: 'coastal_sandy_loam',
    nameEn: 'Coarse Sandy Loam',
    nameMr: 'हलकी वालुकामय दुमट जमीन',
    sand: 65,
    silt: 25,
    clay: 10,
    sourceLabel: 'Lateritic Red Loam Topsoil',
    badge: 'Sandy Loam',
  },
];
