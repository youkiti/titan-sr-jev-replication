"""Convert the public manual_search CSVs to JSONL without extracting files."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import sys
import zipfile

_DOI_ID_RE = re.compile(r"14651858\.([A-Za-z]{2}\d+)", re.IGNORECASE)
_BARE_ID_RE = re.compile(r"\b([A-Za-z]{2}\d{5,})", re.IGNORECASE)
_TAG_RE = re.compile(r"\[(RTI|BG|OBJ|SEL|TIT|ABS)\]\s*")
_TAG_FIELD = {"RTI": "review_title", "BG": "background", "OBJ": "objective",
              "SEL": "selection_criteria", "TIT": "title", "ABS": "abstract"}
INNER = "Title and Abstract Screening Data for Systematic Review/20240827_Systematic_review_manual_search_data.zip"


def cochrane_id_from_text(text):
    match = _DOI_ID_RE.search(text) or _BARE_ID_RE.search(text)
    return match.group(1).upper() if match else None


def _parse_tagged(text):
    parts = _TAG_RE.split(text)
    tags, vals = parts[1::2], parts[2::2]
    return {_TAG_FIELD[tag]: val.strip() for tag, val in zip(tags, vals) if tag in _TAG_FIELD}


def _map_manual_label(raw):
    return "included" if raw.strip().lower() in ("true", "1", "1.0") else "excluded"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    digest = hashlib.sha256()
    with args.zip.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    print(f"Outer zip SHA-256: {digest.hexdigest()}", flush=True)
    with zipfile.ZipFile(args.zip) as outer:
        with zipfile.ZipFile(io.BytesIO(outer.read(INNER))) as inner:
            names = sorted(name for name in inner.namelist()
                           if re.fullmatch(r"CD.*_data_cleaned\.csv", PurePosixPath(name).name))
            if len(names) != 22:
                raise ValueError(f"Expected 22 review CSVs; found {len(names)}")
            args.out.parent.mkdir(parents=True, exist_ok=True)
            total = 0
            with args.out.open("w", encoding="utf-8", newline="\n") as output:
                for name in names:
                    stem = PurePosixPath(name).stem
                    cid = cochrane_id_from_text(stem) or stem
                    count = 0
                    with inner.open(name) as raw:
                        with io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline="") as fh:
                            for row in csv.DictReader(fh):
                                raw_row_index = row.get("")
                                if raw_row_index is None or not raw_row_index.strip():
                                    raise ValueError("missing/blank raw row index")
                                review = _parse_tagged(row.get("Review_data", "") or "")
                                candidate = _parse_tagged(row.get("Title_Abstract", "") or "")
                                record = dict(cochrane_id=cid,
                                              selection_criteria=review.get("selection_criteria", ""),
                                              title=candidate.get("title", ""),
                                              abstract=candidate.get("abstract", ""),
                                              label=_map_manual_label(row.get("included", "False") or "False"))
                                output.write(json.dumps(record, ensure_ascii=False) + "\n")
                                count += 1
                    total += count
                    output.flush()
                    print(f"{cid}: {count} records ({total} total)", flush=True)
    print(f"Wrote {total} records", flush=True)


if __name__ == "__main__":
    main()
