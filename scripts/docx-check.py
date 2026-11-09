#!/usr/bin/env python3
"""量 Word 版是不是还在一页里。

usage: python docx-check.py <file.docx> [--budget 805] [--keep]

原理：用 LibreOffice 把 docx 转成 PDF，再用 PyMuPDF 读页数和内容底边。
--budget 是内容底边的警戒线（pt，A4 可用底边约 827pt）；留 20pt 左右余量最稳，
因为 Word 和 LibreOffice 的断行、字距有细微差异，贴边可能在 Word 里就翻页了。

依赖：LibreOffice + PyMuPDF（pip install pymupdf）
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

# Windows 控制台默认不是 UTF-8，路径里的中日文会变乱码
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

SOFFICE_CANDIDATES = [
    os.environ.get("SOFFICE", ""),
    "soffice",
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
]


def find_soffice():
    for c in SOFFICE_CANDIDATES:
        if not c:
            continue
        if os.path.isabs(c) and os.path.exists(c):
            return c
        w = shutil.which(c)
        if w:
            return w
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    keep = "--keep" in sys.argv
    budget = 805.0
    if "--budget" in sys.argv:
        budget = float(sys.argv[sys.argv.index("--budget") + 1])

    if not args:
        print("usage: python docx-check.py <file.docx> [--budget 805] [--keep]", file=sys.stderr)
        return 2

    docx = os.path.abspath(args[0])
    if not os.path.exists(docx):
        print(f"找不到 {docx}", file=sys.stderr)
        return 2

    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("需要 PyMuPDF：pip install pymupdf", file=sys.stderr)
        return 2

    soffice = find_soffice()
    if not soffice:
        print(
            "找不到 LibreOffice（soffice）。装一个，或用 SOFFICE=/路径/soffice 指定。",
            file=sys.stderr,
        )
        return 2

    workdir = tempfile.mkdtemp(prefix="docx-check-")
    try:
        subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", workdir, docx],
            check=True, capture_output=True, timeout=300,
        )
        pdf = os.path.join(workdir, os.path.splitext(os.path.basename(docx))[0] + ".pdf")
        doc = fitz.open(pdf)

        page = doc[0]
        blocks = page.get_text("blocks")
        imgs = [page.get_image_bbox(im) for im in page.get_images(full=True)]
        bottom = max([b[3] for b in blocks] + [b.y1 for b in imgs], default=0)
        height = page.rect.height

        notes = []
        if doc.page_count > 1:
            notes.append(f"超过一页（{doc.page_count} 页）。按 references/docx-mirror.md「卡一页」一节腾空间。")
        if bottom > budget:
            notes.append(f"内容底边 {bottom:.0f}pt 超过警戒线 {budget:.0f}pt，余量不足，Word 里可能翻页。")
            notes.append(f"  bottom={bottom:.0f} 在 {bottom:.0f}pt 的位置，可用的底线约 {height - 15:.0f}pt。")

        result = {
            "docx": docx.replace("\\", "/"),
            "pages": doc.page_count,
            "page_height_pt": round(height, 1),
            "content_bottom_pt": round(bottom, 1),
            "budget_pt": budget,
            "notes": notes,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if keep:
            dst = os.path.join(os.path.dirname(docx), "_check")
            os.makedirs(dst, exist_ok=True)
            shutil.copy(pdf, dst)
            page.get_pixmap(dpi=110).save(os.path.join(dst, "page1.png"))
            print(f"已保留预览：{dst}", file=sys.stderr)
        return 0 if not notes else 1
    finally:
        if not keep:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
