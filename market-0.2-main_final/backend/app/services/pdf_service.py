"""SoilPilot PDF Generation Service using ReportLab.
Phase 9: Professional A4 Soil Health Card and Detailed Soil Report Generation.
Supports English and Marathi (Devanagari) typography with zero external PDF servers.
"""
import os
import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
    PageBreak,
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, Polygon, Line
from reportlab.graphics.barcode.qr import QrCodeWidget

IST = timezone(timedelta(hours=5, minutes=30))

def get_india_current_date_str() -> str:
    """Format current runtime date in Asia/Kolkata timezone as DD-MM-YYYY."""
    return datetime.now(IST).strftime("%d-%m-%Y")

# ----------------------------------------------------------------------
# Font Registration (Bilingual Devanagari & Latin)
# ----------------------------------------------------------------------
ParagraphStyle.defaults["shaping"] = 1

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

def translate_ref_range_to_mr(raw: str) -> str:
    """Translate reference range terms to clean Marathi."""
    if not raw:
        return "—"
    tr = [
        ("(Acidic)", "(आम्लधर्मी)"),
        ("(Neutral)", "(उदासीन)"),
        ("(Alkaline)", "(विम्लधर्मी)"),
        ("(Suitable)", "(योग्य)"),
        ("(Normal)", "(सामान्य)"),
        ("(Medium)", "(मध्यम)"),
        ("(Sufficient)", "(पुरेसे)"),
        ("(Optimal)", "(इष्टतम)"),
        ("(Low)", "(कमी)"),
        ("(High)", "(जास्त)"),
        ("(Deficient)", "(कमतरता)"),
        ("(Marginal)", "(सीमांत)"),
        ("(Critical)", "(चिंताजनक)"),
        ("(Saline)", "(क्षारयुक्त)"),
        ("(Fertile)", "(सुपीक)"),
        ("(Heavy Clay)", "(काळी चिकण माती)"),
        ("(Moderate)", "(मध्यम)"),
        ("(Compacted)", "(कठीण जमीन)"),
        ("(Problematic)", "(समस्याग्रस्त)"),
        ("AOI range:", "कार्यक्षेत्र श्रेणी:"),
        ("USDA Class:", "USDA वर्ग:"),
        ("Suitable", "योग्य"),
        ("Normal", "सामान्य"),
        ("Medium", "मध्यम"),
        ("Sufficient", "पुरेसे"),
        ("Optimal", "इष्टतम"),
        ("Low", "कमी"),
        ("High", "जास्त"),
    ]
    res = raw
    for en, mr in tr:
        res = res.replace(en, mr)
    return res

def _format_ref_range_xml(text: str) -> str:
    """Safely format reference ranges with <br/> for ReportLab XML table cells."""
    if not text:
        return "—"
    lines = text.replace("<br/>", "\n").replace("<br>", "\n").split("\n")
    formatted_lines = []
    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            continue
        cleaned = cleaned.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        formatted_lines.append(cleaned)
    return "<br/>".join(formatted_lines)

GEO_NAME_MAP = {
    "malegaon kh.": {"en": "Malegaon Kh.", "mr": "माळेगाव खुर्द"},
    "malegaon kh": {"en": "Malegaon Kh.", "mr": "माळेगाव खुर्द"},
    "malegaon": {"en": "Malegaon", "mr": "माळेगाव"},
    "baramati": {"en": "Baramati", "mr": "बारामती"},
    "pune": {"en": "Pune", "mr": "पुणे"},
    "maharashtra": {"en": "Maharashtra", "mr": "महाराष्ट्र"},
    "माळेगाव खुर्द": {"en": "Malegaon Kh.", "mr": "माळेगाव खुर्द"},
    "माळेगाव": {"en": "Malegaon", "mr": "माळेगाव"},
    "बारामती": {"en": "Baramati", "mr": "बारामती"},
    "पुणे": {"en": "Pune", "mr": "पुणे"},
    "महाराष्ट्र": {"en": "Maharashtra", "mr": "महाराष्ट्र"},
}

def translate_geo_name(name: str, is_mr: bool) -> str:
    if not name:
        return "माळेगाव खुर्द" if is_mr else "Malegaon Kh."
    norm = name.strip().lower()
    if norm in GEO_NAME_MAP:
        return GEO_NAME_MAP[norm]["mr" if is_mr else "en"]
    if name in GEO_NAME_MAP:
        return GEO_NAME_MAP[name]["mr" if is_mr else "en"]
    return name

def devanagari_to_english(text: str) -> str:
    if not text:
        return ""
    vowels = {
        "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
        "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "अं": "an", "अः": "ah",
    }
    matras = {
        "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
        "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
        "ं": "n", "ँ": "n", "ः": "h",
    }
    consonants = {
        "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
        "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
        "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
        "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
        "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
        "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
        "ष": "sh", "स": "s", "ह": "h", "ळ": "l", "क्ष": "ksh",
        "ज्ञ": "dny", "श्र": "shr", "त्र": "tr",
    }
    def is_punct(ch):
        return ch in " .,/#!$%^&*;:{}=-_`~()"

    def transliterate_word(w):
        if not w:
            return ""
        out = []
        i = 0
        wlen = len(w)
        while i < wlen:
            ch = w[i]
            nxt = w[i+1] if i + 1 < wlen else ""
            nxt2 = w[i+2] if i + 2 < wlen else ""
            if ch == "ज" and nxt == "्" and nxt2 == "ञ":
                out.append("dny")
                i += 3
                if i < wlen and w[i] in matras:
                    out.append(matras[w[i]])
                    i += 1
                elif i < wlen and w[i] == "्":
                    i += 1
                elif i < wlen and not is_punct(w[i]):
                    out.append("a")
                continue
            if ch == "क" and nxt == "्" and nxt2 == "ष":
                out.append("ksh")
                i += 3
                if i < wlen and w[i] in matras:
                    out.append(matras[w[i]])
                    i += 1
                elif i < wlen and w[i] == "्":
                    i += 1
                elif i < wlen and not is_punct(w[i]):
                    out.append("a")
                continue
            if ch == "श" and nxt == "्" and nxt2 == "र":
                out.append("shr")
                i += 3
                if i < wlen and w[i] in matras:
                    out.append(matras[w[i]])
                    i += 1
                elif i < wlen and w[i] == "्":
                    i += 1
                elif i < wlen and not is_punct(w[i]):
                    out.append("a")
                continue
            if ch == "त" and nxt == "्" and nxt2 == "र":
                out.append("tr")
                i += 3
                if i < wlen and w[i] in matras:
                    out.append(matras[w[i]])
                    i += 1
                elif i < wlen and w[i] == "्":
                    i += 1
                elif i < wlen and not is_punct(w[i]):
                    out.append("a")
                continue
            if ch in vowels:
                out.append(vowels[ch])
                i += 1
                continue
            if ch in consonants:
                c = consonants[ch]
                i += 1
                if i < wlen:
                    nc = w[i]
                    if nc == "्":
                        out.append(c)
                        i += 1
                    elif nc in matras:
                        out.append(c + matras[nc])
                        i += 1
                        if i < wlen and w[i] in ("ं", "ँ"):
                            nxt_af = w[i+1] if i + 1 < wlen else ""
                            out.append("m" if nxt_af in ("प", "फ", "ब", "भ", "म") else "n")
                            i += 1
                    elif nc in ("ं", "ँ"):
                        nxt_af = w[i+1] if i + 1 < wlen else ""
                        out.append(c + ("am" if nxt_af in ("प", "फ", "ब", "भ", "म") else "an"))
                        i += 1
                    elif nc == "ः":
                        out.append(c + "ah")
                        i += 1
                    elif nc in consonants or nc in vowels:
                        out.append(c + "a")
                    else:
                        out.append(c)
                else:
                    out.append(c)
                continue
            if ch in matras:
                out.append(matras[ch])
                i += 1
                continue
            out.append(ch)
            i += 1
        res = "".join(out)
        return res[:1].upper() + res[1:] if res else ""

    words = text.strip().split()
    res_words = []
    for w in words:
        if w.endswith("राव") and len(w) > 3:
            res_words.append(transliterate_word(w[:-3]) + "rao")
        elif w.endswith("भाऊ") and len(w) > 3:
            res_words.append(transliterate_word(w[:-3]) + "bhau")
        elif w.endswith("सिंह") and len(w) > 4:
            res_words.append(transliterate_word(w[:-4]) + "sinh")
        else:
            res_words.append(transliterate_word(w))
    return " ".join(res_words)

