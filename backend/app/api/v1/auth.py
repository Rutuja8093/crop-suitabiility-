from typing import Optional
from fastapi import APIRouter, Depends, Header, Cookie, Response, status, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import GatLoginRequest, RegisterRequest, AuthResponse, SessionUserResponse
from app.services.auth_service import auth_service, AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])

COOKIE_NAME = "soilpilot_session"


def extract_token(
    authorization: Optional[str] = Header(None),
    soilpilot_session: Optional[str] = Cookie(None),
) -> Optional[str]:
    """Helper to extract token from Bearer Authorization header or HttpOnly session cookie."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    if soilpilot_session:
        return soilpilot_session.strip()
    return None


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Farmer Registration with Gat Number",
    description="Registers a new farmer, associates their cadastral Gat Number permanently in profile and database, and returns session token.",
)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    auth_result = auth_service.register(db, payload)

    response.set_cookie(
        key=COOKIE_NAME,
        value=auth_result.token,
        max_age=AuthService.TOKEN_EXPIRY_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return auth_result


@router.post(
    "/gat-login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Farmer Gat-Based Access / Login",
    description="Identifies and grants access to a farmer using administrative hierarchy (State -> District -> Taluka -> Village) and cadastral Gat Number.",
)
@router.post(
    "/gat-access",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Farmer Gat-Based Access alias",
    include_in_schema=False,
)
@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Farmer Access / Login",
    include_in_schema=False,
)
def gat_login(
    payload: GatLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    auth_result = auth_service.gat_login(db, payload)

    # Set secure HttpOnly session cookie for seamless browser session management
    response.set_cookie(
        key=COOKIE_NAME,
        value=auth_result.token,
        max_age=AuthService.TOKEN_EXPIRY_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
        path="/",
    )

    return auth_result


@router.get(
    "/me",
    response_model=SessionUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current Farmer Session",
    description="Returns verified farm and farmer profile for the current session. Used to restore state after browser refresh.",
)
def get_current_session(
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
) -> SessionUserResponse:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session found. Please enter your farm details.",
        )
    return auth_service.get_session_profile(db, token)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Farmer Logout",
    description="Clears active session cookie and logs out the farmer.",
)
def logout(response: Response) -> dict:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        samesite="lax",
    )
    return {"success": True, "message": "Logged out successfully"}
