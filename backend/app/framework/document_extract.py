"""Plain-text extraction for Resource RAG. PDF and DOCX via pypdf/python-docx;
txt/md/csv read directly. No OCR - a scanned/image-only PDF yields empty text
and raises ExtractionNotSupported, the same limitation LobeChat's own
extraction pipeline has (it uses pdf-parse/mammoth, also plain-text-only)."""

import io

TEXT_EXTENSIONS = (".txt", ".md", ".csv")


class ExtractionNotSupported(Exception):
    pass


def extract_text(filename: str, data: bytes) -> str:
    lower = filename.lower()

    if lower.endswith(TEXT_EXTENSIONS):
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ExtractionNotSupported(f"{filename} is not valid UTF-8 text") from exc

    if lower.endswith(".pdf"):
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
        except Exception as exc:  # noqa: BLE001 - any malformed/unreadable PDF
            raise ExtractionNotSupported(f"Couldn't read {filename} as a PDF: {exc}") from exc
        if not text:
            raise ExtractionNotSupported(f"{filename} has no extractable text (scanned PDFs aren't supported)")
        return text

    if lower.endswith(".docx"):
        import docx

        try:
            document = docx.Document(io.BytesIO(data))
            text = "\n\n".join(p.text for p in document.paragraphs if p.text.strip())
        except Exception as exc:  # noqa: BLE001 - any malformed/unreadable docx
            raise ExtractionNotSupported(f"Couldn't read {filename} as a Word document: {exc}") from exc
        if not text:
            raise ExtractionNotSupported(f"{filename} has no extractable text")
        return text

    raise ExtractionNotSupported(
        f"Can't extract text from {filename} for search yet - .doc, .ppt/.pptx, and .xls/.xlsx "
        "are stored and downloadable but not indexed for RAG."
    )
