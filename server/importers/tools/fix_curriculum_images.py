#!/usr/bin/env python3
"""
Fix broken image URLs in curriculum files.
Validates each URL and replaces broken ones with working alternatives from Wikimedia.
Falls back to generated placeholders for items that can't be found.

Usage:
    python3 fix_curriculum_images.py <curriculum.umcf>
    python3 fix_curriculum_images.py  # Defaults to renaissance-history.umcf
"""

import asyncio
import base64
import json
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from importers.enrichment.image_acquisition import (
    ImageAcquisitionService,
    ImageAssetInfo,
    ImageSourceType,
)


async def validate_url(service: ImageAcquisitionService, url: str) -> bool:
    """Check if a URL returns a valid image."""
    result = await service._download_from_url(url)
    return result.success


async def fix_curriculum_images(curriculum_path: Path, output_path: Path = None):
    """
    Fix broken image URLs in a curriculum file.

    Args:
        curriculum_path: Path to the UMCF file
        output_path: Where to save fixed curriculum (defaults to same file)
    """
    if output_path is None:
        output_path = curriculum_path

    print(f"Processing: {curriculum_path}")

    # Load curriculum
    with open(curriculum_path) as f:
        curriculum = json.load(f)

    service = ImageAcquisitionService()
    fixed_count = 0
    failed_count = 0
    valid_count = 0

    try:
        # Process media collection
        async def process_media(media: dict, path: str):
            nonlocal fixed_count, failed_count, valid_count

            for collection_type in ["embedded", "reference"]:
                items = media.get(collection_type, [])
                for item in items:
                    if item.get("type") not in ("image", "diagram", "chart", "slideImage"):
                        continue

                    url = item.get("url")
                    if not url:
                        continue

                    item_id = item.get("id", "unknown")
                    title = item.get("title", item.get("alt", "Unknown image"))
                    short_title = title[:50] if title else "Unknown"

                    # Check if URL is valid
                    print(f"  [{path}] {item_id}: {short_title}...", end=" ", flush=True)
                    is_valid = await validate_url(service, url)

                    if is_valid:
                        print("✓ Valid")
                        valid_count += 1
                    else:
                        print("✗ Broken, searching...", end=" ", flush=True)

                        # Create asset info for search
                        asset = ImageAssetInfo(
                            id=item_id,
                            url=None,  # Don't try the broken URL again
                            local_path=item.get("localPath"),
                            title=item.get("title"),
                            alt=item.get("alt"),
                            caption=item.get("caption"),
                            audio_description=item.get("audioDescription"),
                            asset_type=item.get("type", "image"),
                            width=item.get("dimensions", {}).get("width", 0),
                            height=item.get("dimensions", {}).get("height", 0),
                        )

                        result = await service.acquire_image(asset)

                        if result.success:
                            if result.new_url:
                                # Replace with new URL (from Wikimedia)
                                print(f"✓ Replaced ({result.source_type.value})")
                                item["url"] = result.new_url
                                if result.attribution:
                                    item["attribution"] = result.attribution
                            elif result.data and result.source_type == ImageSourceType.GENERATED:
                                # Embed generated placeholder as data URL
                                print("✓ Placeholder generated")
                                data_b64 = base64.b64encode(result.data).decode('utf-8')
                                item["url"] = f"data:{result.mime_type};base64,{data_b64}"
                                item["isPlaceholder"] = True
                                if result.attribution:
                                    item["attribution"] = result.attribution
                            fixed_count += 1
                        else:
                            print("✗ No replacement found")
                            failed_count += 1

                    # Small delay to be nice to servers
                    await asyncio.sleep(0.3)

        # Find all nodes recursively
        async def process_node(node, path="root"):
            # Process media if present on this node
            if "media" in node:
                await process_media(node["media"], path)

            # Process segments if present
            for segment in node.get("segments", []):
                if "media" in segment:
                    seg_path = f"{path}/seg-{segment.get('id', '?')}"
                    await process_media(segment["media"], seg_path)

            # Recurse into children
            for child in node.get("children", []):
                child_path = f"{path}/{child.get('id', 'unknown')}"
                await process_node(child, child_path)

        # Handle UMCF structure: content is a list of modules
        content = curriculum.get("content", [])
        if isinstance(content, list):
            for i, module in enumerate(content):
                module_path = f"content[{i}]/{module.get('id', 'module')}"
                await process_node(module, module_path)
        elif isinstance(content, dict):
            await process_node(content, "content")

        # Also process root if it has media
        if "media" in curriculum:
            await process_media(curriculum["media"], "root")

        # Save updated curriculum
        with open(output_path, "w") as f:
            json.dump(curriculum, f, indent=2)

        print(f"\nResults:")
        print(f"  Valid URLs: {valid_count}")
        print(f"  Fixed URLs: {fixed_count}")
        print(f"  Failed to fix: {failed_count}")
        print(f"\nSaved to: {output_path}")

    finally:
        await service.close()


async def main():
    """Fix sample curriculum images."""
    if len(sys.argv) > 1:
        curriculum_path = Path(sys.argv[1])
    else:
        curriculum_path = Path(__file__).parent.parent.parent.parent / "curriculum/examples/realistic/renaissance-history.umcf"

    if not curriculum_path.exists():
        print(f"Error: Curriculum not found at {curriculum_path}")
        return 1

    await fix_curriculum_images(curriculum_path)
    return 0


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(result)
