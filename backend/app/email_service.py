import logging
import smtplib
from email.message import EmailMessage

from .config import settings

logger = logging.getLogger("email")


def _send(to_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info("Sent email to %s: %s", to_email, subject)
    except Exception:  # noqa: BLE001 - do not crash the request on email failure
        # Log full details and the body (so dev environments without SMTP can still proceed).
        logger.exception("Failed to send email to %s. Subject=%s\nBody:\n%s", to_email, subject, body)


def send_verification_email(to_email: str, first_name: str, token: str) -> None:
    link = f"{settings.frontend_base_url}/verify-email?token={token}"
    body = (
        f"Hello {first_name},\n\n"
        "Thank you for registering for the Tamil Knowledge Test.\n"
        "Please confirm your email address by opening the link below:\n\n"
        f"{link}\n\n"
        "After verification, the test administrator will review your registration.\n\n"
        "Tamil Test Team"
    )
    _send(to_email, "Confirm your email — Tamil Knowledge Test", body)


def send_magic_link_email(to_email: str, first_name: str, token: str, test_name: str) -> None:
    link = f"{settings.frontend_base_url}/take-test?token={token}"
    body = (
        f"Hello {first_name},\n\n"
        f"The test \"{test_name}\" has been released to you.\n"
        "Use the secure one-time link below to begin:\n\n"
        f"{link}\n\n"
        "Do not share this link. Good luck!\n\n"
        "Tamil Test Team"
    )
    _send(to_email, f"Your test is ready — {test_name}", body)


def send_scores_email(to_email: str, first_name: str, token: str, test_name: str) -> None:
    link = f"{settings.frontend_base_url}/take-test?token={token}"
    body = (
        f"Hello {first_name},\n\n"
        f"Your results for \"{test_name}\" have been released.\n"
        "View them using your link below:\n\n"
        f"{link}\n\n"
        "Tamil Test Team"
    )
    _send(to_email, f"Your results are available — {test_name}", body)
