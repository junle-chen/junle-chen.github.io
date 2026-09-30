#!/usr/bin/env python3
import sys
from pathlib import Path


def extract_with_pdfplumber(pdf_path):
    import pdfplumber

    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n\n".join(pages)


def extract_with_pypdf(pdf_path):
    from pypdf import PdfReader

    reader = PdfReader(str(pdf_path))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: extract-pdf-text.py PAPER.pdf")
    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    try:
        text = extract_with_pdfplumber(pdf_path)
    except Exception:
        text = extract_with_pypdf(pdf_path)
    print(" ".join(text.split()))


if __name__ == "__main__":
    main()
