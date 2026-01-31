import os
import base64
import secrets
from typing import Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

from app.models import EncryptionAlgorithm, EncryptRequest, EncryptResponse, DecryptRequest, DecryptResponse
from app.config import settings


class EncryptionService:
    def __init__(self):
        self.salt_length = settings.encryption_salt_length
        self.iterations = settings.encryption_iterations
        self.key_length = 32
        self.iv_length = 12
        self.block_size = 16

    def _derive_key(self, password: str, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.key_length,
            salt=salt,
            iterations=self.iterations,
            backend=default_backend()
        )
        return kdf.derive(password.encode('utf-8'))

    def _generate_salt(self) -> bytes:
        return secrets.token_bytes(self.salt_length)

    def _generate_iv(self, length: int = 12) -> bytes:
        return secrets.token_bytes(length)

    def encrypt_aes_gcm(self, data: bytes, password: str) -> Tuple[bytes, bytes, bytes, bytes]:
        salt = self._generate_salt()
        key = self._derive_key(password, salt)
        iv = self._generate_iv(12)
        
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(iv, data, None)
        
        encrypted_data = ciphertext[:-16]
        tag = ciphertext[-16:]
        
        return encrypted_data, salt, iv, tag

    def decrypt_aes_gcm(self, encrypted_data: bytes, password: str, salt: bytes, iv: bytes, tag: bytes) -> bytes:
        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)
        
        ciphertext_with_tag = encrypted_data + tag
        return aesgcm.decrypt(iv, ciphertext_with_tag, None)

    def encrypt_aes_cbc(self, data: bytes, password: str) -> Tuple[bytes, bytes, bytes]:
        salt = self._generate_salt()
        key = self._derive_key(password, salt)
        iv = self._generate_iv(self.block_size)
        
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(data) + padder.finalize()
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
        
        return encrypted_data, salt, iv

    def decrypt_aes_cbc(self, encrypted_data: bytes, password: str, salt: bytes, iv: bytes) -> bytes:
        key = self._derive_key(password, salt)
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(encrypted_data) + decryptor.finalize()
        
        unpadder = padding.PKCS7(128).unpadder()
        return unpadder.update(padded_data) + unpadder.finalize()

    def encrypt_chacha20(self, data: bytes, password: str) -> Tuple[bytes, bytes, bytes, bytes]:
        salt = self._generate_salt()
        key = self._derive_key(password, salt)
        nonce = self._generate_iv(12)
        
        chacha = ChaCha20Poly1305(key)
        ciphertext = chacha.encrypt(nonce, data, None)
        
        encrypted_data = ciphertext[:-16]
        tag = ciphertext[-16:]
        
        return encrypted_data, salt, nonce, tag

    def decrypt_chacha20(self, encrypted_data: bytes, password: str, salt: bytes, nonce: bytes, tag: bytes) -> bytes:
        key = self._derive_key(password, salt)
        chacha = ChaCha20Poly1305(key)
        
        ciphertext_with_tag = encrypted_data + tag
        return chacha.decrypt(nonce, ciphertext_with_tag, None)

    async def encrypt(self, request: EncryptRequest) -> EncryptResponse:
        try:
            data = request.data.encode('utf-8')
            
            if request.algorithm == EncryptionAlgorithm.AES_256_GCM:
                encrypted_data, salt, iv, tag = self.encrypt_aes_gcm(data, request.password)
                return EncryptResponse(
                    success=True,
                    encryptedData=base64.b64encode(encrypted_data).decode('utf-8'),
                    salt=base64.b64encode(salt).decode('utf-8'),
                    iv=base64.b64encode(iv).decode('utf-8'),
                    tag=base64.b64encode(tag).decode('utf-8'),
                    algorithm=request.algorithm.value
                )
            
            elif request.algorithm == EncryptionAlgorithm.AES_256_CBC:
                encrypted_data, salt, iv = self.encrypt_aes_cbc(data, request.password)
                return EncryptResponse(
                    success=True,
                    encryptedData=base64.b64encode(encrypted_data).decode('utf-8'),
                    salt=base64.b64encode(salt).decode('utf-8'),
                    iv=base64.b64encode(iv).decode('utf-8'),
                    algorithm=request.algorithm.value
                )
            
            elif request.algorithm == EncryptionAlgorithm.CHACHA20_POLY1305:
                encrypted_data, salt, nonce, tag = self.encrypt_chacha20(data, request.password)
                return EncryptResponse(
                    success=True,
                    encryptedData=base64.b64encode(encrypted_data).decode('utf-8'),
                    salt=base64.b64encode(salt).decode('utf-8'),
                    iv=base64.b64encode(nonce).decode('utf-8'),
                    tag=base64.b64encode(tag).decode('utf-8'),
                    algorithm=request.algorithm.value
                )
            
            else:
                return EncryptResponse(
                    success=False,
                    error=f"Unsupported encryption algorithm: {request.algorithm}"
                )
                
        except Exception as e:
            return EncryptResponse(
                success=False,
                error=f"Encryption failed: {str(e)}"
            )

    async def decrypt(self, request: DecryptRequest) -> DecryptResponse:
        try:
            encrypted_data = base64.b64decode(request.encryptedData)
            salt = base64.b64decode(request.salt)
            iv = base64.b64decode(request.iv)
            
            if request.algorithm == EncryptionAlgorithm.AES_256_GCM:
                if not request.tag:
                    return DecryptResponse(
                        success=False,
                        error="Tag is required for AES-GCM decryption"
                    )
                tag = base64.b64decode(request.tag)
                decrypted_data = self.decrypt_aes_gcm(encrypted_data, request.password, salt, iv, tag)
                
            elif request.algorithm == EncryptionAlgorithm.AES_256_CBC:
                decrypted_data = self.decrypt_aes_cbc(encrypted_data, request.password, salt, iv)
                
            elif request.algorithm == EncryptionAlgorithm.CHACHA20_POLY1305:
                if not request.tag:
                    return DecryptResponse(
                        success=False,
                        error="Tag is required for ChaCha20-Poly1305 decryption"
                    )
                tag = base64.b64decode(request.tag)
                decrypted_data = self.decrypt_chacha20(encrypted_data, request.password, salt, iv, tag)
                
            else:
                return DecryptResponse(
                    success=False,
                    error=f"Unsupported encryption algorithm: {request.algorithm}"
                )
            
            return DecryptResponse(
                success=True,
                data=decrypted_data.decode('utf-8')
            )
            
        except Exception as e:
            return DecryptResponse(
                success=False,
                error=f"Decryption failed: {str(e)}"
            )

    def generate_random_key(self, length: int = 32) -> str:
        return base64.b64encode(secrets.token_bytes(length)).decode('utf-8')

    def hash_password(self, password: str) -> Tuple[str, str]:
        salt = self._generate_salt()
        key = self._derive_key(password, salt)
        return base64.b64encode(key).decode('utf-8'), base64.b64encode(salt).decode('utf-8')

    def verify_password(self, password: str, hashed: str, salt: str) -> bool:
        try:
            salt_bytes = base64.b64decode(salt)
            key = self._derive_key(password, salt_bytes)
            return base64.b64encode(key).decode('utf-8') == hashed
        except Exception:
            return False


encryption_service = EncryptionService()
