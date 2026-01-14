#!/usr/bin/env python3
"""
Uniform Vehicle Image Generator
Generates consistent AI images for all vehicles using gemini-2.0-flash-exp
Uses unit number (vehicle_key) as filename
"""

from __future__ import annotations

import os
import sys
import time
import json
import logging
import psycopg2
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(env_path)

from google import genai
from google.genai import types

# Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
OUTPUT_DIR = Path(__file__).parent.parent / "apps/web/public/images/vehicles"
LOG_FILE = Path(__file__).parent / "uniform_image_gen.log"
STATUS_FILE = Path(__file__).parent / "uniform_image_status.json"

MODEL_ID = "gemini-2.5-flash-image"  # Only model that supports image generation
DELAY_SECONDS = 2.0  # Delay between requests to avoid rate limiting

# Uniform prompt template - same angle, lighting, background for ALL vehicles
PROMPT_TEMPLATE = """Professional automotive photography of a {year} {make} {model} in {color}. Three-quarter front view, 45 degrees from front-left corner, slightly elevated perspective showing hood and roofline elegantly. Vehicle perfectly straight, all four wheels clearly visible, slight wheel turn toward camera for dynamic feel. Professional studio lighting, soft diffused light from above-left, subtle rim lighting on edges, gentle shadow beneath vehicle for grounding. Pure clean white background, completely isolated vehicle, no environment, no reflections. Ultra photorealistic, sharp focus, high-end dealership catalog quality. No text, no watermarks, no logos."""

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def get_vehicles_from_db() -> List[Dict]:
    """Get all active vehicles from database with unit numbers."""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT
            raw->>'vehicle_key' as unit_number,
            year,
            make,
            model,
            color
        FROM hq_vehicles
        WHERE deleted_at IS NULL
        AND status IN ('rental', 'available', 'complementary', 'out_of_service')
        AND raw->>'vehicle_key' IS NOT NULL
        ORDER BY raw->>'vehicle_key'
    """)

    vehicles = []
    for row in cur.fetchall():
        unit_number, year, make, model, color = row
        # Skip if no unit number
        if not unit_number:
            continue
        # Clean up color (remove suffixes like "- Elite")
        clean_color = color.split(' - ')[0] if color else 'Silver'
        vehicles.append({
            'unit': unit_number,
            'year': year or 2024,
            'make': make or 'Vehicle',
            'model': model or 'Car',
            'color': clean_color
        })

    cur.close()
    conn.close()

    return vehicles


def load_status() -> Dict:
    """Load generation status from file."""
    if STATUS_FILE.exists():
        with open(STATUS_FILE, 'r') as f:
            return json.load(f)
    return {"completed": [], "failed": [], "last_run": None}


def save_status(status: Dict):
    """Save generation status to file."""
    with open(STATUS_FILE, 'w') as f:
        json.dump(status, f, indent=2, default=str)


def generate_image(vehicle: Dict) -> Optional[bytes]:
    """Generate image for a vehicle using Gemini."""
    client = genai.Client(api_key=GOOGLE_API_KEY)

    prompt = PROMPT_TEMPLATE.format(
        year=vehicle['year'],
        make=vehicle['make'],
        model=vehicle['model'],
        color=vehicle['color']
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['IMAGE']
            )
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                return part.inline_data.data

        return None
    except Exception as e:
        logger.error(f"Error generating image for {vehicle['unit']}: {e}")
        return None


def save_image(image_data: bytes, unit_number: str) -> Path:
    """Save image to file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUTPUT_DIR / f"{unit_number}.png"

    with open(filepath, "wb") as f:
        f.write(image_data)

    return filepath


def clear_old_images():
    """Remove old images to start fresh."""
    if OUTPUT_DIR.exists():
        for f in OUTPUT_DIR.glob("*.png"):
            f.unlink()
        logger.info(f"Cleared old images from {OUTPUT_DIR}")


def run_batch_generation(fresh_start: bool = False):
    """Generate images for all vehicles."""
    if not GOOGLE_API_KEY:
        logger.error("GOOGLE_API_KEY not found")
        sys.exit(1)

    if not DATABASE_URL:
        logger.error("DATABASE_URL not found")
        sys.exit(1)

    # Get vehicles
    logger.info("Fetching vehicles from database...")
    vehicles = get_vehicles_from_db()
    logger.info(f"Found {len(vehicles)} vehicles with unit numbers")

    # Load or reset status
    if fresh_start:
        clear_old_images()
        status = {"completed": [], "failed": [], "last_run": None}
    else:
        status = load_status()

    status["last_run"] = datetime.now().isoformat()

    # Filter out already completed
    pending = [v for v in vehicles if v['unit'] not in status['completed']]
    logger.info(f"Already completed: {len(status['completed'])}, pending: {len(pending)}")

    if not pending:
        logger.info("All vehicles already have images!")
        return

    # Generate images
    logger.info("=" * 60)
    logger.info(f"Starting UNIFORM batch generation for {len(pending)} vehicles")
    logger.info(f"Model: {MODEL_ID}")
    logger.info("=" * 60)

    for i, vehicle in enumerate(pending, 1):
        unit = vehicle['unit']
        logger.info(f"[{i}/{len(pending)}] Generating: {unit} - {vehicle['year']} {vehicle['make']} {vehicle['model']} ({vehicle['color']})")

        image_data = generate_image(vehicle)

        if image_data:
            filepath = save_image(image_data, unit)
            status['completed'].append(unit)
            # Remove from failed if it was there
            if unit in status['failed']:
                status['failed'].remove(unit)
            logger.info(f"  SUCCESS: Saved to {filepath.name}")
        else:
            if unit not in status['failed']:
                status['failed'].append(unit)
            logger.warning(f"  FAILED: {unit}")

        save_status(status)

        # Delay between requests
        if i < len(pending):
            time.sleep(DELAY_SECONDS)

    logger.info("=" * 60)
    logger.info(f"Batch complete. Success: {len(status['completed'])}, Failed: {len(status['failed'])}")
    logger.info("=" * 60)


if __name__ == "__main__":
    # Check for --fresh flag to start from scratch
    fresh = "--fresh" in sys.argv
    run_batch_generation(fresh_start=fresh)
