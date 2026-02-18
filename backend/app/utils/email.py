
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, body: str, is_html: bool = False):
    """
    Send an email using SMTP server.
    """
    if not settings.SMTP_EMAIL or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not set. Email not sent.")
        return False

    try:
        sender_email = settings.SMTP_EMAIL
        password = settings.SMTP_PASSWORD
        smtp_server = settings.SMTP_SERVER
        smtp_port = settings.SMTP_PORT

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = sender_email
        message["To"] = to_email

        if is_html:
            part = MIMEText(body, "html")
        else:
            part = MIMEText(body, "plain")

        message.attach(part)

        context = ssl.create_default_context()
        
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls(context=context)
            server.login(sender_email, password)
            server.sendmail(sender_email, to_email, message.as_string())
        
        logger.info(f"Email sent to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

def send_credentials_email(to_email: str, user_id: str, password: str, name: str):
    """
    Send welcome email with login credentials.
    """
    subject = "Welcome to NCERT Learning Platform - Your Login Credentials"
    
    html_body = f"""
    <html>
      <body>
        <h2>Welcome, {name}!</h2>
        <p>Your account has been created successfully.</p>
        <p>Here are your login details:</p>
        <ul>
            <li><strong>User ID:</strong> {user_id}</li>
            <li><strong>Password:</strong> {password}</li>
        </ul>
        <p>Please login and change your password immediately.</p>
        <br>
        <p>Best Regards,<br>NCERT Admin Team</p>
      </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, is_html=True)

def send_otp_email(to_email: str, otp: str):
    """
    Send OTP for password reset.
    """
    subject = "Password Reset OTP - NCERT Learning Platform"
    
    html_body = f"""
    <html>
      <body>
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password.</p>
        <p>Your One-Time Password (OTP) is:</p>
        <h1 style="color: #4F46E5; letter-spacing: 5px;">{otp}</h1>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <br>
        <p>Best Regards,<br>NCERT Admin Team</p>
      </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, is_html=True)
