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
    p = argparse.ArgumentParser(description="Add or update a partner service in ToyOlsun from local photos.")
    p.add_argument("--update-id", type=int, default=None,
                    help="Update an existing service by id instead of creating a new one. "
                         "Only the fields you pass are changed; --photos-dir is not required.")
    p.add_argument("--username", help="Slug used for the storage folder, e.g. 'neon' (required when creating)")
    p.add_argument("--title", help="Business name shown in the app (required when creating)")
    p.add_argument("--price", type=int, help="Price (AZN, whole number — the DB column is integer)")
    p.add_argument("--category", choices=sorted(VALID_CATEGORIES))
    p.add_argument("--event-type", help="Comma-separated: wedding,khyna,birthday")
    p.add_argument("--photos-dir", help="Local folder containing the partner's photos (required when creating)")
    p.add_argument("--description")
    p.add_argument("--address")
    p.add_argument("--phone")
    p.add_argument("--unit", default=None)
    p.add_argument("--tags", help="Comma-separated tags")
    p.add_argument("--dry-run", action="store_true", help="Preview only, don't upload or insert anything")
    args = p.parse_args()

    if args.update_id is None:
        missing = [name for name, val in [("--username", args.username), ("--title", args.title),
                                           ("--price", args.price), ("--photos-dir", args.photos_dir)] if not val]
        if missing:
            p.error(f"the following arguments are required unless --update-id is given: {', '.join(missing)}")
        if args.category is None:
            args.category = "venues"
        if args.event_type is None:
            args.event_type = "wedding"
        if args.unit is None:
            args.unit = "AZN"
        if args.description is None:
            args.description = ""
        if args.address is None:
            args.address = "Baku, Azerbaijan"
        if args.phone is None:
            args.phone = ""
        if args.tags is None:
            args.tags = ""
    return args


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


def update_existing(args):
    """Partial update of an existing row — only fields actually passed on
    the command line are changed. Doesn't touch photos/images."""
    fields = {
        "title": args.title,
        "price": args.price,
        "unit": args.unit,
        "category": args.category,
        "description": args.description,
        "address": args.address,
        "phone": args.phone,
    }
    row = {k: v for k, v in fields.items() if v is not None}
    if args.event_type is not None:
        event_types = [e.strip() for e in args.event_type.split(",") if e.strip()]
        for e in event_types:
            if e not in VALID_EVENT_TYPES:
                sys.exit(f"Invalid event type '{e}'. Must be one of: {sorted(VALID_EVENT_TYPES)}")
        row["event_type"] = event_types
    if args.tags is not None:
        row["tags"] = [t.strip() for t in args.tags.split(",") if t.strip()]

    if not row:
        sys.exit("Nothing to update — pass at least one field (e.g. --tags).")

    print(f"Updating service.id = {args.update_id} with: {row}")
    if args.dry_run:
        print("\n--dry-run: nothing was updated.")
        return

    load_dotenv()
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    result = supabase.table("service").update(row).eq("id", args.update_id).execute()
    if not result.data:
        sys.exit(f"No service found with id={args.update_id}")
    print(f"\nDone. Updated service.id = {args.update_id}")


def find_desktop() -> str | None:
    """Handles both a normal Desktop and a OneDrive-redirected one."""
    home = Path.home()
    for candidate in [home / "OneDrive" / "Desktop", home / "Desktop"]:
        if candidate.is_dir():
            return str(candidate)
    return None


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip().lstrip("﻿")  # strip a stray BOM some terminals send
    return val or default


def run_interactive():
    """No command-line arguments were given — ask everything step by step
    instead, in Azerbaijani, so this can just be double-clicked."""
    print("=== ToyOlsun — Yeni Partnyor Əlavə Et ===\n")

    desktop = find_desktop()
    photos_dir = ""
    if desktop:
        folders = sorted(d.name for d in Path(desktop).iterdir() if d.is_dir())
        if folders:
            print(f"Desktop-da tapılan qovluqlar ({desktop}):")
            for i, name in enumerate(folders, 1):
                print(f"  {i}. {name}")
            choice = ask("\nHansı qovluqdakı şəkilləri yükləyək? (nömrə yazın, ya da tam yol yazın)")
            if choice.isdigit() and 1 <= int(choice) <= len(folders):
                photos_dir = str(Path(desktop) / folders[int(choice) - 1])
            else:
                photos_dir = choice
    if not photos_dir:
        photos_dir = ask("Şəkillərin olduğu qovluğun tam yolu")
    while not os.path.isdir(photos_dir):
        print(f"  Tapılmadı: {photos_dir}")
        photos_dir = ask("Şəkillərin olduğu qovluğun tam yolu")

    title = ask("Partnyorun adı (məs: Paris Hall)")
    username = ask("Qısa ad (yalnız hərflər, boşluqsuz)", title.lower().replace(" ", ""))
    price = ask("Qiymət (AZN, tam ədəd)")
    while not price.isdigit():
        price = ask("Qiymət (rəqəmlə, məs: 2500)")

    print("\nKateqoriya seçin:")
    cats = sorted(VALID_CATEGORIES)
    for i, c in enumerate(cats, 1):
        print(f"  {i}. {c}")
    cat_choice = ask("Nömrə", "1")
    category = cats[int(cat_choice) - 1] if cat_choice.isdigit() and 1 <= int(cat_choice) <= len(cats) else "venues"

    description = ask("Təsvir (istəyə bağlı, boş buraxa bilərsiniz)")
    phone = ask("Telefon (istəyə bağlı, məs: +994 55 555 10 30)")
    tags = ask("Teqlər, vergüllə ayırın (istəyə bağlı, məs: premium,klassik)")
    event_type = ask("Tədbir növləri, vergüllə (wedding, khyna, birthday)", "wedding")

    class Args:
        pass

    a = Args()
    a.username, a.title, a.price = username, title, int(price)
    a.category, a.event_type, a.photos_dir = category, event_type, photos_dir
    a.description, a.address, a.phone, a.unit, a.tags = description, "Baku, Azerbaijan", phone, "AZN", tags
    a.dry_run, a.update_id = False, None

    print(f"\n--- Yoxlayın ---")
    print(f"Ad: {title}   Qiymət: {price} AZN   Kateqoriya: {category}")
    print(f"Şəkillər: {photos_dir}")
    confirm = ask("\nBunu ƏLAVƏ ETMƏK istəyirsiniz? (bəli/xeyr)", "bəli")
    if confirm.lower() not in ("bəli", "beli", "b", "yes", "y"):
        print("Ləğv edildi, heç nə yazılmadı.")
        return

    print()
    create_service(a)


def create_service(args):
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


def main():
    if len(sys.argv) == 1:
        run_interactive()
        return

    args = parse_args()

    if args.update_id is not None:
        update_existing(args)
        return

    create_service(args)


if __name__ == "__main__":
    main()
