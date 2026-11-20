"""Embed the standalone pump demo so its guide also works from a file URL."""

import posixpath
import re
from pathlib import Path
from urllib.parse import urlsplit


preview = Path(__file__).resolve().parent
app_dir = "assets/faux-superpump"
app = (preview / app_dir / "demo.html").read_text(encoding="utf-8")


def rebase_asset(match):
    url = urlsplit(match[2])
    if url.scheme or url.netloc or not url.path or url.path.startswith("/"):
        return match[0]
    path = posixpath.normpath(f"{app_dir}/{url.path}")
    return f'{match[1]}="{url._replace(path=path).geturl()}"'


# A srcdoc iframe resolves relative links from the surrounding page's URL.
app = re.sub(r'\b(src|href)="([^"]+)"', rebase_asset, app)
srcdoc = app.strip().replace("&", "&amp;").replace('"', "&quot;")

page = preview / "demo.html"
with page.open(encoding="utf-8", newline="") as file:
    html = file.read()
if "\r\n" in html:
    srcdoc = srcdoc.replace("\n", "\r\n")

html, frame_count = re.subn(
    r'(<iframe id="superpump-demo"[^>]*?\bsrcdoc=")[^"]*(")',
    lambda match: f"{match[1]}{srcdoc}{match[2]}",
    html,
)
if frame_count != 1:
    raise SystemExit("Expected exactly one superpump-demo iframe with srcdoc")

with page.open("w", encoding="utf-8", newline="") as file:
    file.write(html)
