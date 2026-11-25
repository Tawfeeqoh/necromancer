# Implementation Tasks and Five-Day Delivery Plan

## Working agreement
- Keep one owner per task.
- Integrate continuously.
- A task is complete only when its acceptance criteria pass.
- Protect the end-to-end workflow from feature creep.
- Report blockers early.

## Day 1 — Foundation and intake
- [ ] Create repository and branch protections.
- [ ] Create frontend/backend skeleton.
- [ ] Configure local development and `.env.example`.
- [ ] Create database migrations.
- [ ] Implement project creation.
- [ ] Implement ZIP upload limits and archive validation.
- [ ] Implement safe extraction.
- [ ] Preserve original archive and compute SHA-256.
- [ ] Implement deterministic file inventory and stack detection.
- [ ] Display first Codebase Anatomy Report.
- **Exit gate:** A user uploads the controlled ZIP and sees a real structural report.

## Day 2 — Intent and diagnosis
- [ ] Implement structured agent adapter.
- [ ] Implement Archaeologist output validation.
- [ ] Implement Historian with evidence references.
- [ ] Implement Diagnostician.
- [ ] Implement finding persistence and filtering.
- [ ] Display verified/inferred/unknown labels.
- [ ] Build diagnosis and intent screens.
- **Exit gate:** The system explains the project and seeded issues with traceable evidence.

## Day 3 — Plan and patch
- [ ] Implement Revival Planner.
- [ ] Persist prioritized tasks and dependencies.
- [ ] Implement isolated working copy.
- [ ] Generate patch candidates for a narrow repair.
- [ ] Display unified diff.
- [ ] Implement explicit approval bound to patch hash/base revision.
- [ ] Apply approved patch only in isolated workspace.
- [ ] Implement rollback/snapshot.
- **Exit gate:** A user reviews and approves one repair and sees it applied to the isolated copy.

## Day 4 — Validation and dossier
- [ ] Configure disposable sandbox or explicitly disable runtime execution.
- [ ] Implement test runner and log capture.
- [ ] Implement Guardian review.
- [ ] Seed and demonstrate a regression that Guardian blocks.
- [ ] Implement dossier generation.
- [ ] Include original/revived/dossier hashes.
- [ ] Implement integrity verification.
- **Exit gate:** A patch is tested, unsafe behavior is blocked, and a verifiable dossier is produced.

## Day 5 — Integration and release
- [ ] Complete end-to-end integration.
- [ ] Run security acceptance tests.
- [ ] Fix critical bugs.
- [ ] Polish primary screens and responsive behavior.
- [ ] Configure deployment and secrets.
- [ ] Deploy and smoke-test.
- [ ] Prepare public repository and license.
- [ ] Confirm Kiro artifacts are committed and valid.
- [ ] Record and review demo video.
- [ ] Prepare fallback demo materials.
- **Exit gate:** The complete demonstrated workflow works reliably on the deployed application.

## Priority policy
P0: safety, upload, end-to-end workflow, real analysis, patch approval, tests, Guardian, dossier.
P1: polished architecture visualization, GitHub import, richer report export.
P2: blockchain anchoring, bounty marketplace, reputation, broad language support.

## Daily report
- Completed:
- In progress:
- Test evidence:
- Blockers:
- Decisions required:
- Next-day commitment:
