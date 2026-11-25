# Specification: Legacy Project Revival Workflow — Tasks

## Corrective Sprint Tasks

- [x] **Task 1: Patch Integrity Engine**
  - Replace hardcoded diffs with `difflib.unified_diff` from workspace files.
  - Enforce `git apply --check` before applying.
  - Remove direct file-overwrite fallback.
  - Add `core.autocrlf false` and newline normalization.
  - Implement atomic commit on patch success.

- [x] **Task 2: Guardian & Sandbox Isolation**
  - Create `SandboxRunner` with strict Docker isolation flags (`--network none`, `--read-only`, `--memory 512m`).
  - Disable dynamic execution when container runtime unavailable.
  - Add `git clean -fd` to rollback to remove untracked artifacts.
  - Verify Guardian regression blocking and rollback restoration.

- [x] **Task 3: Upload Security Hardening**
  - Implement streaming upload size enforcement.
  - Detect and reject ZIP symlinks.
  - Enforce path traversal protections.
  - Restrict CORS origins to trusted hosts.

- [x] **Task 4: Deterministic Dossier Generation**
  - Exclude volatile runtime files from source hashing.
  - Strip volatile timestamps from root dossier hash.
  - Persist dossiers to database.
  - Implement downloadable JSON and Markdown endpoints.

- [x] **Task 5: Frontend Modernization & Real Data Integration**
  - Connect Anatomy, Intent, Diagnosis, Plan, Guardian, and Dossier tabs to live backend APIs.
  - Remove simulated terminal outputs and hardcoded fallback hashes.
  - Apply Necromancer brand design kit (Obsidian `#101113`, Bone White `#E8E6DF`, Rebirth Green `#B5FF5B`).
  - Achieve clean production build and 0-warning lint check.

- [x] **Task 6: Regression Verification & Documentation**
  - Validate 15/15 automated tests covering all security and regression pathways.
  - Document complete deliverables inventory.
