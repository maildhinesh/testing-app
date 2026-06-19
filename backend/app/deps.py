from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import Admin, Registration, RegistrationStatus, TestSession
from .security import decode_admin_token, utcnow


def get_current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Admin:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    admin_id = decode_admin_token(token)
    if admin_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    admin = db.get(Admin, admin_id)
    if admin is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
    return admin


def get_registration_by_magic(
    token: str,
    db: Session = Depends(get_db),
) -> Registration:
    reg = db.query(Registration).filter(Registration.magic_token == token).first()
    if reg is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid link")
    if reg.magic_token_expires and reg.magic_token_expires < utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This link has expired")
    if reg.status != RegistrationStatus.approved.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is not approved")
    return reg
