from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

import models
import security
from database import get_db

router = APIRouter(prefix="/export", tags=["export"])


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            fontName="Helvetica-Bold",
            fontSize=26,
            textColor=colors.HexColor("#f97316"),
            spaceAfter=8,
            spaceBefore=4,
            alignment=TA_LEFT,
            leading=32,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            fontName="Helvetica",
            fontSize=11,
            textColor=colors.HexColor("#888888"),
            spaceAfter=16,
            spaceBefore=2,
            alignment=TA_LEFT,
            leading=16,
        ),
        "section": ParagraphStyle(
            "Section",
            fontName="Helvetica-Bold",
            fontSize=14,
            textColor=colors.HexColor("#1a1a1a"),
            spaceBefore=18,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "Body",
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#333333"),
            spaceAfter=4,
            leading=15,
        ),
        "small": ParagraphStyle(
            "Small",
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.HexColor("#666666"),
            spaceAfter=3,
            leading=13,
        ),
        "stat_label": ParagraphStyle(
            "StatLabel",
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.HexColor("#888888"),
            alignment=TA_CENTER,
            spaceBefore=4,
        ),
        "stat_val": ParagraphStyle(
            "StatVal",
            fontName="Helvetica-Bold",
            fontSize=20,
            textColor=colors.HexColor("#f97316"),
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "tag": ParagraphStyle(
            "Tag",
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=colors.HexColor("#f97316"),
        ),
    }


