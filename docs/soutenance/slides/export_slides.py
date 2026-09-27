"""
Photographie chaque slide de slides.html en PNG 1920 × 1080, avec Chrome (ou Edge) sans interface.

Usage : venv activé, python export_slides.py, depuis n'importe où (les chemins partent de ce fichier).
Ensuite : import_slides.py pour poser les PNG sur le board.
"""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "slides.html"
OUTPUT_DIR = HERE / "png"

SLIDE_WIDTH = 1920
SLIDE_HEIGHT = 1080
# Chrome sans interface ne peint pas toujours les dernières lignes de sa fenêtre : on capture plus haut, puis on recadre.
CAPTURE_HEIGHT = 1120

BROWSER_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]


def find_browser() -> Path:
    for candidate in BROWSER_CANDIDATES:
        if candidate.exists():
            return candidate
    sys.exit("Ni Chrome ni Edge trouvés : ajouter leur chemin à BROWSER_CANDIDATES.")


def main():
    browser = find_browser()
    slide_count = len(re.findall(r'<section class="slide', SOURCE.read_text(encoding="utf-8")))
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Profil jetable : sans lui, le navigateur sans interface peut se greffer sur une fenêtre déjà ouverte.
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        capture = Path(profile) / "capture.png"
        for number in range(1, slide_count + 1):
            subprocess.run(
                [
                    str(browser), "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=1", f"--window-size={SLIDE_WIDTH},{CAPTURE_HEIGHT}",
                    "--virtual-time-budget=3000", f"--user-data-dir={profile}",
                    f"--screenshot={capture}", f"{SOURCE.as_uri()}#{number}",
                ],
                check=True,
                capture_output=True,
            )
            destination = OUTPUT_DIR / f"slide-{number:02d}.png"
            with Image.open(capture) as image:
                image.crop((0, 0, SLIDE_WIDTH, SLIDE_HEIGHT)).save(destination)
            print(destination.name)


if __name__ == "__main__":
    main()
