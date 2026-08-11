"""Discovers skill packages under app/skills/<slug>/ and loads them.

Each package is a self-contained, portable folder:

    app/skills/<slug>/
        SKILL.md   - required. Frontmatter (slug/name/icon/category/author/
                     functional/tool_key/source_url) + a markdown body:
                     description, "## Instructions" (behavior guidance),
                     "## Example". `source_url` is optional - when set, the
                     Skill Detail panel shows a "View on GitHub" / "View
                     source" link, same pattern as LobeHub's skill Info tab.
        tool.py    - optional. Present only when functional: true. Defines a
                     BaseSkill subclass and registers it into skill_registry
                     at import time (see app/framework/skills.py).

Dropping a new folder with a SKILL.md (and optionally a tool.py) is enough to
add a new skill - no other code changes needed. This is what makes skills
portable across teams/deployments: the folder is the whole unit.
"""

import importlib.util
from dataclasses import dataclass
from pathlib import Path

SKILLS_DIR = Path(__file__).parent.parent / "skills"


@dataclass
class SkillDoc:
    slug: str
    name: str
    icon: str
    category: str
    author: str
    functional: bool
    tool_key: str | None
    source_url: str | None
    description: str
    instructions: str  # full markdown body below the frontmatter


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("SKILL.md must start with a '---' frontmatter block")

    meta: dict[str, str] = {}
    i = 1
    while i < len(lines) and lines[i].strip() != "---":
        line = lines[i]
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
        i += 1

    body = "\n".join(lines[i + 1 :]).strip()
    return meta, body


def _load_doc(folder: Path) -> SkillDoc:
    meta, body = _parse_frontmatter((folder / "SKILL.md").read_text(encoding="utf-8"))

    # First paragraph (up to the first blank line or heading) is the description.
    description_lines: list[str] = []
    for line in body.splitlines():
        if not line.strip() or line.startswith("#"):
            break
        description_lines.append(line)

    tool_key = meta.get("tool_key")
    if tool_key in (None, "null", ""):
        tool_key = None

    source_url = meta.get("source_url")
    if source_url in (None, "null", ""):
        source_url = None

    # Guidance text for prompt injection: description + Instructions + Example,
    # but not the trailing "## Tool" section (that's implementation metadata,
    # not something the model needs to see).
    guidance = body.split("\n## Tool", 1)[0].strip()

    return SkillDoc(
        slug=meta["slug"],
        name=meta["name"],
        icon=meta.get("icon", "🧩"),
        category=meta["category"],
        author=meta.get("author", "Agent Marketplace"),
        functional=meta.get("functional", "false").lower() == "true",
        tool_key=tool_key,
        source_url=source_url,
        description=" ".join(description_lines).strip(),
        instructions=guidance,
    )


def _import_tool(folder: Path) -> None:
    """Imports tool.py for its side effect of calling skill_registry.register()."""
    tool_path = folder / "tool.py"
    module_name = f"app._skill_tools.{folder.name.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, tool_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load {tool_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)


_docs_cache: list[SkillDoc] | None = None


def load_skill_docs() -> list[SkillDoc]:
    """Discovers every skill package, importing tool.py where present so
    functional skills self-register into skill_registry. Cached - packages
    are read from disk once per process."""
    global _docs_cache
    if _docs_cache is not None:
        return _docs_cache

    docs: list[SkillDoc] = []
    for folder in sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir()):
        if not (folder / "SKILL.md").exists():
            continue
        doc = _load_doc(folder)
        docs.append(doc)
        if (folder / "tool.py").exists():
            _import_tool(folder)

    _docs_cache = docs
    return docs


def get_doc(slug: str) -> SkillDoc | None:
    return next((d for d in load_skill_docs() if d.slug == slug), None)
