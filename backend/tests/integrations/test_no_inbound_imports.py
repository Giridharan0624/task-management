"""Static-analysis CI gates protecting the additivity contract.

1. No file under any of the existing 12 contexts may import from
   `contexts.integrations` — the integration platform depends on others;
   nothing else may depend on it.

2. No file inside the integrations *platform* code (anything not under
   `connectors/`) may import from a specific connector. Platform must
   reach connectors only through the registry.

If either rule is broken, deploy must fail before merge.
"""
from __future__ import annotations

from pathlib import Path

import pytest


SRC_DIR = Path(__file__).resolve().parents[2] / "src"
CONTEXTS_DIR = SRC_DIR / "contexts"

EXISTING_CONTEXTS = (
    "user",
    "task",
    "project",
    "comment",
    "attendance",
    "dayoff",
    "taskupdate",
    "activity",
    "upload",
    "org",
    "system",
)


def _python_files(root: Path) -> list[Path]:
    return [p for p in root.rglob("*.py") if "__pycache__" not in p.parts]


def test_no_existing_context_imports_from_integrations() -> None:
    bad: list[str] = []
    for ctx in EXISTING_CONTEXTS:
        ctx_dir = CONTEXTS_DIR / ctx
        if not ctx_dir.exists():
            continue
        for path in _python_files(ctx_dir):
            text = path.read_text(encoding="utf-8")
            if "contexts.integrations" in text or "from contexts.integrations" in text:
                bad.append(str(path.relative_to(SRC_DIR)))
    assert not bad, (
        "additivity violation: existing contexts must not import from "
        f"contexts.integrations: {bad}"
    )


def test_platform_does_not_import_specific_connector() -> None:
    """Only `bootstrap.py` is allowed to import connectors directly — that's
    the single seam where the registry gets populated at cold start. Every
    other platform module must reach connectors only through the registry."""
    integrations_root = CONTEXTS_DIR / "integrations"
    connectors_root = integrations_root / "connectors"
    bootstrap = integrations_root / "bootstrap.py"
    bad: list[str] = []
    for path in _python_files(integrations_root):
        if connectors_root in path.parents or path == connectors_root:
            continue
        if path.name == "__init__.py":
            continue
        if path == bootstrap:
            continue
        text = path.read_text(encoding="utf-8")
        for marker in (
            "contexts.integrations.connectors.",
            "from contexts.integrations.connectors",
        ):
            if marker in text:
                bad.append(f"{path.relative_to(SRC_DIR)} :: {marker}")
    assert not bad, (
        "platform-vs-connector violation: platform code must reach connectors "
        f"only through the registry: {bad}"
    )
