# Necromancer — Product Steering

## Mission
Necromancer is an autonomous multi-agent platform for legacy code revival. It restores abandoned, outdated, or undocumented software to modern, secure, and production-ready operational states while preserving critical business logic.

## Scope & MVP Target
- **MVP Workload:** End-to-end revival of an inherited legacy PHP (5.x)/MySQL application.
- **Language / Ecosystem Target:** PHP 5.4-7.0 migration to modern PHP 8.x PDO with bcrypt password hashing and business rule enforcement.
- **Input Modality:** ZIP archive uploads (up to 50MB) containing legacy codebases.
- **Evidence Accountability:** All findings and recovered intent must be tagged with explicit evidence statuses (`verified`, `inferred`, `unknown`) and cited against source files or schema definitions.
- **Non-Goals:** Free-form feature addition, arbitrary framework rewrites without maintainer approval, or automated unverified code deployment.

## Key Principles
1. **Preserve Legacy Intent:** Never drop business rules (such as account lockouts or suspended status guards) for convenience during modernization.
2. **Human in the Loop:** Maintainers must review and authorize unified diff patches before workspace modification.
3. **Cryptographic Proof:** Every successful revival yields a deterministic SHA-256 Revival Dossier linking initial source, applied patch, and verified test results.