@router.get("/report")
def export_report(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    styles = build_styles()
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    W = A4[0] - 40 * mm  # usable width
    story = []

    # ── Header ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 4))
    story.append(Paragraph("DevTrack", styles["title"]))
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            f"Learning Report for <b>{current_user.username}</b> · Generated {datetime.now().strftime('%B %d, %Y')}",
            styles["subtitle"],
        )
    )
    story.append(Spacer(1, 4))
    story.append(
        HRFlowable(
            width=W, thickness=1, color=colors.HexColor("#f97316"), spaceAfter=16
        )
    )

    # ── Stats ─────────────────────────────────────────────────────────────────
    total_mins = (
        db.query(func.sum(models.Log.time_spent))
        .filter(models.Log.user_id == current_user.id)
        .scalar()
        or 0
    )
    total_logs = (
        db.query(models.Log).filter(models.Log.user_id == current_user.id).count()
    )
    topics_total = (
        db.query(models.Topic).filter(models.Topic.owner_id == current_user.id).count()
    )
    mastered = (
        db.query(models.Topic)
        .filter(
            models.Topic.owner_id == current_user.id,
            models.Topic.status == models.StatusEnum.mastered,
        )
        .count()
    )
    resources_cnt = (
        db.query(models.Resource)
        .filter(models.Resource.owner_id == current_user.id)
        .count()
    )
    goals_done = (
        db.query(models.Goal)
        .filter(
            models.Goal.owner_id == current_user.id, models.Goal.is_completed == True
        )
        .count()
    )

    # Define col_width for stats
    col_width = W / 3

    # Define stat_cell with proper styling
    def stat_cell(val, label):
        # Use a simple list with paragraphs - let table padding handle spacing
        return [
            Paragraph(str(val), styles["stat_val"]),
            Paragraph(label, styles["stat_label"]),
        ]

    # Create 2x3 grid for stats
    stat_data = [
        [
            stat_cell(f"{round(total_mins/60,1)}h", "Total Hours"),
            stat_cell(total_logs, "Sessions"),
            stat_cell(topics_total, "Topics"),
        ],
        [
            stat_cell(mastered, "Mastered"),
            stat_cell(resources_cnt, "Resources"),
            stat_cell(goals_done, "Goals Done"),
        ],
    ]

    stat_table = Table(stat_data, colWidths=[col_width, col_width, col_width])

    stat_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff8f4")),
                ("ROUNDEDCORNERS", [6]),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#f97316")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#fde8d8")),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, 0), 16),  # More top padding for first row
                ("BOTTOMPADDING", (0, 1), (-1, 1), 12),  # Bottom padding for second row
            ]
        )
    )
    story.append(stat_table)
    story.append(Spacer(1, 24))

    # ── Topics (Fetch topics first for later use) ────────────────────────────
    topics = (
        db.query(models.Topic)
        .filter(models.Topic.owner_id == current_user.id)
        .order_by(models.Topic.status)
        .all()
    )

    if topics:
        story.append(Paragraph("Topics", styles["section"]))
        story.append(
            HRFlowable(
                width=W, thickness=0.5, color=colors.HexColor("#eeeeee"), spaceAfter=8
            )
        )

        STATUS_LABEL = {
            "to_learn": "To Learn",
            "learning": "Learning",
            "mastered": "Mastered",
        }
        DIFF_LABEL = {
            "beginner": "Beginner",
            "intermediate": "Intermediate",
            "advanced": "Advanced",
        }

        t_data = [["Topic", "Status", "Difficulty", "Hours Logged"]]
        for t in topics:
            mins = (
                db.query(func.sum(models.Log.time_spent))
                .filter(
                    models.Log.topic_id == t.id,
                    models.Log.user_id == current_user.id,
                )
                .scalar()
                or 0
            )
            t_data.append(
                [
                    Paragraph(t.title, styles["body"]),
                    STATUS_LABEL.get(t.status.value, t.status.value),
                    DIFF_LABEL.get(t.difficulty.value, t.difficulty.value),
                    f"{round(mins/60,1)}h",
                ]
            )

        col_w = [W * 0.45, W * 0.18, W * 0.18, W * 0.19]
        t_table = Table(t_data, colWidths=col_w, repeatRows=1)
        t_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f97316")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 1), (-1, -1), 9),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#fafafa")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e0e0e0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(t_table)
        story.append(Spacer(1, 16))

    # ── Recent logs ───────────────────────────────────────────────────────────
    logs = (
        db.query(models.Log)
        .filter(models.Log.user_id == current_user.id)
        .order_by(models.Log.date.desc())
        .limit(15)
        .all()
    )

    if logs:
        story.append(Paragraph("Recent Learning Sessions", styles["section"]))
        story.append(
            HRFlowable(
                width=W, thickness=0.5, color=colors.HexColor("#eeeeee"), spaceAfter=8
            )
        )

        # Create topic map (even if no topics exist)
        topic_map = {t.id: t.title for t in topics}

        for log in logs:
            h = log.time_spent // 60
            m = log.time_spent % 60
            time_str = f"{h}h {m}m" if h else f"{m}m"
            topic_name = topic_map.get(log.topic_id, "—")
            date_str = log.date.strftime("%b %d, %Y")

            header = Table(
                [
                    [
                        Paragraph(f"<b>{topic_name}</b>", styles["body"]),
                        Paragraph(f"{date_str} · {time_str}", styles["small"]),
                    ]
                ],
                colWidths=[W * 0.65, W * 0.35],
            )
            header.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f9f9f9")),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("BOX", (0, 0), (-1, -1), 0.3, colors.HexColor("#eeeeee")),
                    ]
                )
            )

            notes_text = log.notes[:400] + ("..." if len(log.notes) > 400 else "")
            notes = Paragraph(notes_text, styles["small"])

            story.append(KeepTogether([header, notes, Spacer(1, 6)]))

    # ── Goals ─────────────────────────────────────────────────────────────────
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.owner_id == current_user.id)
        .order_by(models.Goal.is_completed.asc(), models.Goal.created_at.desc())
        .all()
    )

    if goals:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Goals", styles["section"]))
        story.append(
            HRFlowable(
                width=W, thickness=0.5, color=colors.HexColor("#eeeeee"), spaceAfter=8
            )
        )

        g_data = [["Goal", "Status", "Target Hours", "Deadline"]]
        for g in goals:
            status = "✓ Done" if g.is_completed else "Active"
            target = f"{g.target_hours}h" if g.target_hours else "—"
            deadline = g.target_date.strftime("%b %d, %Y") if g.target_date else "—"
            g_data.append(
                [
                    Paragraph(g.title, styles["body"]),
                    status,
                    target,
                    deadline,
                ]
            )

        g_table = Table(
            g_data, colWidths=[W * 0.45, W * 0.18, W * 0.18, W * 0.19], repeatRows=1
        )
        g_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#333333")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 1), (-1, -1), 9),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#fafafa")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e0e0e0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(g_table)

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 24))
    story.append(
        HRFlowable(
            width=W, thickness=0.5, color=colors.HexColor("#eeeeee"), spaceAfter=8
        )
    )
    story.append(
        Paragraph(
            f"Generated by DevTrack · {datetime.now().strftime('%B %d, %Y at %H:%M')}",
            styles["small"],
        )
    )

    doc.build(story)
    buf.seek(0)

    filename = f"devtrack-report-{current_user.username}-{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
