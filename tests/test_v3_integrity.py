#!/usr/bin/env python3
import pathlib, json, re, subprocess, sys

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")

# 1. JSON & Webmanifest validation
j_cnt = 0
for p in root.rglob("*"):
    if p.suffix in (".json", ".webmanifest"):
        json.loads(p.read_text(encoding="utf-8"))
        j_cnt += 1
assert j_cnt >= 8, f"Expected >= 8 JSON/manifest files, got {j_cnt}"

# 2. Zero stale pushfix1-6 references
stale = []
for sub in ("Admin", "Parents"):
    for p in (root / sub).rglob("*"):
        if p.is_file() and p.suffix in (".html", ".js", ".css"):
            if re.search(r"pushfix[1-6]\b", p.read_text(encoding="utf-8", errors="ignore")):
                stale.append(str(p.relative_to(root)))
assert not stale, f"Stale pushfix refs: {stale}"

# 3. Zero .innerHTML = assignments
ih = []
for sub in ("Admin", "Parents"):
    for p in (root / sub).rglob("*.js"):
        if re.search(r"\.innerHTML\s*=", p.read_text(encoding="utf-8")):
            ih.append(str(p.relative_to(root)))
assert not ih, f"innerHTML found: {ih}"

# 4. Zero hardcoded secrets
secrets = []
for p in root.rglob("*"):
    if p.is_file() and p.suffix in (".js", ".ts", ".html", ".sql", ".md", ".py"):
        txt = p.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"sk_live|VAPID_PRIVATE_KEY\s*=|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", txt):
            secrets.append(str(p.relative_to(root)))
assert not secrets, f"Potential secrets found: {secrets}"

# 5. Zero missing local HTML assets
missing = []
for sub in ("Admin", "Parents"):
    for hp in (root / sub).glob("*.html"):
        txt = hp.read_text(encoding="utf-8")
        for ref in re.findall(r'(?:src|href)="([^"#?]+)', txt):
            if ref.startswith(("http://", "https://", "mailto:", "tel:", "data:")):
                continue
            if not (root / sub / ref).exists():
                missing.append(f"{sub}/{hp.name} -> {ref}")
assert not missing, f"Missing local HTML assets: {missing}"

# 6. JS syntax checks via check-project-script.mjs
for sub in ("Admin", "Parents"):
    subprocess.run(["node", "check-project-script.mjs"], cwd=root / sub, check=True)

print(f"ALL V3 INTEGRITY CHECKS PASSED (JSON={j_cnt}, 0 stale, 0 innerHTML, 0 secrets, 0 missing HTML assets)")
