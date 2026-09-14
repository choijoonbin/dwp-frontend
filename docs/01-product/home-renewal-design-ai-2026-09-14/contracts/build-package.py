"""Build documentation handoff copies and verify menu/link coverage; no product edits."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import subprocess

PACKAGE = Path(__file__).resolve().parents[1]
REPO = PACKAGE.parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relocate_links(content, source, destination):
    def replace(match):
        label, target = match.groups()
        if re.match(r"(?:https?://|codex:|#|/)", target):
            return match.group(0)
        location, _, anchor = target.partition("#")
        relocated = os.path.relpath(source.parent / location, destination.parent)
        return f"[{label}]({relocated}{'#' + anchor if anchor else ''})"
    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace, content)


common = PACKAGE / "prompts/00-common-contract.md"
appendices = {
    "01": ["00-current-analysis-and-renewal-plan.md", "contracts/widget-extensibility-contract.md"],
    "02": ["00-current-analysis-and-renewal-plan.md", "contracts/widget-extensibility-contract.md"],
    "03": ["00-current-analysis-and-renewal-plan.md", "contracts/app-expansion-and-new-app-plan.md", "contracts/widget-extensibility-contract.md"],
    "04": ["contracts/widget-source-matrix.md", "contracts/widget-extensibility-contract.md"],
    "05": ["contracts/widget-extensibility-contract.md"],
    "06": ["contracts/widget-extensibility-contract.md"],
    "07": ["contracts/account-admin-menu-inventory.md"],
    "08": ["contracts/account-admin-menu-inventory.md", "contracts/widget-extensibility-contract.md"],
    "09": ["contracts/account-admin-menu-inventory.md", "contracts/widget-extensibility-contract.md"],
    "10": ["contracts/account-admin-menu-inventory.md", "contracts/app-expansion-and-new-app-plan.md"],
    "11": ["contracts/widget-source-matrix.md", "contracts/widget-extensibility-contract.md"],
    "12": ["contracts/app-expansion-and-new-app-plan.md", "contracts/widget-source-matrix.md"],
    "13": ["contracts/app-expansion-and-new-app-plan.md"],
}
ready = PACKAGE / "ready-to-send"
ready.mkdir(exist_ok=True)
prompts = sorted(path for path in (PACKAGE / "prompts").glob("*.md") if not path.name.startswith("00-"))
for prompt in prompts:
    target = ready / prompt.name
    parts = [f"# DWP 독립 전달 합본 — P{prompt.name[:2]}\n\n공통 계약 → 이번 화면군 → 참고 계약 순서로 읽는다. 화면군 지시의 모든 지정 화면을 반환한다. 승인 내 앱 PNG는 별도 첨부한다. 아래 참고 계약 본문은 이미 포함했으며 외부 AI가 로컬 링크를 읽을 수 있다고 가정하지 않는다.\n"]
    for source in [common, prompt] + [PACKAGE / name for name in appendices[prompt.name[:2]]]:
        parts.append("\n---\n\n" + relocate_links(source.read_text(), source, target))
    target.write_text("\n".join(parts))

inventory_path = PACKAGE / "contracts/account-admin-menu-inventory.md"
inventory = inventory_path.read_text()
existing_block = inventory.split("## 6.")[0]
rows = []
for line in existing_block.splitlines():
    if not line.startswith("|"):
        continue
    cells = [cell.strip() for cell in line.strip("|").split("|")]
    route = re.search(r"/(?:account|admin)/[a-z0-9/-]+", " ".join(cells[:2]))
    if route:
        rows.append((route.group(), cells[-1], "LEGACY_CURRENT" if "legacy" in line else "CURRENT"))
account_source = REPO / "apps/dwp/src/features/account/settings-navigation.ts"
admin_source = REPO / "apps/dwp/src/features/admin/admin-navigation.ts"
account_routes = re.findall(r"path: '(/account/[^']+)'", account_source.read_text())
admin_routes = [route for route in re.findall(r"path: '(/admin/[^']+)'", admin_source.read_text()) if route != "/admin/governance/audit"]
expected_routes = account_routes + admin_routes + ["/admin/governance/audit"]
actual_routes = [row[0] for row in rows]
menu_prompt_text = "\n".join(path.read_text() for path in prompts if path.name[:2] in {"07", "08", "09", "10"})
missing_inventory = sorted(set(expected_routes) - set(actual_routes))
missing_prompts = sorted(route for route in expected_routes if route not in menu_prompt_text)

registry = ["# 화면 전달 레지스트리\n", "기존 메뉴는 실제 nav 소스와 메뉴 인벤토리에서 추출했다. 화면/하위 프레임 ID는 해당 프롬프트가 정본이다. 신규 기능 후보의 ID도 포함하며 실제 운영 지원·메뉴 등록·검증 완료를 뜻하지 않는다.\n", "## 계정·중앙 관리 기존 메뉴 전체\n", "| 실제 route | 프롬프트/프레임 매핑 | 분류 |\n| --- | --- | --- |"]
registry.extend(f"| `{route}` | {mapping} | {classification} |" for route, mapping, classification in rows)
registry += ["\n## 화면군별 프레임/상태 요구\n", "공통 S01~S15는 P00, 각 프롬프트의 추가 상태는 해당 프레임 표를 따른다. 기본 1440/390·관련 위험 상태와 1280/320·200% 배치·키보드·테마·locale를 반환한다. 아래 ID는 화면·상태·variant의 명시적인 요구를 모은 목록이며 신규 메뉴 수가 아니다.\n", "| 화면군 | 명시된 프레임/화면 ID | 상세 정본 |\n| --- | --- | --- |"]
for prompt in prompts:
    content = prompt.read_text()
    ids = sorted(set(re.findall(r"\b(?:P\d{2}-[A-Z]\d{2}(?:-[A-Z]+)*|H\d{2}[-A-Z]*\d{2}|[CFA]\d{2}(?:-[A-Z0-9]+)*|X\d{2}|N\d{2})\b", content)))
    registry.append(f"| P{prompt.name[:2]} | {', '.join(ids) or '해당 프롬프트의 화면 표'} | [{prompt.name}](../prompts/{prompt.name}) |")
registry += ["\n## 신규 메뉴·신규 앱 대응\n", "계정/중앙 신규 10개 후보는 [전체 인벤토리](account-admin-menu-inventory.md) 6절, 앱별 확장 X01~X18와 신규 앱 N01~N11는 [앱 확장 계약](app-expansion-and-new-app-plan.md) 및 P12/P13을 따른다. 기존 탭·상세로 흡수할 항목과 별도 route·앱이 필요한 항목은 반환 디자인에서 결정한다.\n"]
(PACKAGE / "contracts/screen-delivery-registry.md").write_text("\n".join(registry))

source_globs = [
    "apps/dwp/src/features/home/**/*.ts", "apps/dwp/src/features/home/**/*.tsx",
    "apps/dwp/src/features/account/settings-navigation.ts", "apps/dwp/src/features/admin/admin-navigation.ts",
    "apps/dwp/src/features/admin/admin-content.tsx", "apps/dwp/src/routes/administration-routes.tsx",
    "apps/dwp/src/routes/dwaion-routes.tsx", "apps/dwp/src/features/dwaion/dwaion-navigation.ts",
    "apps/dwp/src/features/dwaion/dwaion-artifacts.tsx", "libs/shared-utils/src/api/agent-plan-api.ts",
    "libs/shared-utils/src/api/*home*api.ts", "libs/shared-utils/src/api/home-personalization*.ts",
    "libs/design-system/src/foundation/tokens.ts", "AGENTS.md",
]
source_files = sorted(set(path for pattern in source_globs for path in REPO.glob(pattern) if path.is_file()))
head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
snapshot = {
    "capturedAtUtc": datetime.now(timezone.utc).isoformat(), "repository": str(REPO), "head": head,
    "scope": "read-only source snapshot; includes current working files, not only committed HEAD; no runtime or regression certification",
    "sources": [{"path": str(path.relative_to(REPO)), "bytes": path.stat().st_size, "sha256": digest(path)} for path in source_files],
    "approvedMyApps": {"path": "assets/approved-my-app-2026-09-14.png", "sha256": digest(PACKAGE / "assets/approved-my-app-2026-09-14.png")},
}
(PACKAGE / "contracts/source-snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")

broken = []
for path in PACKAGE.rglob("*.md"):
    for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", path.read_text()):
        if re.match(r"(?:https?://|codex:|#)", target):
            continue
        location = target.split("#", 1)[0]
        location = re.sub(r":\d+$", "", location)
        actual = Path(location) if location.startswith("/") else path.parent / location
        if not actual.exists() and actual.resolve() != (PACKAGE / "contracts/package-verification.json").resolve():
            broken.append({"file":str(path.relative_to(PACKAGE)), "target":target})

verification = {
    "verifiedAtUtc":datetime.now(timezone.utc).isoformat(),
    "kind":"documentation integrity and static menu coverage only; no product tests executed",
    "accountNavigationCount":len(account_routes), "adminNavigationCount":len(admin_routes), "legacyAdminCount":1,
    "inventoryExistingCount":len(rows), "missingInventoryRoutes":missing_inventory, "missingPromptRoutes":missing_prompts,
    "screenPromptCount":len(prompts), "standalonePromptCount":len(list(ready.glob("*.md"))),
    "brokenLocalLinks":broken, "sourceFileCount":len(source_files),
    "files":[{"path":str(path.relative_to(PACKAGE)), "bytes":path.stat().st_size, "sha256":digest(path)} for path in sorted(PACKAGE.rglob("*")) if path.is_file() and path.name != "package-verification.json"],
}
(PACKAGE / "contracts/package-verification.json").write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({key:value for key,value in verification.items() if key != "files"}, ensure_ascii=False, indent=2))
if missing_inventory or missing_prompts or broken or len(account_routes) != 8 or len(admin_routes) != 24 or len(rows) != 33 or len(prompts) != 13:
    raise SystemExit("Documentation coverage needs correction")
