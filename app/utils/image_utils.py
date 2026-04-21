import base64
import io
import numpy as np
from PIL import Image, ImageEnhance
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


def decode_base64_image(base64_string: str) -> np.ndarray:
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        image_bytes = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != "RGB":
            image = image.convert("RGB")
        return np.array(image)
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        raise ValueError(f"Invalid image data: {e}")


def preprocess_for_recognition(image: np.ndarray) -> np.ndarray:
    pil = Image.fromarray(image)
    pil = ImageEnhance.Contrast(pil).enhance(1.1)
    pil = ImageEnhance.Sharpness(pil).enhance(1.2)
    pil.thumbnail((800, 800), Image.Resampling.LANCZOS)
    return np.array(pil)


def validate_image_size(image: np.ndarray, min_size: int = 80, max_size: int = 5000) -> bool:
    h, w = image.shape[:2]
    return min_size <= w <= max_size and min_size <= h <= max_size


def numpy_to_bytes(image: np.ndarray, fmt: str = "JPEG") -> bytes:
    pil = Image.fromarray(image)
    buf = io.BytesIO()
    pil.save(buf, format=fmt, quality=85)
    return buf.getvalue()

import face_recognition

def get_face_encoding(base64_string: str):
    try:
        # Step 1: Decode image (use your existing function)
        image = decode_base64_image(base64_string)

        # Step 2: Validate size
        if not validate_image_size(image):
            return None

        # Step 3: Preprocess
        image = preprocess_for_recognition(image)

        # Step 4: Generate encoding
        encodings = face_recognition.face_encodings(image)

        if len(encodings) == 0:
            return None

        return encodings[0].tolist()

    except Exception as e:
        logger.error(f"Encoding error: {e}")
        return None