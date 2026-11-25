# Necromancer — Architecture Steering

## Core Architecture Pattern
Necromancer employs a centralized orchestrator pattern governing six specialized runtime agents with unidirectional state progression:

```
ARCHAEOLOGY -> HISTORIAN -> DIAGNOSIS -> PLANNING -> RESURRECTION -> GUARDIAN
```

## Runtime Agents
1. **Archaeologist Agent (`archaeologist.py`):** Deterministic AST, regex, and file analysis to inventory language, dependencies, database schemas, and entry points.
2. **Historian Agent (`historian.py`):** Reconstructs business intent and product purpose from schemas, comments, and routes.
3. **Diagnostician Agent (`diagnostician.py`):** Detects breaking runtime changes, deprecated functions (e.g. `mysql_*`), and vulnerabilities (e.g. SQLi, weak hashing).
4. **Planner Agent (`planner.py`):** Generates phased, risk-ranked remediation roadmaps with validation criteria.
5. **Resurrection Agent (`resurrector.py`):** Produces reviewable unified Git diffs (`difflib.unified_diff`) against actual workspace files.
6. **Guardian Agent (`guardian.py`):** Independently verifies patched workspaces using containerized sandboxes, static security linters, and regression test suites.

## Deterministic Workspace Isolation
- Each project workspace is isolated in `workspaces/<project_id>` with its own local Git repository initialized at `HEAD` (baseline commit).
- Patch application is atomic via `git apply` with a check phase. No file-overwrite fallbacks are permitted.
- Rollback operates cleanly via `git reset --hard <commit>` and `git clean -fd` to remove untracked artifacts.
- Source codebase hashing excludes volatile runtime files (`.sqlite`, `.log`, `.tmp`).