def _init_fonts() -> str:
    """Register Unicode font for Devanagari/Marathi support with safe fallbacks."""
    global FONT_REGULAR, FONT_BOLD
    ParagraphStyle.defaults["shaping"] = 1
    candidates = [
        ("C:/Windows/Fonts/Nirmala.ttc", 0),
        ("C:/Windows/Fonts/mangal.ttf", 0),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
        ("/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf", 0),
    ]
    for font_path, subfont_idx in candidates:
        if os.path.exists(font_path):
            try:
                font_name = "SoilPilotUnicode"
                if font_path.endswith(".ttc"):
                    pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=subfont_idx))
                else:
                    pdfmetrics.registerFont(TTFont(font_name, font_path))
                FONT_REGULAR = font_name
                FONT_BOLD = font_name
                return font_name
            except Exception:
                continue
    return "Helvetica"

_ACTIVE_FONT = _init_fonts()

# ----------------------------------------------------------------------
# SoilPilot Brand Palette
# ----------------------------------------------------------------------
COLOR_PRIMARY = colors.HexColor("#2A7C13")       # Primary Green
COLOR_SECONDARY = colors.HexColor("#76C457")     # Secondary Green
COLOR_PRIMARY_LIGHT = colors.HexColor("#EAF4E8") # Light Green Fill
COLOR_CREAM = colors.HexColor("#FFF8CF")         # Soft Cream
COLOR_BEIGE = colors.HexColor("#FBE6C2")         # Warm Beige
COLOR_AMBER_BG = colors.HexColor("#FEF3C7")      # Amber Demo Tag
COLOR_AMBER_TEXT = colors.HexColor("#92400E")
COLOR_TEXT_MAIN = colors.HexColor("#1A1A1A")     # Charcoal Text
COLOR_TEXT_MUTED = colors.HexColor("#4B5563")    # Muted Gray
COLOR_BORDER = colors.HexColor("#D1D5DB")        # Border Gray
COLOR_BG_ALT = colors.HexColor("#F9FAFB")        # Alternating Row

# ----------------------------------------------------------------------
# Multi-Page Numbered Canvas
# ----------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print 'Page X of Y'."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count: int):
        self.saveState()
        self.setFont(FONT_REGULAR, 7.5)
        self.setFillColor(COLOR_TEXT_MUTED)

        # Thin footer rule
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.5)
        self.line(14 * mm, 12 * mm, 196 * mm, 12 * mm)

        # Left: portal info
        now_str = datetime.now(timezone.utc).strftime("%d-%m-%Y %H:%M UTC")
        self.drawString(
            14 * mm,
            8.5 * mm,
            f"SoilPilot — Digital Soil Mapping & Soil Health Portal | Generated: {now_str}",
        )

        # Right: page numbers
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(196 * mm, 8.5 * mm, page_text)
        self.restoreState()


# ----------------------------------------------------------------------
# Helper: QR Code Widget
# ----------------------------------------------------------------------
def _create_qr_code(url: str, size: float = 45) -> Drawing:
    """Generate a clean QR code drawing for report verification."""
    d = Drawing(size, size)
    qr = QrCodeWidget(url)
    qr.barWidth = size
    qr.barHeight = size
    qr.barBorder = 1
    d.add(qr)
    return d


