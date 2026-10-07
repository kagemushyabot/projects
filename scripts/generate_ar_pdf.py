#!/usr/bin/env python3
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.enums import TA_LEFT

ASSETS = "/home/ubuntu/.cursor/projects/workspace/assets"
OUT = "/workspace/output/AR_Experience_QR_Guide.pdf"

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiMin-W3"))

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "DocTitle",
    parent=styles["Heading1"],
    fontName="HeiseiMin-W3",
    fontSize=20,
    spaceAfter=12,
)
section_title = ParagraphStyle(
    "SectionTitle",
    parent=styles["Heading2"],
    fontName="HeiseiMin-W3",
    fontSize=15,
    textColor=colors.HexColor("#1a1a1a"),
    spaceAfter=6,
)
body = ParagraphStyle(
    "BodyJP",
    parent=styles["Normal"],
    fontName="HeiseiMin-W3",
    fontSize=11,
    leading=16,
    spaceAfter=4,
)
url_style = ParagraphStyle(
    "URL",
    parent=body,
    fontSize=10,
    textColor=colors.HexColor("#0b57d0"),
)

ENTRIES = [
    {
        "category": "Slam-Base AR Experience",
        "qr": f"{ASSETS}/96cdbfce-196d-4b2d-a31e-1775317ca37f.png",
        "url": "https://splattic-ar-test-3277b1.gitlab.io/",
        "title": "box_robo — World AR",
        "desc_ja": "平面をスキャンして3Dモデルを空間に配置するSLAM（World Placement）体験です。",
        "desc_en": "Scan a surface and tap to place 3D content in the real world.",
        "right_image": None,
    },
    {
        "category": "Slam-Base AR Experience",
        "qr": f"{ASSETS}/5fbdcc39-6eac-493a-9509-8efb7c118f48.png",
        "url": "https://splat-garden-de068c.gitlab.io/",
        "title": "splatGarden — World AR",
        "desc_ja": "Gaussian Splatコンテンツを床面などに配置して見られるWorld AR体験です。",
        "desc_en": "Place and explore splat garden content on detected surfaces.",
        "right_image": None,
    },
    {
        "category": "Slam-Base AR Experience",
        "qr": f"{ASSETS}/379a1a3e-38bb-4ebd-afa0-55a713ed8cf7.png",
        "url": "https://tactic-sizzle-reel-5611ed.gitlab.io/",
        "title": "VideoScreen — World AR",
        "desc_ja": "TACTICの映像を空間内のスクリーンとして配置するWorld AR体験です。",
        "desc_en": "Place a video screen in your space using world tracking.",
        "right_image": None,
    },
    {
        "category": "Image-base AR Experience",
        "qr": f"{ASSETS}/02bdf68a-744a-44ae-9a4b-ce24bbd4b17c.png",
        "url": "https://tacticbot-dance-b22377.gitlab.io/",
        "title": "VideoScreen — Image AR",
        "desc_ja": "右側のSplatticロゴを印刷し、カメラでマーカーを認識させるImage Target型ARです。",
        "desc_en": "Print the Splattic logo marker, open the URL, then point the camera at the marker.",
        "right_image": f"{ASSETS}/48611c2d-fc3d-4f18-9a17-f50215e251a4.png",
    },
]


def build_right_column(entry):
    flow = [
        Paragraph(f"<b>{entry['category']}</b>", section_title),
        Paragraph(entry["title"], body),
        Paragraph(entry["desc_ja"], body),
        Paragraph(entry["desc_en"], body),
        Paragraph(f"URL: {entry['url']}", url_style),
    ]
    if entry["right_image"]:
        flow.extend(
            [
                Spacer(1, 4 * mm),
                Paragraph("<b>Image Target（印刷用マーカー）</b>", body),
                RLImage(entry["right_image"], width=58 * mm, height=18 * mm),
            ]
        )
    return flow


def main():
    doc = SimpleDocTemplate(
        OUT,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )

    story = [
        Paragraph("AR Experience QR Guide", title_style),
        Paragraph(
            "各QRコードをスマートフォンで読み取り、表示されるWebARページで「Start AR」をタップしてください。",
            body,
        ),
        Spacer(1, 8 * mm),
    ]

    for entry in ENTRIES:
        qr_img = RLImage(entry["qr"], width=42 * mm, height=42 * mm)
        right_flow = build_right_column(entry)
        right_table = Table([[p] for p in right_flow], colWidths=[None])
        right_table.setStyle(
            TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )

        row = Table([[qr_img, right_table]], colWidths=[48 * mm, None])
        row.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
                ]
            )
        )
        story.append(row)
        story.append(Spacer(1, 6 * mm))

    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    main()
