"""
Email utility module using Resend API.
Sends welcome credentials and OTP emails via Resend.
"""

import requests
import time
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """
    Send an email via Resend API using requests with retry logic.
    Returns True on success, False on failure.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set. Email not sent.")
        return False

    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Brainwave-Backend/1.0",
    }
    
    payload = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }

    max_retries = 3
    retry_delay = 1.0

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                RESEND_API_URL,
                headers=headers,
                json=payload,
                timeout=10.0,
            )

            if response.status_code == 200:
                logger.info(f"Email sent to {to_email} (Resend)")
                return True
            else:
                logger.error(f"Resend API error ({response.status_code}): {response.text}")
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    return False
        
        except requests.exceptions.RequestException as e:
            logger.warning(f"Email attempt {attempt}/{max_retries} failed for {to_email}: {e}")
            if attempt < max_retries:
                time.sleep(retry_delay)
            else:
                logger.error(f"All {max_retries} email attempts failed for {to_email}.")
                return False

    return False

def send_credentials_email(to_email: str, password: str, name: str) -> bool:
    """
    Send welcome email with login credentials to a new user.
    """
    subject = "Welcome to The Brainwave - Your Login Credentials"

    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ef4444; font-size: 22px; margin: 0;">THE BRAINWAVE</h1>
        <p style="color: #9ca3af; font-size: 11px; margin-top: 4px; letter-spacing: 2px;">NCERT LEARNING PLATFORM</p>
      </div>
      <h2 style="color: #111827; font-size: 18px;">Welcome, {name}!</h2>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        Your account has been created. Use your email and the password below to sign in:
      </p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="color: #6b7280; padding: 4px 0;">Email</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">{to_email}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 4px 0;">Password</td>
            <td style="color: #111827; font-weight: 600; text-align: right;">{password}</td>
          </tr>
        </table>
      </div>
      <p style="color: #ef4444; font-size: 13px; font-weight: 500;">
        Please change your password after your first login.
      </p>

      <button style="background: #ef4444; color: #ffffff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;"> <a href="https://micro-learning.app/" style="color: #ffffff; text-decoration: none;">Login Now</a> </button>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        <center>
      <img src="https://teammistake.com/TeamMistakeLogo.png" alt="TeamMistake" style="height: 16px; vertical-align: middle; margin-right: 4px;" /> TeamMistake
      </center>
      </p>
    </div>
    """

    return _send_email(to_email, subject, html_body)


def send_otp_email(to_email: str, otp: str) -> bool:
    """
    Send OTP email for password reset.
    """
    subject = "Password Reset OTP - The Brainwave"

    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ef4444; font-size: 22px; margin: 0;">THE BRAINWAVE</h1>
        <p style="color: #9ca3af; font-size: 11px; margin-top: 4px; letter-spacing: 2px;">NCERT LEARNING PLATFORM</p>
      </div>
      <h2 style="color: #111827; font-size: 18px;">Password Reset</h2>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        You requested to reset your password. Use the OTP below:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background: #f0f0ff; border: 2px solid #4f46e5; border-radius: 8px; padding: 12px 32px; font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #4f46e5;">
          {otp}
        </span>
      </div>
      <p style="color: #6b7280; font-size: 13px; text-align: center;">
        This code expires in <strong>10 minutes</strong>.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
        If you did not request this, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        <center>
        <img src="https://teammistake.com/TeamMistakeLogo.png" alt="TeamMistake" style="height: 16px; vertical-align: middle; margin-right: 4px;" /> TeamMistake
        </center>
      </p>
    </div>
    """

    return _send_email(to_email, subject, html_body)
