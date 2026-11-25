# Specification: Legacy Project Revival Workflow — Requirements

## 1. Overview
The Legacy Project Revival Workflow takes an untrusted legacy code archive, performs multi-agent archaeological analysis and intent reconstruction, identifies architectural and security risks, proposes an actionable modernization roadmap, generates surgical unified diff patches, enforces human maintainer approval, and certifies behavioral preservation with cryptographic proof.

## 2. Functional Requirements
- **FR-1 (Archive Intake):** Accept ZIP archives up to 50MB with streaming size enforcement, path traversal rejection, and symlink protection.
- **FR-2 (Multi-Agent Analysis):**
  - Extract project metrics, entry points, and database schemas (Archaeologist).
  - Recover primary business purpose and rules with evidence citations (Historian).
  - Flag deprecated runtime APIs and security vulnerabilities with severity ratings (Diagnostician).
  - Structure prioritized remediation tasks with validation plans (Planner).
- **FR-3 (Patch Generation & Human Gate):**
  - Generate real unified diffs from actual workspace files (Resurrection).
  - Enforce explicit human review and approval before workspace modification.
  - Apply patches atomically via `git apply` with `--check` verification.
- **FR-4 (Guardian Verification & Isolation):**
  - Run syntax lint and regression test runners in containerized sandboxes.
  - Block patches that introduce regressions or fail tests.
  - Provide complete rollback restoring tracked and untracked workspace state.
- **FR-5 (Cryptographic Proof):**
  - Calculate deterministic SHA-256 hashes of original archive, revived codebase, and composite dossier.
  - Offer exportable JSON and Markdown dossiers.
