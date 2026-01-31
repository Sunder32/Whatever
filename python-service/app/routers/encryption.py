from fastapi import APIRouter, HTTPException, status
from app.models import (
    EncryptRequest, EncryptResponse,
    DecryptRequest, DecryptResponse
)
from app.services import encryption_service

router = APIRouter(prefix="/encryption", tags=["Encryption"])


@router.post("/encrypt", response_model=EncryptResponse)
async def encrypt_data(request: EncryptRequest) -> EncryptResponse:
    result = await encryption_service.encrypt(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/decrypt", response_model=DecryptResponse)
async def decrypt_data(request: DecryptRequest) -> DecryptResponse:
    result = await encryption_service.decrypt(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.get("/generate-key")
async def generate_encryption_key(length: int = 32):
    if length < 16 or length > 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Key length must be between 16 and 64 bytes"
        )
    
    key = encryption_service.generate_random_key(length)
    return {
        "success": True,
        "key": key,
        "length": length
    }


@router.post("/hash-password")
async def hash_password(password: str):
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    hashed, salt = encryption_service.hash_password(password)
    return {
        "success": True,
        "hash": hashed,
        "salt": salt
    }


@router.post("/verify-password")
async def verify_password(password: str, hashed: str, salt: str):
    is_valid = encryption_service.verify_password(password, hashed, salt)
    return {
        "success": True,
        "valid": is_valid
    }