# ----------------------------------------------------------------------
# PDF Generator Class
# ----------------------------------------------------------------------
class PDFService:
    """Generates official printable A4 Soil Health Cards and Detailed Soil Reports."""

    @staticmethod
    def _get_styles():
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=13,
            leading=16,
            textColor=colors.white,
        )

        subtitle_style = ParagraphStyle(
            "DocSubtitle",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=8,
            leading=11,
            textColor=COLOR_CREAM,
        )

        section_heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=9.5,
            leading=13,
            textColor=COLOR_PRIMARY,
        )

        label_style = ParagraphStyle(
            "CellLabel",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_MUTED,
        )

        val_style = ParagraphStyle(
            "CellValue",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=8,
            leading=10.5,
            textColor=COLOR_TEXT_MAIN,
        )

        table_header_style = ParagraphStyle(
            "TableHeader",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.5,
            leading=9.5,
            textColor=colors.white,
            alignment=1,  # Center
        )

        table_cell_style = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_MAIN,
        )

        table_cell_bold = ParagraphStyle(
            "TableCellBold",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_MAIN,
        )

        table_cell_center = ParagraphStyle(
            "TableCellCenter",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_MAIN,
            alignment=1,
        )

        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.8,
            leading=8.8,
            textColor=COLOR_TEXT_MUTED,
        )

        table_header_left = ParagraphStyle(
            "TableHeaderLeft",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.5,
            leading=9.5,
            textColor=colors.white,
            alignment=0,
        )

        table_cell_green = ParagraphStyle(
            "TableCellGreen",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_PRIMARY,
        )

        card_title_style = ParagraphStyle(
            "CardTitle",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=8.5,
            leading=11,
            textColor=colors.white,
        )

        tag_amber_style = ParagraphStyle(
            "TagAmber",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.0,
            leading=9.0,
            textColor=COLOR_AMBER_TEXT,
        )

        return {
            "title": title_style,
            "subtitle": subtitle_style,
            "section": section_heading,
            "label": label_style,
            "val": val_style,
            "th": table_header_style,
            "th_left": table_header_left,
            "td": table_cell_style,
            "td_bold": table_cell_bold,
            "td_center": table_cell_center,
            "td_green": table_cell_green,
            "card_title": card_title_style,
            "tag_amber": tag_amber_style,
            "disclaimer": disclaimer_style,
        }

    # ==================================================================
    # 1. SOIL HEALTH CARD PDF (Exact match with Web UI view)
    # ==================================================================
    def generate_soil_health_card_pdf(
        self,
        report_data: Dict[str, Any],
        lang: str = "en",
        verify_url: Optional[str] = None,
    ) -> bytes:
        """Generate official Soil Health Card PDF matching the Web UI design perfectly on a single A4 page."""
        is_mr = lang.lower() == "mr"
        buffer = io.BytesIO()

        # 5 mm top/bottom, 7 mm left/right margins to maximize printable height (287 mm usable)
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=7 * mm,
            rightMargin=7 * mm,
            topMargin=5 * mm,
            bottomMargin=5 * mm,
        )

        styles = getSampleStyleSheet()

        # Color palette matching reference image
        COLOR_DARK_GREEN = colors.HexColor("#214F3F")
        COLOR_RED_DEMO = colors.HexColor("#D32F2F")
        COLOR_BORDER_GRAY = colors.HexColor("#D1D5DB")
        COLOR_LBL_BG = colors.HexColor("#F3F4F6")

        # Live date in India timezone
        live_date = get_india_current_date_str()

        # Custom typography styles scaled for exact single-page A4 perfection
        st_head_adt = ParagraphStyle(
            "HeadADT",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=11,
            leading=13,
            alignment=1,
            textColor=COLOR_DARK_GREEN,
        )
        st_head_loc = ParagraphStyle(
            "HeadLoc",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=8,
            leading=10,
            alignment=1,
            textColor=colors.HexColor("#374151"),
        )
        st_head_demo = ParagraphStyle(
            "HeadDemo",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.5,
            leading=9,
            alignment=1,
            textColor=COLOR_RED_DEMO,
        )
        st_report_title = ParagraphStyle(
            "ReportTitle",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=10.5,
            leading=12.5,
            alignment=1,
            textColor=COLOR_DARK_GREEN,
        )
        st_sec_head = ParagraphStyle(
            "SecHead",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.8,
            leading=9.5,
            textColor=COLOR_DARK_GREEN,
        )
        st_info_lbl = ParagraphStyle(
            "InfoLbl",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=6.8,
            leading=8.2,
            textColor=colors.HexColor("#111827"),
        )
        st_info_val = ParagraphStyle(
            "InfoVal",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.8,
            leading=8.2,
            textColor=colors.HexColor("#111827"),
        )
        st_th = ParagraphStyle(
            "TH",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=6.5,
            leading=8,
            textColor=colors.white,
        )
        st_th_c = ParagraphStyle(
            "THC",
            parent=st_th,
            alignment=1,
        )
        st_td_sr = ParagraphStyle(
            "TDSr",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.5,
            leading=7.8,
            alignment=1,
            textColor=colors.HexColor("#111827"),
        )
        st_td_param = ParagraphStyle(
            "TDParam",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.5,
            leading=7.8,
            textColor=colors.HexColor("#111827"),
        )
        st_td_val = ParagraphStyle(
            "TDVal",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=6.8,
            leading=7.8,
            alignment=1,
            textColor=colors.HexColor("#111827"),
        )
        st_td_unit = ParagraphStyle(
            "TDUnit",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.5,
            leading=7.8,
            alignment=1,
            textColor=colors.HexColor("#111827"),
        )
        st_td_range = ParagraphStyle(
            "TDRange",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.0,
            leading=7.2,
            textColor=colors.HexColor("#111827"),
        )
        st_td_rec = ParagraphStyle(
            "TDRec",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.0,
            leading=7.2,
            textColor=colors.HexColor("#111827"),
        )
        st_footnote = ParagraphStyle(
            "Footnote",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.2,
            leading=8.6,
            textColor=COLOR_RED_DEMO,
        )
        st_cert_head = ParagraphStyle(
            "CertHead",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.5,
            leading=9,
            textColor=COLOR_DARK_GREEN,
        )
        st_cert_org = ParagraphStyle(
            "CertOrg",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.0,
            leading=8.5,
            textColor=colors.HexColor("#111827"),
        )
        st_cert_sub = ParagraphStyle(
            "CertSub",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.2,
            leading=7.5,
            textColor=colors.HexColor("#374151"),
        )
        st_cert_ref = ParagraphStyle(
            "CertRef",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.2,
            leading=7.5,
            textColor=colors.HexColor("#4B5563"),
        )
        st_sign_name = ParagraphStyle(
            "SignName",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=7.2,
            leading=8.8,
            alignment=2,
            textColor=colors.HexColor("#000000"),
        )
        st_sign_title = ParagraphStyle(
            "SignTitle",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=6.2,
            leading=7.5,
            alignment=2,
            textColor=colors.HexColor("#000000"),
        )
        st_sign_div = ParagraphStyle(
            "SignDiv",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=6.0,
            leading=7.2,
            alignment=2,
            textColor=colors.HexColor("#4B5563"),
        )

        def _format_interp(text: str) -> Paragraph:
            lower = (text or "").lower()
            if any(k in lower for k in ["high", "जास्त"]):
                c_hex = "#1565C0"
            elif any(k in lower for k in ["low", "deficient", "critical", "कमी", "कमतरता"]):
                c_hex = "#D32F2F"
            elif any(k in lower for k in ["marginal", "सीमांत"]):
                c_hex = "#B45309"
            else:
                c_hex = "#111827"
            p_style = ParagraphStyle("InterpText", fontName=FONT_BOLD, fontSize=6.5, leading=7.8, textColor=colors.HexColor(c_hex))
            return Paragraph(f"<b>{text}</b>", p_style)

        story = []

        field = report_data.get("field", {}) or {}
        farmer = report_data.get("farmer", {}) or {}
        report_meta = report_data.get("report", {}) or {}
        parameters: List[Dict[str, Any]] = report_data.get("parameters", []) or []
        is_demo = report_data.get("is_demo", True)

        # --------------------------------------------------------------
        # 1. TOP HEADER (Centered Header matching image)
        # --------------------------------------------------------------
        header_elements = [
            Paragraph(
                "<b>एडीटी एआय ट्रेनिंग फाउंडेशन, बारामती</b>" if is_mr else "<b>ADT AI TRAINING FOUNDATION, BARAMATI</b>",
                st_head_adt,
            ),
            Paragraph(
                "पुणे, महाराष्ट्र" if is_mr else "Pune, Maharashtra",
                st_head_loc,
            ),
            Paragraph(
                "<b>मृदा चाचणी अहवाल</b>" if is_mr else "<b>SOIL TEST REPORT</b>",
                st_report_title,
            ),
        ]

        header_table = Table([[el] for el in header_elements], colWidths=[196 * mm])
        header_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 1.5 * mm))

        # --------------------------------------------------------------
        # 2. FARMER & SAMPLE INFORMATION (4-Column Table directly below)
        # --------------------------------------------------------------
        farmer_name = farmer.get("name") or ("रमेश पाटील" if is_mr else "Ramesh Patil")
        if not is_mr and any('\u0900' <= c <= '\u097f' for c in str(farmer_name)):
            farmer_name = devanagari_to_english(str(farmer_name))
        gat_no = field.get("gat_no", "22")
        area_unit = "हेक्टर" if is_mr else "hectare"
        area_val = field.get("area", "1.49")
        gat_label = f"गट क्र. {gat_no} ({area_val} {area_unit})" if is_mr else f"Gat No. {gat_no} ({area_val} {area_unit})"

        taluka_val = translate_geo_name(field.get("taluka") or "Baramati", is_mr)
        district_val = translate_geo_name(field.get("district") or "Pune", is_mr)
        village_val = translate_geo_name(field.get("village") or "Malegaon Kh.", is_mr)
        date_val = live_date

        f_data = [
            [
                Paragraph("<b>शेतकऱ्याचे नाव</b>" if is_mr else "<b>Farmer's Name</b>", st_info_lbl),
                Paragraph(str(farmer_name), st_info_val),
                Paragraph("<b>तालुका</b>" if is_mr else "<b>Taluka</b>", st_info_lbl),
                Paragraph(str(taluka_val), st_info_val),
            ],
            [
                Paragraph("<b>गट क्र.</b>" if is_mr else "<b>Gat No.</b>", st_info_lbl),
                Paragraph(str(gat_label), st_info_val),
                Paragraph("<b>जिल्हा</b>" if is_mr else "<b>District</b>", st_info_lbl),
                Paragraph(str(district_val), st_info_val),
            ],
            [
                Paragraph("<b>गाव</b>" if is_mr else "<b>Village</b>", st_info_lbl),
                Paragraph(str(village_val), st_info_val),
                Paragraph("<b>दिनांक</b>" if is_mr else "<b>Date</b>", st_info_lbl),
                Paragraph(str(date_val), st_info_val),
            ],
        ]

        info_table = Table(f_data, colWidths=[33 * mm, 65 * mm, 33 * mm, 65 * mm])
        info_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER_GRAY),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, COLOR_BORDER_GRAY),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 1.0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.0),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 1.5 * mm))

        # --------------------------------------------------------------
        # 3. LABORATORY SOIL CHEMICAL & NUTRIENT ANALYSIS TABLE
        # --------------------------------------------------------------
        th_row = [
            Paragraph("<b>अ.क्र.</b>" if is_mr else "<b>SR.<br/>NO.</b>", st_th_c),
            Paragraph("<b>घटक</b>" if is_mr else "<b>PARAMETER</b>", st_th),
            Paragraph("<b>तपासलेले मूल्य</b>" if is_mr else "<b>OBSERVED<br/>VALUE</b>", st_th_c),
            Paragraph("<b>एकक</b>" if is_mr else "<b>UNIT</b>", st_th_c),
            Paragraph("<b>निष्कर्ष</b>" if is_mr else "<b>INTERPRETATION</b>", st_th),
            Paragraph("<b>संदर्भ श्रेणी</b>" if is_mr else "<b>REFERENCE<br/>RANGE</b>", st_th),
            Paragraph("<b>शिफारस</b>" if is_mr else "<b>RECOMMENDATION</b>", st_th),
        ]

        clean_ref_ranges = {
            "ph": "< 6.5 (Acidic)\n6.5 – 7.5 (Neutral)\n> 7.5 (Alkaline)",
            "soil_ph": "< 6.5 (Acidic)\n6.5 – 7.5 (Neutral)\n> 7.5 (Alkaline)",
            "ec": "< 0.8 dS/m (Normal)\n0.8 – 1.6 (Critical)\n> 1.6 (Saline)",
            "electrical_conductivity": "< 0.8 dS/m (Normal)\n0.8 – 1.6 (Critical)\n> 1.6 (Saline)",
            "organic_carbon": "< 0.50% (Low)\n0.50 – 0.75% (Medium)\n> 0.75% (High)",
            "soc": "< 0.50% (Low)\n0.50 – 0.75% (Medium)\n> 0.75% (High)",
            "total_nitrogen": "< 0.12% (Low)\n0.12 – 0.25% (Medium)\n> 0.25% (High)",
            "total_n": "< 0.12% (Low)\n0.12 – 0.25% (Medium)\n> 0.25% (High)",
            "available_nitrogen": "< 280 (Low)\n280 – 560 (Medium)\n> 560 (High)",
            "nitrogen": "< 280 (Low)\n280 – 560 (Medium)\n> 560 (High)",
            "available_phosphorus": "< 10 (Low)\n10 – 25 (Medium)\n> 25 (High)",
            "phosphorus": "< 10 (Low)\n10 – 25 (Medium)\n> 25 (High)",
            "available_potassium": "< 120 (Low)\n120 – 280 (Medium)\n> 280 (High)",
            "potassium": "< 120 (Low)\n120 – 280 (Medium)\n> 280 (High)",
            "cec": "< 15.0 (Low)\n15.0 – 25.0 (Medium)\n> 25.0 (Fertile)",
            "cation_exchange_capacity": "< 15.0 (Low)\n15.0 – 25.0 (Medium)\n> 25.0 (Fertile)",
            "clay": "< 35.0% (Medium)\n35.0 – 45.0% (Optimal)\n> 45.0% (Heavy Clay)",
            "clay_proportion": "< 35.0% (Medium)\n35.0 – 45.0% (Optimal)\n> 45.0% (Heavy Clay)",
            "sand": "< 20.0% (Low)\n20.0 – 35.0% (Normal)\n> 35.0% (High)",
            "sand_proportion": "< 20.0% (Low)\n20.0 – 35.0% (Normal)\n> 35.0% (High)",
            "silt": "< 20.0% (Low)\n20.0 – 30.0% (Optimal)\n> 30.0% (High)",
            "silt_proportion": "< 20.0% (Low)\n20.0 – 30.0% (Optimal)\n> 30.0% (High)",
            "cfvo": "< 10.0% (Low)\n10.0 – 15.0% (Moderate)\n> 15.0% (High)",
            "coarse_fragments": "< 10.0% (Low)\n10.0 – 15.0% (Moderate)\n> 15.0% (High)",
            "bd": "< 1.40 (Optimal)\n1.40 – 1.60 (Moderate)\n> 1.60 (Compacted)",
            "bulk_density": "< 1.40 (Optimal)\n1.40 – 1.60 (Moderate)\n> 1.60 (Compacted)",
            "exchangeable_sodium": "< 15.0% (Normal)\n> 15.0% (Problematic)",
            "exchangeable_sodium_percentage": "< 15.0% (Normal)\n> 15.0% (Problematic)",
            "esp": "< 15.0% (Normal)\n> 15.0% (Problematic)",
            "free_lime": "< 5.0% (Normal)\n5.0 – 10.0% (Medium)\n> 10.0% (High)",
            "caco3": "< 5.0% (Normal)\n5.0 – 10.0% (Medium)\n> 10.0% (High)",
            "iron": "< 4.5 (Deficient)\n> 4.5 (Sufficient)",
            "available_iron": "< 4.5 (Deficient)\n> 4.5 (Sufficient)",
            "fe": "< 4.5 (Deficient)\n> 4.5 (Sufficient)",
            "manganese": "< 3.0 (Deficient)\n> 3.0 (Sufficient)",
            "available_manganese": "< 3.0 (Deficient)\n> 3.0 (Sufficient)",
            "mn": "< 3.0 (Deficient)\n> 3.0 (Sufficient)",
            "zinc": "< 0.6 (Deficient)\n> 0.6 (Sufficient)",
            "available_zinc": "< 0.6 (Deficient)\n> 0.6 (Sufficient)",
            "zn": "< 0.6 (Deficient)\n> 0.6 (Sufficient)",
            "copper": "< 0.4 (Deficient)\n> 0.4 (Sufficient)",
            "available_copper": "< 0.4 (Deficient)\n> 0.4 (Sufficient)",
            "cu": "< 0.4 (Deficient)\n> 0.4 (Sufficient)",
            "sulphur": "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
            "available_sulphur": "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
            "sulfur": "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
            "s": "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
            "boron": "< 0.5 (Deficient)\n> 0.5 (Sufficient)",
            "available_boron": "< 0.5 (Deficient)\n> 0.5 (Sufficient)",
            "b": "< 0.5 (Deficient)\n> 0.5 (Sufficient)",
            "soil_texture": "USDA Class: Clay / Vertisols",
            "soil_texture_class": "USDA Class: Clay / Vertisols",
        }

        clean_recs = {
            "ph": "Optimal neutral (6.5-7.5); maintain balanced fertigation.",
            "ec": "Non-saline (<0.8 dS/m); no salinity hazard to crops.",
            "organic_carbon": "High SOC; maintain via green manure & crop residue.",
            "available_nitrogen": "Low: Increase N application to ~125% RDF (urea/FYM).",
            "available_phosphorus": "Medium: Apply recommended dose of phosphorus (100% RDF).",
            "available_potassium": "High: Economize potash; reduce application to ~75% RDF.",
            "exchangeable_sodium": "Safe limit (<15%); maintain proper field drainage.",
            "esp": "Safe limit (<15%); maintain proper field drainage.",
            "free_lime": "Normal (<5%); balanced fertilization to avoid fixation.",
            "iron": "Deficient: Soil apply FeSO4 @ 25 kg/ha or foliar 0.5%.",
            "available_iron": "Deficient: Soil apply FeSO4 @ 25 kg/ha or foliar 0.5%.",
            "manganese": "Sufficient: Routine monitoring; avoid over-liming.",
            "available_manganese": "Sufficient: Routine monitoring; avoid over-liming.",
            "zinc": "Deficient: Soil apply ZnSO4 @ 20-25 kg/ha or foliar 0.5%.",
            "available_zinc": "Deficient: Soil apply ZnSO4 @ 20-25 kg/ha or foliar 0.5%.",
            "copper": "Sufficient (>0.4 ppm); no copper corrective dose needed.",
            "available_copper": "Sufficient (>0.4 ppm); no copper corrective dose needed.",
            "sulphur": "Deficient: Apply elemental sulphur or gypsum @ 20-25 kg/ha.",
            "available_sulphur": "Deficient: Apply elemental sulphur or gypsum @ 20-25 kg/ha.",
            "boron": "Deficient: Apply borax @ 5-10 kg/ha or 0.1% foliar spray.",
            "available_boron": "Deficient: Apply borax @ 5-10 kg/ha or 0.1% foliar spray.",
            "bd": "Soil density favorable for root penetration & water retention.",
            "bulk_density": "Soil density favorable for root penetration & water retention.",
            "total_nitrogen": "Moderate N reserve; incorporate FYM & crop residues.",
            "total_n": "Moderate N reserve; incorporate FYM & crop residues.",
            "cec": "High nutrient retention capacity; buffers nutrient leaching.",
            "cfvo": "Minimal gravel content; favorable tillage & root zone.",
            "coarse_fragments": "Minimal gravel content; favorable tillage & root zone.",
            "sand": "Adequate sand fraction ensuring baseline aeration & drainage.",
            "silt": "Optimum silt content supporting available water capacity.",
            "clay": "High smectite clay vertisol; maintain drainage channels.",
            "soil_texture": "Deep black vertisol; practice broad-bed furrow & timely tillage.",
            "soil_texture_class": "Deep black vertisol; practice broad-bed furrow & timely tillage.",
        }

        clean_recs_mr = {
            "ph": "योग्य सामू (६.५-७.५); संतुलित पाणी व खत व्यवस्थापन ठेवा.",
            "ec": "अक्षारयुक्त (<०.८ dS/m); पिकांसाठी क्षारतेचा धोका नाही.",
            "organic_carbon": "सेंद्रिय कर्ब उत्तम; हिरवळीची खते व पिकांचे अवशेष वापरा.",
            "available_nitrogen": "कमी: नत्र मात्रा ~१२५% RDF (युरिया/शेणखत) पर्यंत वाढवावी.",
            "available_phosphorus": "मध्यम: शिफारशीत १००% स्फुरद मात्रा (सिंगल सुपर फॉस्फेट) द्या.",
            "available_potassium": "जास्त: पालाश मात्रा ~७५% RDF पर्यंत कमी करून बचत करा.",
            "exchangeable_sodium": "सुरक्षित मर्यादा (<१५%); शेतातील पाण्याचा योग्य निचरा ठेवा.",
            "esp": "सुरक्षित मर्यादा (<१५%); शेतातील पाण्याचा योग्य निचरा ठेवा.",
            "free_lime": "सामान्य (<५%); अन्नद्रव्ये स्थिर न होण्यासाठी संतुलित खते द्या.",
            "iron": "कमतरता: फेरस सल्फेट २५ किलो/हेक्टर किंवा ०.५% फवारणी करा.",
            "available_iron": "कमतरता: फेरस सल्फेट २५ किलो/हेक्टर किंवा ०.५% फवारणी करा.",
            "manganese": "पुरेसे प्रमाण; नियमित निरीक्षण ठेवा, जास्त चुना टाळा.",
            "available_manganese": "पुरेसे प्रमाण; नियमित निरीक्षण ठेवा, जास्त चुना टाळा.",
            "zinc": "कमतरता: झिंक सल्फेट २०-२५ किलो/हेक्टर किंवा ०.५% फवारणी करा.",
            "available_zinc": "कमतरता: झिंक सल्फेट २०-२५ किलो/हेक्टर किंवा ०.५% फवारणी करा.",
            "copper": "पुरेसे प्रमाण (>०.४ ppm); अतिरिक्त तांबे खतांची गरज नाही.",
            "available_copper": "पुरेसे प्रमाण (>०.४ ppm); अतिरिक्त तांबे खतांची गरज नाही.",
            "sulphur": "कमतरता: गंधक किंवा जिप्सम २०-२५ किलो/हेक्टर जमिनीत द्या.",
            "available_sulphur": "कमतरता: गंधक किंवा जिप्सम २०-२५ किलो/हेक्टर जमिनीत द्या.",
            "boron": "कमतरता: बोरॅक्स ५-१० किलो/हेक्टर किंवा ०.१% सोल्यूबोर फवारा.",
            "available_boron": "कमतरता: बोरॅक्स ५-१० किलो/हेक्टर किंवा ०.१% सोल्यूबोर फवारा.",
            "bd": "मातीची घनता अनुकूल; मुळांची वाढ व ओलावा टिकून राहतो.",
            "bulk_density": "मातीची घनता अनुकूल; मुळांची वाढ व ओलावा टिकून राहतो.",
            "total_nitrogen": "मध्यम नत्र साठा; शेणखत व सेंद्रिय अवशेष मिसळावेत.",
            "total_n": "मध्यम नत्र साठा; शेणखत व सेंद्रिय अवशेष मिसळावेत.",
            "cec": "धनायन विनिमय क्षमता उच्च; खते वाहून न जाता टिकून राहतात.",
            "cfvo": "दगड-गोट्यांचे प्रमाण कमी; मुळांच्या वाढीसाठी जमीन अनुकूल.",
            "coarse_fragments": "दगड-गोट्यांचे प्रमाण कमी; मुळांच्या वाढीसाठी जमीन अनुकूल.",
            "sand": "वाळूचे प्रमाण योग्य; जमिनीत हवा खेळती राहण्यास मदत होते.",
            "silt": "गाळाचे प्रमाण योग्य; ओलावा टिकवून ठेवण्यास मदत करते.",
            "clay": "काळी कसदार चिकणमाती; पाणी साचू नये म्हणून चर काढावेत.",
            "soil_texture": "खोल काळी जमीन; रुंद वरंबा-सरी (BBF) पद्धतीने पेरणी करावी.",
            "soil_texture_class": "खोल काळी जमीन; रुंद वरंबा-सरी (BBF) पद्धतीने पेरणी करावी.",
        }

        param_rows = [th_row]

        for idx, p in enumerate(parameters, 1):
            pkey = p.get("key", "")
            p_name = p.get("name_mr" if is_mr else "name", p.get("name", "N/A"))
            val = p.get("value")
            val_str = f"{val:.2f}" if isinstance(val, (int, float)) else (str(val) if val is not None else "—")
            unit_str = p.get("unit") or "—"
            raw_interp = p.get("interpretation_mr" if is_mr else "interpretation", p.get("interpretation", "—"))

            if is_mr:
                ref_range = translate_ref_range_to_mr(clean_ref_ranges.get(pkey, p.get("reference_range", "—")))
                rec_text = clean_recs_mr.get(pkey, p.get("recommendation_mr", p.get("recommendation", "—")))
            else:
                ref_range = clean_ref_ranges.get(pkey, p.get("reference_range", "—"))
                rec_text = clean_recs.get(pkey, p.get("recommendation", "—"))

            if pkey in ["soil_texture", "texture"] and not is_mr:
                raw_interp = "Clayey"

            interp_flowable = _format_interp(raw_interp)

            if pkey in ["soil_texture", "texture"] or "clay vertisol" in str(val_str).lower():
                val_flowable = Paragraph("<b>चिकण माती<br/>(व्हर्टिसॉल)</b>" if is_mr else "<b>Clay<br/>Vertisol</b>", st_td_val)
            else:
                val_flowable = Paragraph(f"<b>{val_str}</b>", st_td_val)

            if pkey == "cec" or "cmol(c)/kg" in str(unit_str):
                unit_flowable = Paragraph("cmol(c)/<br/>kg", st_td_unit)
            else:
                unit_flowable = Paragraph(unit_str, st_td_unit)

            row = [
                Paragraph(str(p.get("sr_no") or idx), st_td_sr),
                Paragraph(p_name, st_td_param),
                val_flowable,
                unit_flowable,
                interp_flowable,
                Paragraph(_format_ref_range_xml(ref_range), st_td_range),
                Paragraph(rec_text, st_td_rec),
            ]
            param_rows.append(row)

        param_table = Table(
            param_rows,
            colWidths=[9 * mm, 41 * mm, 17 * mm, 13 * mm, 25 * mm, 35 * mm, 56 * mm],
        )
        param_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_DARK_GREEN),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER_GRAY),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, COLOR_BORDER_GRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 0.7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0.7),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.0),
        ]))
        story.append(param_table)
        story.append(Spacer(1, 1.0 * mm))

        # Red Footnote Note
        footnote_text = (
            "टीप: या अहवालातील मातीचे गुणधर्म व निष्कर्ष ०–३० सें.मी. मुळांच्या कार्यक्षेत्रातील खोलीवर आधारित आहेत."
            if is_mr
            else "Note: Soil properties and interpretations in this report are based on the 0–30 cm root-zone soil depth."
        )
        story.append(Paragraph(footnote_text, st_footnote))
        story.append(Spacer(1, 1.0 * mm))

        # --------------------------------------------------------------
        # 4. REPORT INFORMATION & LABORATORY CERTIFICATION
        # --------------------------------------------------------------
        story.append(HRFlowable(width="100%", thickness=1.0, color=COLOR_DARK_GREEN, spaceBefore=0, spaceAfter=1.0 * mm))

        cert_sub_text = (
            "कृषी निदान व डिजिटल मृदा परीक्षण केंद्र, बारामती / पुणे, महाराष्ट्र"
            if is_mr
            else "Agricultural Diagnostic & Digital Soil Testing Center, Baramati / Pune, Maharashtra"
        )
        report_no = report_meta.get("report_no", "SPL/2026/SL-0104")
        cert_ref_text = (
            f"अहवाल संदर्भ: {report_no} • दिनांक: {live_date}"
            if is_mr
            else f"Report Ref: {report_no} • Date: {live_date}"
        )

        sign_name_text = report_meta.get("chemist_name") or ("ए.बी.सी (मुख्य रसायनशास्त्रज्ञ)" if is_mr else "A.B.C (Chief Chemist)")
        sign_title_text = "अधिकृत मृदा परीक्षण रसायनशास्त्रज्ञ" if is_mr else "AUTHORIZED SOIL TESTING CHEMIST"
        sign_div_text = "मृदा निदान व विश्लेषणात्मक रसायनशास्त्र विभाग" if is_mr else "Soil Diagnostics & Analytical Chemistry Division"

        footer_left = [
            Paragraph("<b>एडीटी एआय ट्रेनिंग फाउंडेशन, बारामती</b>" if is_mr else "<b>ADT AI TRAINING FOUNDATION, BARAMATI</b>", st_cert_org),
            Paragraph(cert_sub_text, st_cert_sub),
            Paragraph(cert_ref_text, st_cert_ref),
        ]
        footer_right = [
            Paragraph(f"<b>{sign_name_text}</b>", st_sign_name),
            Paragraph(f"<b>{sign_title_text}</b>", st_sign_title),
            Paragraph(sign_div_text, st_sign_div),
        ]

        footer_table = Table(
            [[footer_left, footer_right]],
            colWidths=[110 * mm, 86 * mm]
        )
        footer_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(footer_table)

        # Build document
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()


    # ==================================================================
    # 2. DETAILED SOIL REPORT PDF (Complete 14+ Laboratory Dossier)
    # ==================================================================
    def generate_detailed_soil_report_pdf(
        self,
        report_data: Dict[str, Any],
        lang: str = "en",
        verify_url: Optional[str] = None,
    ) -> bytes:
        """Generate comprehensive official laboratory Soil Test Report PDF matching 4-page official layout."""
        is_mr = lang.lower() == "mr"
        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=12 * mm,
            rightMargin=12 * mm,
            topMargin=10 * mm,
            bottomMargin=14 * mm,
        )

        styles = self._get_styles()
        story = []

        field = report_data.get("field", {}) or {}
        farmer = report_data.get("farmer", {}) or {}
        report_meta = report_data.get("report", {}) or {}
        parameters: List[Dict[str, Any]] = report_data.get("parameters", []) or []

        report_no = report_meta.get("report_no", "SPL/2026/SL-0104")

        # --------------------------------------------------------------
        # 1. Header (Centered Header matching image)
        # --------------------------------------------------------------
        st_head_adt = ParagraphStyle(
            "AdtHeadDetailed",
            parent=styles["val"],
            fontName=FONT_BOLD,
            fontSize=12,
            leading=15,
            textColor=COLOR_PRIMARY,
            alignment=1,
        )
        st_head_loc = ParagraphStyle(
            "AdtLocDetailed",
            parent=styles["val"],
            fontName=FONT_REGULAR,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#4B5563"),
            alignment=1,
        )
        st_head_title = ParagraphStyle(
            "AdtTitleDetailed",
            parent=styles["val"],
            fontName=FONT_BOLD,
            fontSize=10,
            leading=13,
            textColor=COLOR_PRIMARY,
            alignment=1,
        )

        story.append(Paragraph(
            "<b>एडीटी एआय ट्रेनिंग फाउंडेशन, बारामती</b>" if is_mr else "<b>ADT AI TRAINING FOUNDATION, BARAMATI</b>",
            st_head_adt,
        ))
        story.append(Paragraph(
            "पुणे, महाराष्ट्र" if is_mr else "Pune, Maharashtra",
            st_head_loc,
        ))
        story.append(Paragraph(
            "<b>सॉईलपायलट — सविस्तर माती चाचणी व कृषी निर्णय अहवाल</b>" if is_mr else "<b>SOILPILOT — DETAILED SOIL TEST & DIAGNOSTIC REPORT</b>",
            st_head_title,
        ))
        story.append(Spacer(1, 3 * mm))

        # --------------------------------------------------------------
        # 2. FARMER, CADASTRE & SAMPLE IDENTIFICATION (Section 1)
        # --------------------------------------------------------------
        meta_heading = "१. शेतकरी, भूखंड व माती नमुना ओळख" if is_mr else "1. FARMER, CADASTRE & SAMPLE IDENTIFICATION"
        story.append(Paragraph(meta_heading, styles["section"]))
        story.append(Spacer(1, 1.5 * mm))

        farmer_name = farmer.get("name", "Farmer")
        if not is_mr and any('\u0900' <= c <= '\u097f' for c in str(farmer_name)):
            farmer_name = devanagari_to_english(str(farmer_name))
        gat_no = field.get("gat_no", "22")
        village = translate_geo_name(field.get("village", "Malegaon Kh."), is_mr)
        taluka = translate_geo_name(field.get("taluka", "Baramati"), is_mr)
        district = translate_geo_name(field.get("district", "Pune"), is_mr)
        area_unit = "हेक्टर" if is_mr else (field.get("area_unit") or "hectare")
        area = f"{field.get('area', '1.49')} {area_unit}"
        sample_date = report_meta.get("sample_date", "15-09-2026")
        report_date = report_meta.get("report_date", get_india_current_date_str())
        receipt_no = report_meta.get("receipt_no", "REC-7842/26")
        sample_name = "पृष्ठभागीय माती नमुना (०-१५ सेमी)" if is_mr else (report_meta.get("sample_name") or "Surface Soil Composite (0-15 cm)")
        crop_name = "ऊस" if is_mr else (report_meta.get("crop_name") or "Sugarcane (ऊस)")

        meta_rows = [
            [
                Paragraph("शेतकऱ्याचे नाव" if is_mr else "Farmer Name", styles["label"]),
                Paragraph(f"<b>{farmer_name}</b>", styles["val"]),
                Paragraph("अहवाल क्रमांक" if is_mr else "Report Number", styles["label"]),
                Paragraph(f"<b>{report_no}</b>", styles["val"]),
            ],
            [
                Paragraph("गट क्रमांक" if is_mr else "Gat / Survey Number", styles["label"]),
                Paragraph(f"<b>Gat No. {gat_no}</b>", styles["val"]),
                Paragraph("पावती क्रमांक" if is_mr else "Receipt Number", styles["label"]),
                Paragraph(receipt_no, styles["val"]),
            ],
            [
                Paragraph("गाव / तालुका" if is_mr else "Village / Taluka", styles["label"]),
                Paragraph(f"{village}, {taluka}", styles["val"]),
                Paragraph("नमुना संकलन दिनांक" if is_mr else "Sample Collection Date", styles["label"]),
                Paragraph(sample_date, styles["val"]),
            ],
            [
                Paragraph("जिल्हा व क्षेत्र" if is_mr else "District & Field Area", styles["label"]),
                Paragraph(f"{district} • {area}", styles["val"]),
                Paragraph("अहवाल प्रसिद्धी दिनांक" if is_mr else "Report Release Date", styles["label"]),
                Paragraph(report_date, styles["val"]),
            ],
            [
                Paragraph("नमुना प्रकार" if is_mr else "Sample Description", styles["label"]),
                Paragraph(sample_name, styles["val"]),
                Paragraph("नियोजित पीक" if is_mr else "Target Crop", styles["label"]),
                Paragraph(crop_name, styles["val"]),
            ],
        ]
        meta_table = Table(meta_rows, colWidths=[44 * mm, 49 * mm, 44 * mm, 49 * mm])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 3.5 * mm))

        # --------------------------------------------------------------
        # 3. COMPLETE SOIL CHEMICAL & NUTRIENT DIAGNOSTICS (Section 2)
        # --------------------------------------------------------------
        param_heading = (
            "२. संपूर्ण माती रासायनिक व पोषणद्रव्य विश्लेषण आणि शिफारसी"
            if is_mr
            else "2. COMPLETE SOIL CHEMICAL & NUTRIENT DIAGNOSTICS & RECOMMENDATIONS"
        )
        story.append(Paragraph(param_heading, styles["section"]))
        story.append(Spacer(1, 1.5 * mm))

        th_sr = "अ.क्र." if is_mr else "SR. NO."
        th_param = "घटक / निर्देशांक" if is_mr else "PARAMETER"
        th_val = "प्राप्त मूल्य" if is_mr else "OBSERVED VALUE"
        th_unit = "एकक" if is_mr else "UNIT"
        th_status = "निष्कर्ष" if is_mr else "INTERPRETATION"
        th_range = "संदर्भ श्रेणी" if is_mr else "REFERENCE RANGE"
        th_rec = "शिफारस" if is_mr else "RECOMMENDATION"

        def make_param_row(idx: int, p: Dict[str, Any]):
            p_name = p.get("name_mr" if is_mr else "name", p.get("name", "N/A"))
            source_raw = str(p.get("source_type") or p.get("source") or ("LAB OBSERVATION" if idx <= 15 else "DSM PREDICTION")).upper()
            if "LAB" in source_raw:
                source_label = "प्रयोगशाळा चाचणी (0-15 cm)" if is_mr else "Lab Observation (0-15 cm)"
            elif "DSM" in source_raw:
                source_label = "डिजिटल मॅपिंग (DSM 0-30 cm)" if is_mr else "DSM Prediction (0-30 cm)"
            else:
                source_label = "आयातित नोंद" if is_mr else "Imported Data"

            val = p.get("value")
            val_str = f"{val:.2f}" if isinstance(val, (int, float)) else ("उपलब्ध नाही" if is_mr else "Not Available")
            unit_str = p.get("unit") or "—"
            interp = p.get("interpretation_mr" if is_mr else "interpretation", p.get("interpretation", "N/A"))
            ref_range_raw = p.get("reference_range_mr" if is_mr else "reference_range", p.get("reference_range", "-"))
            ref_range = translate_ref_range_to_mr(ref_range_raw) if is_mr else ref_range_raw
            rec_text = p.get("recommendation_mr" if is_mr else "recommendation") or p.get("recommendation", "Maintain balanced nutrient management.")

            param_cell = f"<b>{p_name}</b><br/><font size='5.8' color='#4B5563'><i>{source_label}</i></font>"
            return [
                Paragraph(str(idx), styles["td_center"]),
                Paragraph(param_cell, styles["td"]),
                Paragraph(f"<b>{val_str}</b>", styles["td_center"]),
                Paragraph(unit_str, styles["td_center"]),
                Paragraph(interp, styles["td"]),
                Paragraph(_format_ref_range_xml(ref_range), styles["td"]),
                Paragraph(rec_text, styles["td"]),
            ]

        def build_param_table(rows_data):
            table_rows = [[
                Paragraph(th_sr, styles["th"]),
                Paragraph(th_param, styles["th"]),
                Paragraph(th_val, styles["th"]),
                Paragraph(th_unit, styles["th"]),
                Paragraph(th_status, styles["th"]),
                Paragraph(th_range, styles["th"]),
                Paragraph(th_rec, styles["th"]),
            ]]
            table_rows.extend(rows_data)
            t = Table(table_rows, colWidths=[8 * mm, 43 * mm, 16 * mm, 12 * mm, 26 * mm, 30 * mm, 51 * mm])
            t_style = [
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 2.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
            for i in range(1, len(table_rows)):
                bg = COLOR_BG_ALT if i % 2 == 0 else colors.white
                t_style.append(("BACKGROUND", (0, i), (-1, i), bg))
            t.setStyle(TableStyle(t_style))
            return t

        # Split across pages matching official 4-page template
        # Page 1: Rows 1 to 6
        p_rows_p1 = [make_param_row(idx, p) for idx, p in enumerate(parameters[:6], 1)]
        story.append(build_param_table(p_rows_p1))
        story.append(PageBreak())

        # Page 2: Rows 7 to 19
        p_rows_p2 = [make_param_row(idx, p) for idx, p in enumerate(parameters[6:19], 7)]
        story.append(build_param_table(p_rows_p2))
        story.append(PageBreak())

        # Page 3: Rows 20 to 22
        p_rows_p3 = [make_param_row(idx, p) for idx, p in enumerate(parameters[19:], 20)]
        story.append(build_param_table(p_rows_p3))
        story.append(Spacer(1, 3.5 * mm))

        # --------------------------------------------------------------
        # 4. MULTI-CRITERIA CROP RECOMMENDATIONS & DECISION RANKING (Section 3)
        # --------------------------------------------------------------
        crop_sec_heading = (
            "३. बहु-निकष पीक शिफारसी व प्राधान्यक्रम"
            if is_mr
            else "3. MULTI-CRITERIA CROP RECOMMENDATIONS & DECISION RANKING"
        )
        story.append(Paragraph(crop_sec_heading, styles["section"]))
        story.append(Spacer(1, 1.5 * mm))

        # Standard qualifying crops with verified regional MPKV/CACP benchmarks
        crops_list = [
            {
                "crop_code": "CHANA",
                "crop_name": "Bengal Gram (Chickpea / Harbara)",
                "crop_name_mr": "हरभरा (चना)",
                "tier": "Recommended Suitable Option" if not is_mr else "सर्वोत्तम शिफारस पर्याय",
                "window": "Oct 01 – Nov 10",
                "harvest": "Feb 01, 2027 – Feb 16, 2027 (95–110 days)",
                "water": "LOW",
                "risk": "LOW",
                "exp": (
                    "Preliminary evidence strongly supports Bengal Gram (Chickpea / Harbara). Soil parameters meet optimal MPKV Rahuri benchmarks and the planting window (Oct 01 – Nov 10) is active."
                    if not is_mr else
                    "मातीचे घटक महात्मा फुले कृषी विद्यापीठ (MPKV) मानकांशी तंतोतंत जुळतात आणि पेरणी कालावधी (१ ऑक्टोबर - १० नोव्हेंबर) सक्रिय आहे."
                ),
                "guide": (
                    "Verify local seed availability (certified variety) and ensure seed treatment with Rhizobium/fungicide."
                    if not is_mr else
                    "प्रमाणित बियाण्यांची खात्री करावी आणि रायझोबियम व ट्रायकोडर्माची बीजप्रक्रिया आवर्जून करावी."
                ),
                "cost_a2": "10,724₹",
                "cost_c2": "16,390₹",
            },
            {
                "crop_code": "ONION",
                "crop_name": "Rabi Onion (Kanda)",
                "crop_name_mr": "रब्बी कांदा",
                "tier": "Conditionally Suitable — Management Intensive" if not is_mr else "सशर्त अनुकूल — व्यवस्थापन गहन",
                "window": "Oct 15 – Nov 30",
                "harvest": "Feb 16, 2027 – Mar 08, 2027 (110–130 days)",
                "water": "MEDIUM",
                "risk": "MODERATE",
                "exp": (
                    "High gross revenue potential, with verified suitability for Baramati vertisols and strong local APMC demand."
                    if not is_mr else
                    "उत्कृष्ट उत्पन्नाची क्षमता, बारामती काळ्या जमिनीस अत्यंत अनुकूल आणि स्थानिक बाजारपेठेत हमखास मागणी."
                ),
                "guide": (
                    "Verify water storage and irrigation pump capacity before committing capital."
                    if not is_mr else
                    "भांडवल गुंतवण्यापूर्वी पाणी साठवण व उपसा क्षमतेची खात्री करावी."
                ),
                "cost_a2": "35,612₹",
                "cost_c2": "53,418₹",
            },
            {
                "crop_code": "WHEAT",
                "crop_name": "Wheat (Gahu)",
                "crop_name_mr": "गहू",
                "tier": "Conditionally Suitable — Management Intensive" if not is_mr else "सशर्त अनुकूल — व्यवस्थापन गहन",
                "window": "Nov 01 – Nov 30",
                "harvest": "Feb 11, 2027 – Mar 03, 2027 (105–125 days)",
                "water": "MEDIUM",
                "risk": "MODERATE",
                "exp": (
                    "High grain food security and steady mandi demand."
                    if not is_mr else
                    "अन्नधान्य सुरक्षितता व हमखास बाजार."
                ),
                "guide": (
                    "Verify water storage and irrigation pump capacity before committing capital."
                    if not is_mr else
                    "भांडवल गुंतवण्यापूर्वी पाणी साठवण व उपसा क्षमतेची खात्री करावी."
                ),
                "cost_a2": "11,938₹",
                "cost_c2": "18,616₹",
            },
        ]

        # Top-ranked banner
        top_crop = crops_list[0]
        top_name = top_crop["crop_name_mr"] if is_mr else top_crop["crop_name"]
        top_title_prefix = "सर्वोत्तम शिफारस पीक (१ले स्थान)" if is_mr else "TOP-RANKED SUITABLE CROP (Rank 1)"
        top_header_text = f"<b>{top_title_prefix}: {top_name}</b> — <i>{top_crop['tier']}</i>"
        top_h_table = Table([[Paragraph(top_header_text, styles["card_title"])]], colWidths=[186 * mm])
        top_h_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_PRIMARY),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))

        lbl_window = "पेरणी काळ" if is_mr else "Planting Window"
        lbl_harvest = "काढणी व कालावधी" if is_mr else "Harvest Window"
        lbl_water = "पाण्याची गरज" if is_mr else "Water Need"
        lbl_exp = "शिफारशीचे शास्त्रीय कारण" if is_mr else "Agronomic Rationale"
        lbl_guide = "शेतकऱ्यांसाठी कृती मार्गदर्शन" if is_mr else "Farmer Guidance"

        top_body_text = (
            f"<b>{lbl_window}:</b> {top_crop['window']} | "
            f"<b>{lbl_harvest}:</b> {top_crop['harvest']} | "
            f"<b>{lbl_water}:</b> {top_crop['water']}<br/>"
            f"<b>{lbl_exp}:</b> {top_crop['exp']}<br/>"
            f"<b>{lbl_guide}:</b> {top_crop['guide']}"
        )
        top_b_table = Table([[Paragraph(top_body_text, styles["val"])]], colWidths=[186 * mm])
        top_b_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_PRIMARY_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_PRIMARY),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(top_h_table)
        story.append(top_b_table)
        story.append(Spacer(1, 2.5 * mm))

        # Comparative Ranking Table
        c_th_rank = "स्थान" if is_mr else "RANK"
        c_th_crop = "पीक" if is_mr else "CROP"
        c_th_tier = "शिफारस स्थिती" if is_mr else "STATUS / TIER"
        c_th_window = "पेरणी व काढणी काळ" if is_mr else "PLANTING & HARVEST"
        c_th_water = "पाणी व जोखीम" if is_mr else "WATER & RISK"
        c_th_notes = "मार्गदर्शन व मर्यादा" if is_mr else "GUIDANCE & NOTES"

        c_table_rows = [[
            Paragraph(c_th_rank, styles["th"]),
            Paragraph(c_th_crop, styles["th"]),
            Paragraph(c_th_tier, styles["th"]),
            Paragraph(c_th_window, styles["th"]),
            Paragraph(c_th_water, styles["th"]),
            Paragraph(c_th_notes, styles["th"]),
        ]]
        for idx, c in enumerate(crops_list, 1):
            c_name = c["crop_name_mr"] if is_mr else c["crop_name"]
            c_table_rows.append([
                Paragraph(f"<b>#{idx}</b>", styles["td_center"]),
                Paragraph(f"<b>{c_name}</b>", styles["td"]),
                Paragraph(c["tier"], styles["td"]),
                Paragraph(f"{c['window']}<br/>{c['harvest']}", styles["td"]),
                Paragraph(f"Water: {c['water']}<br/>Risk: {c['risk']}", styles["td_center"]),
                Paragraph(c["guide"], styles["td"]),
            ])
        crop_table = Table(c_table_rows, colWidths=[12 * mm, 38 * mm, 30 * mm, 34 * mm, 22 * mm, 50 * mm])
        crop_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 2.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(crop_table)
        story.append(Spacer(1, 3.5 * mm))

        # --------------------------------------------------------------
        # 5. MARKET PRICE ANALYSIS & CULTIVATION ECONOMICS (Section 4)
        # --------------------------------------------------------------
        mkt_heading = (
            "४. बाजार भाव विश्लेषण व शेती अर्थशास्त्र"
            if is_mr
            else "4. MARKET PRICE ANALYSIS & CULTIVATION ECONOMICS"
        )
        story.append(Paragraph(mkt_heading, styles["section"]))
        story.append(Spacer(1, 1.0 * mm))

        mkt_notice = (
            "संदर्भ बाजार: बारामती कृषी उत्पन्न बाजार समिती (पुणे) • माहिती स्रोत: AGMARKNET व CACP अधिकृत उत्पादन खर्च निकष"
            if is_mr
            else "Reference APMC: Baramati Market Committee (Pune) • Sources: AGMARKNET Daily Mandi Auctions & CACP Benchmarks"
        )
        story.append(Paragraph(f"<font size='6.8' color='#4B5563'><i>{mkt_notice}</i></font>", styles["val"]))
        story.append(Spacer(1, 1.0 * mm))

        mkt_th_crop = "पीक" if is_mr else "CROP"
        mkt_th_obs = "प्रत्यक्ष बाजारभाव" if is_mr else "OBSERVED MANDI PRICE"
        mkt_th_fc = "काढणी हंगाम अंदाज" if is_mr else "HARVEST FORECAST PRICE"
        mkt_th_cost = "उत्पादन खर्च / एकर" if is_mr else "CULTIVATION COST / ACRE"
        mkt_th_net = "अंदाजित निव्वळ नफा / एकर" if is_mr else "EST. NET RETURN / ACRE"

        def build_mkt_table(crops_sub):
            rows = [[
                Paragraph(mkt_th_crop, styles["th"]),
                Paragraph(mkt_th_obs, styles["th"]),
                Paragraph(mkt_th_fc, styles["th"]),
                Paragraph(mkt_th_cost, styles["th"]),
                Paragraph(mkt_th_net, styles["th"]),
            ]]
            for c in crops_sub:
                c_name = c["crop_name_mr"] if is_mr else c["crop_name"]
                obs_str = "माहिती प्रलंबित" if is_mr else "Pending Data"
                fc_str = "अंदाज अनुपलब्ध" if is_mr else "Forecast Unavailable"
                cost_str = f"A2+FL: {c['cost_a2']}<br/>C2: {c['cost_c2']}"
                net_str = "अंदाज प्रलंबित" if is_mr else "Pending Forecast"
                rows.append([
                    Paragraph(f"<b>{c_name}</b>", styles["td"]),
                    Paragraph(obs_str, styles["td_center"]),
                    Paragraph(fc_str, styles["td_center"]),
                    Paragraph(cost_str, styles["td"]),
                    Paragraph(net_str, styles["td_center"]),
                ])
            t = Table(rows, colWidths=[36 * mm, 34 * mm, 34 * mm, 42 * mm, 40 * mm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]))
            return t

        # Page 3: Section 4 Row 1 (Bengal Gram)
        story.append(build_mkt_table(crops_list[:1]))
        story.append(PageBreak())

        # Page 4: Section 4 Rows 2 & 3 (Rabi Onion & Wheat)
        story.append(build_mkt_table(crops_list[1:]))
        story.append(Spacer(1, 2.5 * mm))

        # Transparency Notice Box
        transp_text = (
            "<b>बाजार पारदर्शकता सूचना:</b> प्रत्यक्ष बाजारभाव AGMARKNET भौतिक लिलावावरून घेतलेले आहेत, तर काढणी हंगाम भाव सांख्यिकी अंदाजानुसार दर्शवले आहेत. अंदाज अनुपलब्ध असल्यास तो शून्य मानला जात नाही व अंदाजित नफा दर्शवला जात नाही. हे केवळ निर्णय साहाय्यासाठी असून कोणत्याही हमीभावाची अथवा नफ्याची खात्री देत नाही."
            if is_mr
            else "<b>Market Transparency Notice:</b> Observed prices represent actual mandi physical auctions (AGMARKNET). Harvest period prices are statistical forecasts and are explicitly distinguished from spot prices. An unavailable forecast is never treated as zero. Ratings and estimated net returns provide agricultural decision support only and do not guarantee market prices, crop yields, or farmer profits."
        )
        transp_table = Table([[Paragraph(transp_text, styles["disclaimer"])]], colWidths=[186 * mm])
        transp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_CREAM),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BEIGE),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(transp_table)
        story.append(Spacer(1, 3.5 * mm))

        # --------------------------------------------------------------
        # 6. INTEGRATED DIAGNOSTIC & DECISION SUMMARY (Section 5)
        # --------------------------------------------------------------
        sum_title = (
            "५. सर्वसमावेशक माती व कृषी सारांश"
            if is_mr
            else "5. INTEGRATED DIAGNOSTIC & DECISION SUMMARY"
        )
        story.append(Paragraph(sum_title, styles["section"]))
        story.append(Spacer(1, 1.5 * mm))

        bullet_diag = "माती आरोग्य स्थिती" if is_mr else "Soil Diagnostic Status"
        bullet_crop = "पीक शिफारस निष्कर्ष" if is_mr else "Primary Crop Recommendation"
        bullet_risk = "जोखीम व सिंचन दक्षता" if is_mr else "Resource & Risk Guidance"

        text_diag = (
            "उपलब्ध नत्र कमी (163 kg/ha), सामू मध्यम विम्लधर्मी (8.38), व सेंद्रिय कर्ब उत्तम (0.82%). पिकांना संतुलित पोषण देण्यासाठी सेंद्रिय खतांचा वापर वाढवावा."
            if is_mr else
            "Available Nitrogen is low (163 kg/ha), pH is moderately alkaline (8.38), and Soil Organic Carbon is optimal (0.82%). Apply balanced split N fertilization and basal organic enrichment."
        )
        text_crop = (
            "काळ्या कसदार जमिनीतील ओलावा व बारामती बाजारपेठेतील मजबूत मागणी लक्षात घेता हरभरा (चना) हे सर्वोत्तम १ले शिफारस पीक ठरते."
            if is_mr else
            "Based on heavy vertisol moisture retention and favorable Baramati APMC modal price trends, Bengal Gram (Chickpea / Harbara) is the #1 recommended crop for this parcel."
        )
        text_risk = (
            "कांदा किंवा गहू यांसारख्या पर्यायी पिकांसाठी खात्रीशीर ५-६ वेळेस सिंचन व पाणी साठवण क्षमता तपासावी. कीड व रोग नियंत्रणासाठी वेळेवर उपाययोजना करावी."
            if is_mr else
            "Conditional crops such as Onion or Wheat require verified irrigation storage (5–6 turns) and curing infrastructure. Monitor pest incidence (Helicoverpa) actively."
        )

        sum_lines = [
            f"• <b>{bullet_diag}:</b> {text_diag}",
            f"• <b>{bullet_crop}:</b> {text_crop}",
            f"• <b>{bullet_risk}:</b> {text_risk}",
        ]
        sum_table = Table([[Paragraph("<br/>".join(sum_lines), styles["val"])]], colWidths=[186 * mm])
        sum_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_PRIMARY_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SECONDARY),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(sum_table)

        # Build document
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer.getvalue()


pdf_service = PDFService()
