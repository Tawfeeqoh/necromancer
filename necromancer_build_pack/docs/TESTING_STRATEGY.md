# Testing and Evaluation Strategy

## 1. Purpose
Prove that Necromancer performs a real, safe revival workflow rather than generating plausible-looking reports.

## 2. Test layers

### Unit tests
- Archive path validation.
- Hash calculation.
- Manifest parsing.
- Schema validation for agent outputs.
- Workflow state transitions.
- Approval checks.
- Patch metadata and diff handling.
- Severity/evidence classification validation.

### Integration tests
- Upload → validation → extraction.
- Analysis tools → structured reports.
- Orchestrator → agent adapter → validated output.
- Patch approval → isolated application.
- Sandbox → test result capture.
- Guardian → workflow block/pass.
- Dossier generation → hash verification.

### End-to-end tests
Complete the user journey from ZIP upload through dossier generation using the controlled demo project.

### Security tests
Use cases in `SECURITY_SPECIFICATION.md`, including archive traversal, prompt injection, unauthorized patching, and sandbox boundaries.

## 3. Controlled legacy test project
Create or select a small PHP/MySQL application with a known baseline. Document:
- Intended product purpose.
- Expected routes and core flows.
- Database schema and expected constraints.
- Known seeded defects.
- Known obsolete dependencies.
- Expected behavior before and after each repair.
- Test commands and expected results.

Do not use a real production application or sensitive data as the demo fixture.

## 4. Seeded test scenarios
At minimum include:
1. Deprecated dependency detected from manifest.
2. Missing documentation leads to explicit unknowns, not invented history.
3. Broken core flow is detected by a failing test or controlled runtime check.
4. A known business rule is recovered from source/test/schema evidence.
5. A proposed patch fixes a known issue.
6. A deliberately regressive patch is blocked by Guardian.
7. A patch cannot be applied without approval.
8. Original upload hash remains unchanged.
9. Dossier hashes can be independently recomputed.

## 5. Agent evaluation
For each agent, assess:
- Schema validity.
- Evidence references resolve.
- No unsupported claims.
- Required fields are present.
- Output is relevant to role.
- Tool permissions are respected.
- Runtime/cost is within configured limits.

Use a small fixed evaluation set and record misses. Do not optimize solely for a single successful demo.

## 6. Required demo acceptance checklist
- ZIP accepted and safely extracted.
- Stack and structure identified correctly.
- Architecture report contains real project details.
- Intent reconstruction cites evidence and marks uncertainty.
- Seeded issues appear in diagnosis.
- Plan is actionable and prioritized.
- Patch diff is visible.
- Approval gate is enforced.
- Tests actually execute in isolation.
- Guardian blocks the seeded regression.
- Dossier contains actual findings and test results.
- Original and revived hashes verify.

## 7. Test reporting
Every test run records:
- Test profile.
- Command.
- Start/end time.
- Exit code.
- Pass/fail summary.
- Log artifact reference.
- Environment/runtime information.
- Whether the run was isolated.

Never display a passing state if the command did not execute or results are missing.

## 8. Release gate
Do not deploy a release candidate if:
- Critical security tests fail.
- End-to-end workflow is broken.
- Patch approval can be bypassed.
- Uploaded code executes on the host.
- Dossier claims cannot be traced to evidence.
- The demo depends on unlabelled mock data.
