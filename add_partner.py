"""
Bulk-add a partner service to ToyOlsun from a local folder of photos.

Photos must already be on disk (e.g. saved from WhatsApp) — this script
does NOT scrape Instagram or any other platform. It compresses each photo
the same way the app itself does on upload (max 1000px wide, JPEG ~65%
quality), uploads them to Supabase Storage, and inserts one row into the
`service` table.

No rating is fabricated: new listings are inserted with rating "0" until
real customer reviews come in.

Usage:
    python add_partner.py --username neon --title "Neon Palace" \
        --price 3000 --category venues --photos-dir ./photos/neon

Run with --dry-run first to preview without writing anything.
"""
import argparse
import glob
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image
from supabase import create_client

VALID_CATEGORIES = {"venues", "artists", "media", "cars", "wedding_dress", "flowers", "tourism"}
VALID_EVENT_TYPES = {"wedding", "khyna", "birthday"}
MAX_PHOTOS = 6
MAX_WIDTH = 1000
JPEG_QUALITY_START = 80
JPEG_QUALITY_MIN = 30
TARGET_SIZE_KB = 75


def parse_args():
    p = argparse.ArgumentParser(description="Add a partner service to ToyOlsun from local photos.")
    p.add_argument("--username", required=True, help="Slug used for the storage folder, e.g. 'neon'")
    p.add_argument("--title", required=True, help="Business name shown in the app")
    p.add_argument("--price", required=True, type=int, help="Price (AZN, whole number — the DB column is integer)")
    p.add_argument("--category", default="venues", choices=sorted(VALID_CATEGORIES))
    p.add_argument("--event-type", default="wedding", help="Comma-separated: wedding,khyna,birthday")
    p.add_argument("--photos-dir", required=True, help="Local folder containing the partner's photos")
    p.add_argument("--description", default="")
    p.add_argument("--address", default="Baku, Azerbaijan")
    p.add_argument("--phone", default="")
    p.add_argument("--unit", default="AZN")
    p.add_argument("--tags", default="", help="Comma-separated tags")
    p.add_argument("--dry-run", action="store_true", help="Preview only, don't upload or insert anything")
    return p.parse_args()


def collect_photos(photos_dir: str) -> list[str]:
    patterns = ["*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"]
    files: list[str] = []
    for pattern in patterns:
        files.extend(glob.glob(os.path.join(photos_dir, pattern)))
    files = sorted(set(files))[:MAX_PHOTOS]
    return files


def compress_photo(src_path: str, tmp_dir: str) -> str:
    """Resize to MAX_WIDTH, then step the JPEG quality down until the file
    is at or under TARGET_SIZE_KB (or JPEG_QUALITY_MIN is hit, so it never
    gets destroyed trying to hit an unreachable target)."""
    img = Image.open(src_path).convert("RGB")
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize((MAX_WIDTH, int(img.height * ratio)))
    out_path = os.path.join(tmp_dir, Path(src_path).stem + ".jpg")

    quality = JPEG_QUALITY_START
    while True:
        img.save(out_path, "JPEG", quality=quality)
        size_kb = os.path.getsize(out_path) / 1024
        if size_kb <= TARGET_SIZE_KB or quality <= JPEG_QUALITY_MIN:
            print(f"    {Path(src_path).name}: {size_kb:.0f} KB (quality {quality})")
            break
        quality -= 10
    return out_path


def main():
    args = parse_args()

    if not os.path.isdir(args.photos_dir):
        sys.exit(f"Photos folder not found: {args.photos_dir}")

    photos = collect_photos(args.photos_dir)
    if not photos:
        sys.exit(f"No .jpg/.png photos found in {args.photos_dir}")

    event_types = [e.strip() for e in args.event_type.split(",") if e.strip()]
    for e in event_types:
        if e not in VALID_EVENT_TYPES:
            sys.exit(f"Invalid event type '{e}'. Must be one of: {sorted(VALID_EVENT_TYPES)}")

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    print(f"Partner:     {args.title} ({args.username})")
    print(f"Category:    {args.category}")
    print(f"Event types: {event_types}")
    print(f"Price:       {args.price} {args.unit}")
    print(f"Photos:      {len(photos)} found -> {[Path(p).name for p in photos]}")

    if args.dry_run:
        print("\n--dry-run: nothing was uploaded or inserted.")
        return

    load_dotenv()
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    supabase = create_client(url, key)

    tmp_dir = os.path.join(args.photos_dir, "_compressed")
    os.makedirs(tmp_dir, exist_ok=True)

    image_urls: list[str] = []
    for src in photos:
        compressed = compress_photo(src, tmp_dir)
        storage_path = f"partners/{args.username}/{Path(compressed).name}"
        with open(compressed, "rb") as f:
            supabase.storage.from_("images").upload(
                storage_path, f, {"content-type": "image/jpeg", "upsert": "true"}
            )
        public_url = supabase.storage.from_("images").get_public_url(storage_path)
        image_urls.append(public_url)
        print(f"  Uploaded: {storage_path}")

    row = {
        "title": args.title,
        "price": args.price,
        "unit": args.unit,
        "rating": "0",
        "category": args.category,
        "tags": tags,
        "event_type": event_types,
        "address": args.address,
        "description": args.description,
        "img": image_urls[0],
        "images": image_urls,
        "status": "approved",
        "phone": args.phone,
    }

    result = supabase.table("service").insert(row).execute()
    new_id = result.data[0]["id"] if result.data else "?"
    print(f"\nDone. service.id = {new_id}")


if __name__ == "__main__":
    main()
