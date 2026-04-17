import face_recognition
import numpy as np
import cv2
import time
from typing import List, Optional, Tuple, Dict
import logging
from app.config import get_settings
from app.utils.image_utils import (
    decode_base64_image, validate_image_size, preprocess_for_recognition
)

logger = logging.getLogger(__name__)
settings = get_settings()

def is_blurry(image, threshold=100):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var() < threshold

class FaceService:
    def __init__(self):
        self.tolerance = settings.face_recognition_tolerance
        self.min_confidence = settings.min_face_confidence
        self.top_n = settings.face_voting_top_n
        self.max_photos = settings.max_photos_per_employee

    def extract_face_encoding(
        self, image_data: str
    ) -> Tuple[Optional[List[float]], str]:
        try:
            image = decode_base64_image(image_data)
            if not validate_image_size(image):
                return None, "Image dimensions invalid (min 80px, max 5000px)"

            image = preprocess_for_recognition(image)
            locations = face_recognition.face_locations(image, model="hog")

            if not locations:
                return None, "No face detected — ensure face is clearly visible"
            if len(locations) > 1:
                return None, f"Multiple faces detected ({len(locations)}) — use a single-person photo"

            encodings = face_recognition.face_encodings(image, locations, num_jitters=2)
            if not encodings:
                return None, "Could not extract face features — use a clearer photo"

            return encodings[0].tolist(), "Face encoding extracted successfully"

        except ValueError as e:
            return None, str(e)
        except Exception as e:
            logger.error(f"extract_face_encoding error: {e}")
            return None, f"Error processing image: {e}"

    def find_matching_face(
        self,
        image_data: str,
        known_encodings: List[Tuple[str, str, List[List[float]]]],
    ) -> Tuple[Optional[str], Optional[str], float, str]:
        try:
            image = decode_base64_image(image_data)
            if not validate_image_size(image):
                return None, None, 0.0, "Invalid image dimensions"

            image = preprocess_for_recognition(image)
            locations = face_recognition.face_locations(image, model="hog")

            if not locations:
                return None, None, 0.0, "No face detected in the image"
            if len(locations) > 1:
                return None, None, 0.0, "Multiple faces detected"

            face_encs = face_recognition.face_encodings(image, locations, num_jitters=1)
            if not face_encs:
                return None, None, 0.0, "Could not extract face features"

            unknown = face_encs[0]
            scores: Dict[str, Dict] = {}

            for emp_id, emp_name, encodings in known_encodings:
                if not encodings:
                    continue

                known_np = np.array(encodings)
                distances = face_recognition.face_distance(known_np, unknown)
                good = distances[distances <= self.tolerance]

                if len(good) == 0:
                    continue

                if self.top_n > 0:
                    good = np.sort(good)[: self.top_n]

                scores[emp_id] = {
                    "name": emp_name,
                    "votes": len(good),
                    "confidence": float(1 - np.mean(good)),
                }

            if not scores:
                return None, None, 0.0, "No matching face found in the database"

            best_id = max(
                scores,
                key=lambda k: (scores[k]["votes"], scores[k]["confidence"]),
            )
            best = scores[best_id]

            if best["confidence"] < self.min_confidence:
                return (
                    None, None,
                    round(best["confidence"], 4),
                    f"Confidence too low ({best['confidence']:.1%}) — try better lighting",
                )

            return (
                best_id,
                best["name"],
                round(best["confidence"], 4),
                "Face matched successfully",
            )

        except ValueError as e:
            return None, None, 0.0, str(e)
        except Exception as e:
            logger.error(f"find_matching_face error: {e}")
            return None, None, 0.0, f"Error processing image: {e}"

    def is_duplicate_encoding(
        self,
        new_encoding: List[float],
        existing_encodings: List[List[float]],
        threshold: float = 0.35,
    ) -> bool:
        if not existing_encodings:
            return False
        known_np = np.array(existing_encodings)
        distances = face_recognition.face_distance(known_np, np.array(new_encoding))
        return bool(np.min(distances) < threshold)


face_service = FaceService()


def get_face_service() -> FaceService:
    return face_service