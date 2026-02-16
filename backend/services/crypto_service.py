from cryptography.fernet import Fernet
from config import settings

class CryptoService:
    def __init__(self):
        # Use the encryption key from settings
        key = settings.ENCRYPTION_KEY
        
        # If key is a string, encode it; if it's already bytes, use it directly
        if isinstance(key, str):
            key = key.encode()
        
        # Ensure the key is valid base64 and 32 bytes
        try:
            self.cipher = Fernet(key)
        except Exception:
            # If the key is invalid, generate a new one
            key = Fernet.generate_key()
            self.cipher = Fernet(key)
            print(f"Warning: Invalid encryption key. Generated new key: {key.decode()}")
    
    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64 encoded result"""
        if not data:
            return ""
        
        encrypted = self.cipher.encrypt(data.encode())
        return encrypted.decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt base64 encoded data and return original string"""
        if not encrypted_data:
            return ""
        
        decrypted = self.cipher.decrypt(encrypted_data.encode())
        return decrypted.decode()

# Global crypto service instance
crypto_service = CryptoService()
