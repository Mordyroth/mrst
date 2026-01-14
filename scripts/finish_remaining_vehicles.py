#!/usr/bin/env python3
"""
Finish remaining vehicle images with Imagen 4 + transparent backgrounds
Run this when quota resets (midnight Pacific time)
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from rembg import remove
from PIL import Image

env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)

from google import genai
from google.genai import types

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL_ID = "imagen-4.0-generate-preview-06-06"
OUTPUT_DIR = Path(__file__).parent.parent / "apps/web/public/images/vehicles"
LOG_FILE = Path(__file__).parent / "finish_remaining.log"

PROMPT_TEMPLATE = """Professional automotive photography of a {year} {make} {model} in {color}. Three-quarter front view, 45 degrees from front-left corner, slightly elevated perspective showing hood and roofline elegantly. Vehicle perfectly straight, all four wheels clearly visible, slight wheel turn toward camera for dynamic feel. Professional studio lighting, soft diffused light from above-left, subtle rim lighting on edges, gentle shadow beneath vehicle for grounding. Pure clean white background, completely isolated vehicle, no environment, no reflections. Ultra photorealistic, sharp focus, high-end dealership catalog quality. No text, no watermarks, no logos."""

# Remaining vehicles that failed due to quota
REMAINING = [
    {'unit': 'V387', 'year': 2024, 'make': 'Mazda', 'model': 'Cx-30', 'color': 'Gray'},
    {'unit': 'V389', 'year': 2024, 'make': 'Acura', 'model': 'MDX', 'color': 'Black'},
    {'unit': 'V390', 'year': 2022, 'make': 'Toyota', 'model': 'RAV4', 'color': 'Gray'},
    {'unit': 'V391', 'year': 2025, 'make': 'Kia', 'model': 'Telluride S', 'color': 'Blue'},
    {'unit': 'V392', 'year': 2025, 'make': 'Hyundai', 'model': 'Tucson', 'color': 'Silver'},
    {'unit': 'V393', 'year': 2025, 'make': 'Audi', 'model': 'Q7', 'color': 'White'},
    {'unit': 'V394', 'year': 2024, 'make': 'Mazda', 'model': 'CX-90', 'color': 'Blue'},
    {'unit': 'V396', 'year': 2025, 'make': 'Ford', 'model': 'Escape', 'color': 'White'},
    {'unit': 'V397', 'year': 2024, 'make': 'Toyota', 'model': 'Grand Highlander', 'color': 'Black'},
    {'unit': 'V400', 'year': 2025, 'make': 'Honda', 'model': 'Odyssey EX-L', 'color': 'Gray'},
    {'unit': 'V401', 'year': 2023, 'make': 'Audi', 'model': 'A8 L', 'color': 'Black'},
    {'unit': 'V402', 'year': 2024, 'make': 'Ford', 'model': 'Expedition', 'color': 'Black'},
    {'unit': 'V403', 'year': 2023, 'make': 'Ram', 'model': '1500', 'color': 'Black'},
    {'unit': 'V404', 'year': 2023, 'make': 'Honda', 'model': 'Accord', 'color': 'White'},
    {'unit': 'V407', 'year': 2023, 'make': 'BMW', 'model': 'X5', 'color': 'White'},
    {'unit': 'V408', 'year': 2019, 'make': 'Toyota', 'model': 'Camry', 'color': 'White'},
    {'unit': 'V409', 'year': 2025, 'make': 'Kia', 'model': 'Telluride Ex', 'color': 'Brown'},
    {'unit': 'V410', 'year': 2023, 'make': 'Honda', 'model': 'Odyssey Touring', 'color': 'White'},
    {'unit': 'V411', 'year': 2025, 'make': 'Volvo', 'model': 'XC90', 'color': 'Blue'},
    {'unit': 'V412', 'year': 2024, 'make': 'Honda', 'model': 'Pilot', 'color': 'Sonic Gray'},
    {'unit': 'V414', 'year': 2026, 'make': 'Hyundai', 'model': 'Tucson', 'color': 'Silver'},
    {'unit': 'V60', 'year': 2020, 'make': 'GMC', 'model': 'Acadia', 'color': 'White'},
    {'unit': 'Z201', 'year': 2020, 'make': 'Honda', 'model': 'Odyssey', 'color': 'Black'},
]


def log(msg):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"{timestamp} - {msg}"
    print(line)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')


def generate_image(vehicle):
    client = genai.Client(api_key=GOOGLE_API_KEY)
    prompt = PROMPT_TEMPLATE.format(**vehicle)
    try:
        response = client.models.generate_images(
            model=MODEL_ID,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
                safety_filter_level="BLOCK_LOW_AND_ABOVE",
            )
        )
        if response.generated_images:
            return response.generated_images[0].image.image_bytes
        return None
    except Exception as e:
        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
            log(f"Quota still exhausted, will retry later")
            return "QUOTA_EXHAUSTED"
        log(f"ERROR generating: {e}")
        return None


def zoom_crop(img_path):
    img = Image.open(img_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    bbox = img.getbbox()
    if bbox:
        cropped = img.crop(bbox)
        pad_x = int(cropped.width * 0.05)
        pad_y = int(cropped.height * 0.05)
        new_width = cropped.width + (pad_x * 2)
        new_height = cropped.height + (pad_y * 2)
        final = Image.new('RGBA', (new_width, new_height), (0, 0, 0, 0))
        final.paste(cropped, (pad_x, pad_y))
        final.save(img_path, 'PNG')


def main():
    log("=" * 60)
    log("Starting remaining vehicle image generation")
    log(f"Vehicles to process: {len(REMAINING)}")

    success = 0
    failed = []
    quota_hit = False

    for i, v in enumerate(REMAINING, 1):
        unit = v['unit']

        # Check if already exists and is transparent
        img_path = OUTPUT_DIR / f"{unit}.png"
        if img_path.exists():
            try:
                img = Image.open(img_path)
                if img.mode == 'RGBA':
                    log(f"[{i:2}/{len(REMAINING)}] {unit} - Already done, skipping")
                    success += 1
                    continue
            except:
                pass

        log(f"[{i:2}/{len(REMAINING)}] {unit} - {v['year']} {v['make']} {v['model']} ({v['color']})")

        # Generate
        image_data = generate_image(v)

        if image_data == "QUOTA_EXHAUSTED":
            quota_hit = True
            failed.append(unit)
            log("Stopping - quota exhausted")
            break

        if not image_data:
            failed.append(unit)
            continue

        # Remove background
        try:
            transparent_data = remove(image_data)
        except Exception as e:
            failed.append(unit)
            log(f"  ERROR removing bg: {e}")
            continue

        # Save
        with open(img_path, "wb") as f:
            f.write(transparent_data)

        # Zoom
        try:
            zoom_crop(img_path)
        except Exception as e:
            log(f"  WARN zoom: {e}")

        success += 1
        log(f"  OK")

        if i < len(REMAINING):
            time.sleep(3)  # Slightly longer delay

    log("=" * 60)
    log(f"Complete! Success: {success}, Failed: {len(failed)}")
    if failed:
        log(f"Failed: {failed}")
    if quota_hit:
        log("Quota was hit - cron will retry later")
        sys.exit(1)  # Exit with error so we know to retry

    # All done - remove from cron
    if not failed:
        log("All vehicles complete! Removing cron job.")
        os.system('crontab -l 2>/dev/null | grep -v "finish_remaining_vehicles.py" | crontab -')


if __name__ == "__main__":
    main()
