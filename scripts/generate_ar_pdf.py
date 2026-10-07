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
        "qr": f"{ASSETS}/e7ce8c8a-b99d-4379-b4da-4931e282bb48.png",
        "url": "https://splattic-ar-test-3277b1.gitlab.io/",
        "title": "box_robo — World AR",
        "desc_ja": (
            "8th WallのWorld Tracking（SLAM）を使い、床や机などの平面を認識してから"
            "タップで3Dキャラクター「box_robo」を現実空間に配置する体験です。"
            "配置後は周囲を歩き回ってモデルをさまざまな角度から眺められます。"
        ),
        "right_image": None,
    },
    {
        "category": "Slam-Base AR Experience",
        "qr": f"{ASSETS}/04f2e550-c69a-433d-a134-a1c3bdda7286.png",
        "url": "https://splat-garden-de068c.gitlab.io/",
        "title": "splatGarden — World AR",
        "desc_ja": (
            "Gaussian Splatで表現された「ガーデン」コンテンツを、認識した平面の上に"
            "配置して眺めるSLAMベースのWebARです。スマートフォンを動かすと、"
            "高精細なスプラット表現の奥行きや光の変化を体感できます。"
        ),
        "right_image": None,
    },
    {
        "category": "Slam-Base AR Experience",
        "qr": f"{ASSETS}/6b67bd51-5f3f-46df-b98e-b4d5c439e9fc.png",
        "url": "https://tactic-sizzle-reel-5611ed.gitlab.io/",
        "title": "VideoScreen — World AR（TACTIC）",
        "desc_ja": (
            "TACTICブランドのプロモーション映像を、空間内の仮想スクリーンとして"
            "配置するWorld AR体験です。平面を検出したあと、好きな位置に"
            "ビデオパネルを置き、周囲から映像を見ることができます。"
        ),
        "right_image": None,
    },
    {
        "category": "Image-base AR Experience",
        "qr": f"{ASSETS}/9e256002-9dbe-493c-8cd0-317666b1072a.png",
        "url": "https://tacticbot-dance-b22377.gitlab.io/",
        "title": "VideoScreen — Image AR（Tacticbot Dance）",
        "desc_ja": (
            "右側のSplatticロゴ（Image Target）を印刷または画面表示し、"
            "QRコードから開いたページで「Start AR」のあとカメラをロゴに向ける"
            "Image Tracking型の体験です。マーカー上にTacticbotのダンス映像が"
            "重なって再生されます。"
        ),
        "right_image": f"{ASSETS}/203a5bff-1bf9-4799-976a-f2c3aed57b17.png",
    },
]


def build_right_column(entry):
    flow = [
        Paragraph(f"<b>{entry['category']}</b>", section_title),
        Paragraph(entry["title"], body),
        Paragraph(entry["desc_ja"], body),
        Paragraph(f"<b>URL:</b> {entry['url']}", url_style),
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
