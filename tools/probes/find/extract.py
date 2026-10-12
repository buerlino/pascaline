# SPDX-License-Identifier: GPL-3.0-or-later
# Probe (not the real generator): a rough Find index straight from the pinned tarballs, to measure size and
# ranking cost. Reads Giac's doc/aide_cas (English lines "2 ...", never French) and libqalculate's units and
# variables XML; checks both tarballs against their pinned SHA-256 first. Output: tools/probes/_out/find/index.json.
#   python3 -I tools/probes/find/extract.py [giac.tar.gz] [libqalculate.tar.gz]
# Defaults: engine/giac/_downloads/giac-2.1.0.tar.gz and ../pascaline-deps/qalc-spike/dl/libqalculate-5.13.1.tar.gz
import hashlib, io, json, pathlib, sys, tarfile
import xml.etree.ElementTree as ET

REPO = pathlib.Path(__file__).resolve().parents[3]
GIAC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "engine/giac/_downloads/giac-2.1.0.tar.gz"
QALC = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "pascaline-deps/qalc-spike/dl/libqalculate-5.13.1.tar.gz"
PINNED = {
    "giac-2.1.0.tar.gz": "1d9536e02ce6a336793ebf11c02b93f084e28af2350871914acafa60282b5a67",
    "libqalculate-5.13.1.tar.gz": "cf8d3eaf3d85030115701e997b6585e69573e71add88e7758486c5d1b01d3cc3",
}
OUT = REPO / "tools/probes/_out/find"


def checked(path: pathlib.Path) -> tarfile.TarFile:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if PINNED.get(path.name) != digest:
        sys.exit(f"SHA-256 mismatch or unknown file: {path}")
    return tarfile.open(path)


def member(tar: tarfile.TarFile, suffix: str) -> bytes:
    for m in tar.getmembers():
        if m.isfile() and m.name.endswith(suffix):
            f = tar.extractfile(m)
            assert f is not None
            return f.read()
    sys.exit(f"{suffix} not found")


def qalc_names(text: str) -> list[str]:
    # "ar:c,speed_of_light": optional flags before ":" (a abbreviation, r reference, p plural, u unicode, ...)
    return [p.split(":", 1)[-1].strip() for p in text.split(",") if p.split(":", 1)[-1].strip()]


items: list[dict] = []
cur: dict | None = None
for line in member(checked(GIAC), "/doc/aide_cas").decode("utf-8", "replace").splitlines():
    if line.startswith("# "):
        name = line[2:].split()[0] if line[2:].split() else ""
        cur = None if name.startswith("_") else {"k": "fn", "n": line[2:].split()}  # Giac's own units/constants are not used (P3)
        if cur:
            items.append(cur)
    elif cur is not None and line.startswith("2 "):
        cur["d"] = line[2:]
    elif cur is not None and line.startswith("0 "):
        cur["s"] = line[2:]

qtar = checked(QALC)
for fname, kind in (("data/units.xml.in", "unit"), ("data/variables.xml.in", "const")):
    root = ET.parse(io.BytesIO(member(qtar, fname))).getroot()
    for el in root.iter():
        if el.tag not in ("unit", "variable", "builtin_unit", "builtin_variable"):
            continue
        names, title = el.find("names"), el.find("title")
        if names is None or not names.text:
            continue
        it = {"k": kind, "n": qalc_names(names.text)}
        if title is not None and title.text:
            it["d"] = title.text
        v = el.find("value")
        if v is not None and v.text:
            it["v"], it["u"], it["x"] = v.text.strip(), v.get("unit"), v.get("uncertainty")
        items.append(it)

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "index.json").write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
counts = {k: sum(1 for i in items if i["k"] == k) for k in ("fn", "unit", "const")}
print(f"{len(items)} items {counts} -> {OUT / 'index.json'} ({(OUT / 'index.json').stat().st_size} bytes)")
