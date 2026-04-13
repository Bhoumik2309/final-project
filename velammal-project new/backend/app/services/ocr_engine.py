import cv2
import numpy as np
import base64
import json
import os
import logging
from groq import Groq
from dotenv import load_dotenv

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load settings from .env
load_dotenv()

class OCREngine:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client = Groq(api_key=self.api_key) if self.api_key else None
        if not self.client:
            logger.warning("GROQ_API_KEY not found. OCR will not work.")

    def _preprocess_image(self, image_bytes):
        """Pre-process image for better OCR readability (Focus on Red Ink)."""
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None: 
            return None

        # --- UPGRADE: Dynamic Resizing for API Speed and Stability ---
        max_dim = 1200
        h, w = img.shape[:2]
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        # Pre-process for OCR (Isolating red ink)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Dual-Hue Red Masking (to catch all variations of red ink)
        lower_red1 = np.array([0, 50, 50])
        upper_red1 = np.array([10, 255, 255])
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        
        lower_red2 = np.array([170, 50, 50])
        upper_red2 = np.array([180, 255, 255])
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        
        red_mask = cv2.bitwise_or(mask1, mask2)
        
        # Stroke Dilation to thicken faint handwriting
        kernel = np.ones((2,2), np.uint8)
        red_mask = cv2.dilate(red_mask, kernel, iterations=1)
        
        # Apply the mask over a dimmed background
        dimmed = cv2.addWeighted(img, 0.4, np.zeros(img.shape, img.dtype), 0, 0)
        dimmed[red_mask > 0] = img[red_mask > 0]
        
        # Encode with optimized quality (80 for size stability)
        _, buffer = cv2.imencode('.jpg', dimmed, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return base64.b64encode(buffer).decode('utf-8')

    def extract_data_with_groq(self, image_bytes, exam_format=None):
        """Advanced function to extract registration number and marks using Groq Vision."""
        if not self.client:
            return {"status": "error", "message": "GROQ_API_KEY not found"}

        img_b64 = self._preprocess_image(image_bytes)
        if not img_b64:
            return {"status": "error", "message": "Image pre-processing failed"}

        # Dynamic context based on exam format
        format_info = ""
        if exam_format:
            format_info = f"This is a {exam_format.get('exam_type', 'University')} exam with a total of {exam_format.get('total_marks', 100)} marks."

        prompt = f"""
        Return ONLY JSON. You are a strict university OCR system specialized in reading hand-written student marks (usually in RED INK).
        {format_info}
        
        Extract the following:
        - registration_number: The 12-digit student ID.
        - part_a: dictionary for q1, q2, q3, q4, q5, q6, q7, q8, q9, q10. (Value MUST be an integer).
        - part_b: dictionary for q11, q12, q13, q14, q15. (Value MUST be an integer - if sub-marks exist, return the sum of all parts like a,b,c).
        - q16: final question mark as an integer.
        - grand_total: the circled total at the bottom as an integer.
        
        CRITICAL RULES:
        1. Look specifically for marks written in RED ink inside tables.
        2. Use ONLY integers for values. If a mark is blank or illegible, use 0.
        3. Ensure the keys are exactly 'q1', 'q2', etc.
        """

        try:
            logger.info("Sending request to Groq Vision...")
            response = self.client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]}],
                response_format={"type": "json_object"},
                temperature=0.0
            )
            result = json.loads(response.choices[0].message.content)
            logger.info(f"GROQ RESPONSE: {json.dumps(result, indent=2)}")
            return result
        except Exception as e:
            logger.error(f"Groq API Error: {str(e)}")
            return {"status": "error", "message": f"API Error: {str(e)}"}

    def process_exam_sheet(self, image_paths, exam_format=None, reg_prefix=""):
        """Process multiple pages and return normalized result."""
        if not image_paths:
            return {"status": "error", "message": "No images provided"}

        # Process the first page for main data
        logger.info(f"Processing student sheet: {image_paths[0]}")
        with open(image_paths[0], "rb") as f:
            first_page_bytes = f.read()
        
        raw_result = self.extract_data_with_groq(first_page_bytes, exam_format)
        
        if "status" in raw_result and raw_result["status"] == "error":
            return raw_result

        # Helper to normalize keys and ensure integers
        def normalize_marks(data):
            normalized = {}
            if not isinstance(data, dict):
                return normalized
            for k, v in data.items():
                # Extract digits from key (e.g., "q1" or "Question 1" -> "q1")
                import re
                nums = re.findall(r'\d+', k)
                new_key = f"q{nums[0]}" if nums else k.lower()
                
                # Ensure value is integer
                try:
                    normalized[new_key] = int(v) if v is not None else 0
                except (ValueError, TypeError):
                    normalized[new_key] = 0
            return normalized

        part_a = normalize_marks(raw_result.get("part_a", {}))
        part_b = normalize_marks(raw_result.get("part_b", {}))
        
        # Handle q16 separately or as part of part_b depending on format
        q16_val = raw_result.get("q16", 0)
        try:
            q16 = int(q16_val) if q16_val is not None else 0
        except:
            q16 = 0
        
        # Calculate totals
        part_a_total = sum(part_a.values())
        part_b_total = sum(part_b.values())
        
        # Final formatting
        grand_total = raw_result.get("grand_total")
        try:
            grand_total = int(grand_total) if grand_total is not None else (part_a_total + part_b_total + q16)
        except:
            grand_total = part_a_total + part_b_total + q16

        return {
            "registration_number": raw_result.get("registration_number", ""),
            "marks_obtained": grand_total,
            "confidence": 0.95,
            "page_count": len(image_paths),
            "engine": "Groq-Llama-4-Vision",
            "part_a_marks": part_a,
            "part_bc_marks": {**part_b, "q16": q16},
            "course_outcomes": {},
            "part_a_total": part_a_total,
            "part_bc_total": part_b_total + q16,
            "grand_total": grand_total,
            "written_totals": {
                "part_a": part_a_total,
                "part_bc": part_b_total + q16
            }
        }

# Export instance for use in routes
ocr_engine = OCREngine()