# Product Requirements Document (PRD)

## 1. Product overview
**Name:** Necromancer  
**Category/positioning:** AI-powered software archaeology and resurrection platform.

Necromancer helps developers and organizations revive abandoned, outdated, or poorly understood software. It reconstructs what a system appears to do and why, diagnoses its condition, proposes controlled repairs, validates behavior, and produces a traceable revival dossier.

Necromancer is the tool. The uploaded legacy application is the subject being revived.

## 2. Problem
Legacy software becomes difficult to maintain when:
- Original developers leave and context disappears.
- Documentation is missing or stale.
- Dependencies and runtimes become obsolete.
- Valuable business rules remain hidden in code.
- Small changes risk breaking production behavior.
- The software is abandoned even though the problem it solved remains.

Traditional modernization requires costly manual reverse engineering before safe changes can begin.

## 3. Target users
- Developers inheriting unfamiliar codebases.
- Organizations maintaining old internal applications.
- Startups inheriting acquired software.
- Open-source maintainers and contributors.
- Universities or public institutions maintaining legacy systems.

## 4. MVP user story
As a developer who has inherited an undocumented, partially broken PHP application, I want to upload the project, understand its structure and purpose, see its risks, receive a staged repair plan, approve a small repair, and verify the result so I can decide how to maintain or modernize it safely.

## 5. MVP workflow
1. User creates a revival project.
2. User uploads a ZIP archive.
3. System validates and safely extracts the archive.
4. Archaeologist produces a structural report.
5. Historian reconstructs intent from available evidence.
6. Diagnostician identifies technical and behavioral risks.
7. Revival Planner proposes a prioritized plan.
8. User selects and approves a repair task.
9. Resurrection Agent creates a patch in an isolated working copy.
10. UI displays the diff and asks for approval before applying it.
11. Tests run in a sandbox against a disposable copy/database.
12. Guardian evaluates results and blocks unsafe or regressive changes.
13. User receives a revival dossier and integrity hashes.

## 6. Functional requirements

### FR-01 Project intake
- Accept ZIP uploads within configured size limits.
- Validate file type and archive contents.
- Reject path traversal, symlinks, archive bombs, and unsupported archive structures.
- Preserve the original upload unchanged.
- Show upload, validation, extraction, and analysis status.

### FR-02 Codebase archaeology
- Detect primary language and likely framework.
- Identify project structure, entry points, configuration files, dependency manifests, routes where feasible, and database artifacts.
- Produce a file/module inventory.
- Identify likely obsolete or unused components only when evidence supports the finding.
- Label uncertain results as inferred or unknown.

### FR-03 Intent reconstruction
- Examine available README/docs, comments, route names, schema names, tests, commit metadata if supplied, and other uploaded evidence.
- Summarize likely application purpose and key business rules.
- Attach evidence references to material claims.
- Do not invent missing history or claim access to GitHub/Slack unless connected and authorized.

### FR-04 Diagnosis
Assess, where technically possible:
- Runtime/build status.
- Dependency age and maintenance indicators.
- Security patterns.
- Data/schema risks.
- Code organization and maintainability.
- Critical business logic.
- UI/UX issues observable from supplied artifacts.
- Test coverage and failing behavior.

### FR-05 Revival plan
- Prioritize by severity, impact, dependency, and risk.
- Separate stabilization, understanding, security, modernization, improvement, and certification.
- Explain expected outcome, files affected, risk, and validation for each task.
- Avoid recommending a full rewrite as the default.

### FR-06 Controlled repair
- Generate small patches.
- Show a diff before application.
- Require explicit approval.
- Apply only to an isolated working copy/branch.
- Record patch identity and changed files.
- Support rollback to the prior safe state.

### FR-07 Guardian verification
- Run configured tests and safety checks.
- Compare expected behavior with observed results where tests/fixtures exist.
- Detect failed tests, schema incompatibilities, and policy violations.
- Block completion if critical checks fail.
- Explain the reason for a block and propose a follow-up task.

### FR-08 Revival dossier
Include:
- Project identity and source fingerprint.
- Detected stack and architecture summary.
- Intent reconstruction and evidence.
- Diagnosis and severity.
- Approved plan and completed tasks.
- Patch/change summary.
- Test commands, outputs, timestamps, and pass/fail states.
- Guardian findings.
- Known limitations and unresolved risks.
- SHA-256 hashes for original and revived artifacts and dossier manifest.

### FR-09 User experience
- Show workflow progress and current stage.
- Display evidence and confidence/status labels.
- Provide architecture and dependency visualizations where supported.
- Provide clear approval and stop controls.
- Keep logs and agent activity understandable.

## 7. Non-functional requirements
- Safety: untrusted code is never executed on the host.
- Integrity: original upload remains immutable.
- Traceability: claims, patches, and test results are recorded.
- Reliability: failures are visible and recoverable.
- Performance: analysis is asynchronous and progress is surfaced.
- Accessibility: keyboard-accessible controls, readable contrast, semantic structure.
- Responsive: core workflow works on desktop and tablet; mobile receives a usable read-only/limited experience.
- Privacy: user uploads are private by default and deleted according to an explicit retention policy.

## 8. MVP exclusions
- Universal support for all languages/frameworks.
- Autonomous production deployment.
- Automatic destructive migrations.
- Guaranteed recovery of undocumented business logic.
- Full penetration testing or formal security certification.
- Bounty marketplace and contributor reputation.
- Mandatory blockchain integration.
- Automatic access to private GitHub, Slack, ticketing, or cloud accounts without explicit connectors and permissions.

## 9. Product truth and evidence language
Every material finding must be classified:
- **Verified:** directly observed through source, configuration, execution, or test evidence.
- **Inferred:** plausible interpretation supported by cited evidence.
- **Unknown:** evidence is insufficient.

Never present an inference as a fact.

## 10. MVP acceptance criteria
The MVP is acceptable when a user can complete one end-to-end revival of the selected controlled PHP/MySQL demo, review and approve a patch, observe real test execution, see Guardian block a seeded regression or unsafe change, and download a dossier containing verifiable evidence.

## 11. Success metrics
- Successful completion rate of the end-to-end demo workflow.
- Percentage of seeded known issues correctly identified.
- Precision of evidence-backed findings.
- Percentage of generated patches that pass relevant tests.
- Number of regressions correctly blocked.
- Time from upload to first useful report.
- Dossier completeness and hash verification success.

## 12. Open decisions
Confirm before implementation:
- Maximum upload size and retention period.
- Exact PHP/runtime version for the demo target.
- AI provider/model and budget.
- Sandbox provider/technology and resource limits.
- Deployment provider and public demo domain.
- Whether Git history is included in the first ZIP-based workflow.
