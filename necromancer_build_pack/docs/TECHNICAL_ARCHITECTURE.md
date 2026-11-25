# Technical Architecture Specification

## 1. Architectural goals
- Deliver one reliable end-to-end revival workflow quickly.
- Keep uploaded code isolated from the application host.
- Separate orchestration, analysis, patching, testing, and presentation.
- Make every agent output structured and traceable.
- Allow later expansion to more languages and integrations without overengineering the MVP.

## 2. Proposed stack
This is a recommended baseline; validate compatibility and hosting constraints before locking it.
- Frontend: React + TypeScript.
- Styling: Tailwind CSS or an equivalent consistent design system.
- Motion: Framer Motion only where it improves feedback.
- Backend: Python + FastAPI.
- Persistence: SQLite for a single-instance MVP; migrate to PostgreSQL when concurrency/deployment requires it.
- Analysis: Python standard tooling and language-specific parsers; do not rely solely on LLM guesses.
- Versioning/diffs: Git.
- Tests: Pytest for backend/orchestration; project-specific commands inside sandbox.
- Architecture visualization: React Flow or a simpler graph component.
- Integrity: SHA-256.
- Runtime AI: model/API integration selected by the team; credentials via environment variables.
- Kiro: use supported IDE/CLI/Web capabilities, specs, steering, hooks, custom agents, and MCP where genuinely applicable.

## 3. Logical components
1. Web UI
2. API service
3. Project intake and archive validator
4. Project workspace manager
5. Workflow orchestrator
6. Agent execution adapter
7. Deterministic analysis tools
8. Patch manager
9. Sandbox manager
10. Test runner
11. Guardian evaluator
12. Dossier and integrity service
13. Persistence layer
14. Audit/event log

## 4. High-level data flow
Browser → API → intake validator → immutable original storage → isolated workspace → orchestrator → analysis/agent tasks → findings and plan → approved patch → sandbox test → Guardian → dossier/hash.

## 5. Orchestration model
Use a central state machine rather than free-running agents.

Suggested states:
`CREATED`, `UPLOADING`, `VALIDATING_ARCHIVE`, `EXTRACTING`, `ARCHAEOLOGY`, `HISTORIAN_ANALYSIS`, `DIAGNOSIS`, `PLANNING`, `AWAITING_APPROVAL`, `PATCHING`, `TESTING`, `GUARDIAN_REVIEW`, `COMPLETED`, `BLOCKED`, `FAILED`, `CANCELLED`.

Transitions must be explicit. A failed stage should preserve logs and allow safe retry where possible. Approval is a required transition before patch application.

## 6. Workspace and artifact model
Each project receives:
- Immutable original archive.
- Extracted read-only analysis copy.
- Disposable writable repair workspace.
- Patch/diff artifacts.
- Test workspace/container.
- Reports and dossier.
- Audit events.

Use generated opaque IDs rather than trusting uploaded filenames as paths.

## 7. Agent execution
- Agents receive only the minimum context and tools needed.
- Deterministic tools should do file inventory, parsing, hashing, dependency manifest extraction, and test execution.
- LLM agents interpret evidence and produce structured recommendations.
- Validate all agent output against schemas.
- Record model/provider, prompt/spec version, timestamps, and tool calls where feasible.
- Apply timeouts, token/cost limits, and retry limits.
- Do not give every agent unrestricted filesystem or shell access.

## 8. Deterministic versus AI responsibilities
**Deterministic tools:** archive validation, file listing, hashes, manifest parsing, static checks, test execution, diff generation, schema validation.

**AI-supported tasks:** explaining architecture, reconstructing likely intent, classifying findings, prioritizing risks, proposing repair approaches, generating patch candidates.

AI output must never be treated as execution evidence. Only actual tool/test output can establish that a command ran or a test passed.

## 9. API and persistence
Follow `DATABASE_SCHEMA.md` and `API_CONTRACTS.md`. Keep the frontend independent of internal agent prompts. Persist workflow state and events so page refreshes do not lose progress.

## 10. Failure handling
- Network/model errors: retry with bounded backoff; then mark stage blocked/failed.
- Invalid agent output: request one structured correction; then fail visibly.
- Sandbox failure: retain logs, do not mark tests passed.
- Patch failure: discard disposable workspace or restore snapshot.
- Guardian critical finding: block completion.
- User cancellation: stop new work and clean up temporary resources safely.

## 11. Observability
Record:
- Workflow/project ID.
- Stage transitions.
- Agent start/end and status.
- Tool invocations and exit codes.
- Model usage/cost where available.
- Test results.
- Patch hashes.
- Approval identity/time.
- Errors and retry attempts.

Never log secrets or full sensitive source contents unnecessarily.

## 12. Repository layout
```text
necromancer/
├── AGENTS.md
├── README.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── orchestrator/
│   │   ├── agents/
│   │   ├── analysis/
│   │   ├── sandbox/
│   │   └── reporting/
│   ├── tests/
│   └── pyproject.toml
├── docs/
├── test-projects/
├── scripts/
├── .kiro/
└── .env.example
```

## 13. Five-day implementation order
Day 1: skeleton, upload, validation, extraction, deterministic inventory, first report.
Day 2: intent reconstruction, diagnosis, structured agent contracts, UI findings.
Day 3: plan, diff generation, approval, isolated patch application.
Day 4: sandbox tests, Guardian, rollback, dossier, hashes.
Day 5: end-to-end integration, hardening, deployment, demo rehearsal.

## 14. Architecture decisions requiring approval
Do not silently decide: sandbox technology/provider, AI provider/model, hosting provider, external MCP services, retention policy, and whether GitHub import is in MVP.
