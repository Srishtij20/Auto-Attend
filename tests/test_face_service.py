import pytest
from app.services.face_service import FaceService


class TestFaceService:
    def setup_method(self):
        self.face_service = FaceService()
    
    def test_invalid_base64_image(self):
        encoding, message = self.face_service.extract_face_encoding("invalid-base64")
        assert encoding is None
        assert "Invalid" in message or "Error" in message
    
    def test_empty_known_encodings(self):
        # Test with minimal valid base64 (1x1 pixel PNG)
        employee_id, name, confidence, message = self.face_service.find_matching_face(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            []
        )
        assert employee_id is None
