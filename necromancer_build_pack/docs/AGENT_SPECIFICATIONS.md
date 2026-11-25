# Agent Specifications

## 1. Shared agent contract
All six agents operate under a central orchestrator. They are not unrestricted autonomous processes.

Each agent receives:
- Project/workflow ID.
- Its role and permitted actions.
- Relevant evidence/artifact references.
- Previous structured outputs.
- Explicit constraints and token/time budget.

Each agent returns a schema-validated object:
```json
{
  "status": "completed",
  "summary": "Short result",
  "findings": [],
  "evidence": [],
  "assumptions": [],
  "unknowns": [],
  "risks": [],
  "recommended_next_action": "string",
  "created_at": "ISO-8601"
}
```
Use actual JSON Schema/Pydantic validation in code. This example is illustrative.

### Evidence format
Each material claim should reference:
- `source_type` (file, line range, command output, test, supplied document, etc.)
- `source_ref`
- `excerpt_or_observation`
- `evidence_status` (`verified`, `inferred`, `unknown`)

Never fabricate line numbers, command outputs, commit history, external records, or confidence values.

## 2. Archaeologist Agent
**Mission:** Build a structural map of the supplied codebase.

Responsibilities:
- Detect languages/frameworks from manifests and file patterns.
- Inventory files and directories.
- Identify likely entry points, routes, modules, configuration, migrations, and tests.
- Parse dependency manifests.
- Build a dependency/module map where feasible.
- Flag suspicious dead/duplicate code only as a hypothesis unless verified.
- Classify components as stable, fragile, broken, or unknown only when evidence supports it.

Tools:
- Read-only filesystem access to extracted analysis copy.
- Deterministic parsers and inventory tools.
- No shell execution of uploaded project code.

Output: Codebase Anatomy Report with stack, structure, entry points, dependencies, and evidence-linked findings.

## 3. Historian Agent
**Mission:** Reconstruct likely product purpose and business intent from supplied evidence.

Evidence sources may include:
- README and docs.
- Source comments and names.
- Database schema and migrations.
- Tests and fixtures.
- Git history only if included or authorized.
- Issue/PR exports or screenshots only if supplied/connected with permission.
- Logs and API examples if supplied.

Responsibilities:
- Summarize likely product purpose.
- Identify candidate business rules.
- Link each claim to evidence.
- Distinguish verified behavior from inferred intent.
- Identify unresolved questions.

Restrictions:
- Do not claim access to external services without a configured authorized connector.
- Do not infer user/customer data unnecessarily.
- Never present a guessed rule as verified.

Output: Product Intent Reconstruction.

## 4. Diagnostician Agent
**Mission:** Assess current technical condition and identify risks.

Assess:
- Install/build/start feasibility based on actual commands where safe.
- Dependency age and known vulnerability data only where a reliable source/tool is available.
- Static security patterns.
- Configuration and secrets exposure.
- Database/schema risks.
- Code maintainability.
- Test coverage and failures.
- Core flow failures established by tests or controlled execution.

Severity:
- Critical: likely data loss, severe security exposure, or broken essential flow.
- High: major runtime/dependency/security issue.
- Medium: maintainability, missing tests, non-core feature failures.
- Low: cosmetic, minor documentation, or low-impact cleanup.
- Info: useful observation without immediate risk.

Restrictions:
- Do not claim a complete security audit.
- Do not label a dependency vulnerable without evidence.
- Do not execute untrusted code outside sandbox.

Output: Revival Diagnosis.

## 5. Revival Planner Agent
**Mission:** Turn findings into a staged, risk-aware plan.

Phases:
1. Stabilize.
2. Understand.
3. Secure.
4. Modernize.
5. Improve.
6. Certify.

Every task includes:
- Title and outcome.
- Finding references.
- Affected files/components.
- Dependencies.
- Priority and risk.
- Estimated complexity (qualitative; do not invent precise hours).
- Validation steps.
- Human approval requirement.

Prefer minimal changes that preserve behavior. Do not recommend full rewrite by default.

Output: ordered Revival Plan.

## 6. Resurrection Agent
**Mission:** Generate small, reviewable repair candidates.

Responsibilities:
- Work only in an isolated writable workspace.
- Follow an approved task and plan.
- Generate minimal patches.
- Explain rationale and expected behavior.
- Produce unified diff and changed-file list.
- Identify migrations and data impact.
- Recommend tests.

Restrictions:
- Cannot modify original upload.
- Cannot apply its own patch without separate approval.
- Cannot delete files or perform destructive migration without explicit approval.
- Cannot deploy to production.
- Must stop when scope differs materially from approved task.

Output: Proposed patch, rationale, risk notes, and validation plan.

## 7. Guardian Agent
**Mission:** Independently evaluate proposed/applied changes and validation evidence.

Checks:
- Patch is within approved scope.
- No unexpected file deletion or secret exposure.
- Relevant tests actually ran.
- No known core behavior regression.
- Schema compatibility has been considered.
- Security risks have not worsened.
- Evidence supports the claimed outcome.
- Rollback path exists.

Possible outcomes:
- `passed`
- `blocked`
- `needs_review`

A critical issue or failed required test blocks completion. Guardian must explain findings and cite evidence. It must not simply rubber-stamp the Resurrection Agent.

## 8. Orchestrator responsibilities
- Own workflow state and stage transitions.
- Validate each output.
- Enforce permissions and approval gates.
- Pass only required context to each agent.
- Handle retries and timeouts.
- Record all events.
- Prevent parallel agents from writing to the same workspace.
- Allow safe cancellation and cleanup.

## 9. MVP implementation guidance
For a five-day build, implement agents as bounded tasks coordinated by one orchestrator. Do not build a complex multi-agent platform or assume Kiro IDE agents are automatically available to the deployed runtime.
