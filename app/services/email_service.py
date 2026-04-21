import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any
from datetime import datetime
import os

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")


# Sends an email using configured SMTP server
def _send(to: str, subject: str, html: str):
    if not SMTP_HOST or not SMTP_USER:
        logger.warning("SMTP not configured — skipping email")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM or SMTP_USER
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to, msg.as_string())

        logger.info(f"Email sent to {to}")
    except Exception as e:
        logger.error(f"Email failed to {to}: {e}")


# Sends absence alert emails to parents for students marked absent
async def send_absence_alerts(absent_students: List[Dict], session: Dict[str, Any]):
    date = session.get("date", datetime.utcnow().strftime("%Y-%m-%d"))
    subject_name = session.get("subject", "class")
    class_name = session.get("class_name", "")

    for student in absent_students:
        parent_email = student.get("parent_email")
        if not parent_email:
            continue

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
          <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0">Attendance Alert</h2>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
            <p>Dear Parent/Guardian,</p>
            <p>This is to inform you that <strong>{student['full_name']}</strong>
            was <strong style="color:#dc2626">absent</strong> from
            <strong>{subject_name}</strong> ({class_name}) on <strong>{date}</strong>.</p>
            <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px;margin:16px 0">
              <strong>Student:</strong> {student['full_name']}<br/>
              <strong>Class:</strong> {class_name}<br/>
              <strong>Subject:</strong> {subject_name}<br/>
              <strong>Date:</strong> {date}
            </div>
            <p style="color:#6b7280;font-size:13px">
              Please contact the school if you have any questions.<br/>
              — Auto-Attend System
            </p>
          </div>
        </div>
        """
        _send(parent_email, f"Absence Alert — {student['full_name']} — {date}", html)


# Sends daily attendance summary email to admin
async def send_daily_summary(admin_email: str, date: str, stats: Dict):
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e1b4b;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">Daily Attendance Summary</h2>
        <p style="color:#a5b4fc;margin:4px 0 0">{date}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          <div style="text-align:center;background:#f0fdf4;padding:16px;border-radius:8px">
            <div style="font-size:28px;font-weight:700;color:#16a34a">{stats.get('present',0)}</div>
            <div style="color:#16a34a;font-size:12px">Present</div>
          </div>
          <div style="text-align:center;background:#fef2f2;padding:16px;border-radius:8px">
            <div style="font-size:28px;font-weight:700;color:#dc2626">{stats.get('absent',0)}</div>
            <div style="color:#dc2626;font-size:12px">Absent</div>
          </div>
          <div style="text-align:center;background:#eff6ff;padding:16px;border-radius:8px">
            <div style="font-size:28px;font-weight:700;color:#2563eb">{stats.get('percentage',0)}%</div>
            <div style="color:#2563eb;font-size:12px">Attendance</div>
          </div>
        </div>
        <p style="color:#6b7280;font-size:13px">— Auto-Attend System</p>
      </div>
    </div>
    """
    _send(admin_email, f"Daily Attendance Summary — {date}", html)