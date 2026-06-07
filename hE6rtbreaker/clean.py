#!/usr/bin/env python3
"""
clean.py — Strip Paizo chrome from all HTML files in pf6_edited/.

Removes: legacy banner, .header logo div, #nav-path, all <script> tags,
         all external/broken <link> tags, .footer inside .body.
Keeps:   everything inside div.body, rebuilt into a clean standalone document
         that links to pf6.css (placed at pf6_edited/pf6.css).

Usage: python3 clean.py [--dry-run]
"""

import sys
import re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString

DRY_RUN = "--dry-run" in sys.argv
ROOT = Path(__file__).parent / "pf6_edited"
CSS_REL = {
    "top":        "pf6.css",
    "spell":      "../pf6.css",
    "magicItems": "../pf6.css",   
    "skills":     "../pf6.css",  
}

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{css}">
</head>
<body>
<div class="content">
{body}
</div>
</body>
</html>
"""

def is_paizo_banner(tag):
    """Red legacy-notice banner: div with inline background #c8433f."""
    if tag.name != "div":
        return False
    style = tag.get("style", "")
    return "c8433f" in style

def extract_title(soup):
    t = soup.find("title")
    return t.get_text(strip=True) if t else "Pathfinder"

def extract_body_html(soup):
    """Return inner HTML of div.body, minus the .footer child."""
    body_div = soup.find("div", class_="body")
    if not body_div:
        # Fallback: grab everything in <body>
        return soup.body.decode_contents() if soup.body else ""
    footer = body_div.find("div", class_="footer")
    if footer:
        footer.decompose()
    return body_div.decode_contents().strip()

def clean_file(path: Path, css_href: str):
    html = path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")

    title = extract_title(soup)

    # Remove Paizo banner
    for tag in soup.find_all(is_paizo_banner):
        tag.decompose()

    # Remove .header logo block
    for tag in soup.find_all("div", class_="header"):
        tag.decompose()

    # Remove #nav-path
    for tag in soup.find_all(id="nav-path"):
        tag.decompose()

    # Remove all <script> tags
    for tag in soup.find_all("script"):
        tag.decompose()

    body_html = extract_body_html(soup)
    result = HTML_TEMPLATE.format(title=title, css=css_href, body=body_html)

    if DRY_RUN:
        print(f"[dry-run] would write {path} ({len(result)} bytes)")
    else:
        path.write_text(result, encoding="utf-8")
        print(f"cleaned  {path.relative_to(ROOT.parent)}")

def main():
    top_files = list(ROOT.glob("*.html"))
    spell_files = list((ROOT / "spells").glob("*.html"))

    for f in top_files:
        clean_file(f, CSS_REL["top"])
    for f in spell_files:
        clean_file(f, CSS_REL["spell"])
    for f in (ROOT / "magicItems").glob("*.html"):
        clean_file(f, CSS_REL["magicItems"])
    for f in (ROOT / "skills").glob("*.html"):
        clean_file(f, CSS_REL["skills"])

    print(f"\nDone: {len(top_files)} top-level + {len(spell_files)} spell pages.")

if __name__ == "__main__":
    main()
