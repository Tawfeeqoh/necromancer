# AGENTS.md — Instructions for AI Coding Agents

## Mission
Build Necromancer as a reliable software archaeology and resurrection platform. The target is one complete, demonstrable revival workflow for a controlled PHP/MySQL legacy application within five days.

Necromancer is the tool that resurrects legacy software; it is not itself the abandoned software.

## Mandatory reading
Before changing code, read:
- `README.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/SECURITY_SPECIFICATION.md`
- `docs/AGENT_SPECIFICATIONS.md`
- The specification relevant to the task being performed.

## Operating rules
1. Inspect the existing repository before making changes.
2. Create or update a task plan before substantial implementation.
3. Implement the smallest complete vertical slice first.
4. Preserve working functionality; do not rewrite working code without a demonstrated need.
5. Follow the architecture, API contracts, schemas, and design system.
6. Do not add dependencies without explaining why they are necessary.
7. Do not invent product requirements, test results, business rules, or evidence.
8. Distinguish `verified`, `inferred`, and `unknown` findings everywhere.
9. Never execute uploaded or untrusted project code on the host machine.
10. Never modify the original uploaded source. Work on an isolated copy/branch.
11. Never apply generated patches without explicit user approval.
12. Never silently delete files, alter data, or run destructive migrations.
13. Do not claim a task is complete until its acceptance criteria and tests pass.
14. Surface blockers immediately; do not hide errors behind mock responses.
15. Keep mock data clearly labelled and confined to development/demo fixtures.
16. Do not build optional Web3 marketplace or reputation features before the core revival workflow works.
17. Do not claim Kiro features are part of runtime orchestration unless implemented and verified as runtime capabilities.

## Task execution protocol
For each task:
1. State the intended outcome and acceptance criteria.
2. Inspect relevant files and dependencies.
3. Identify risks and dependencies.
4. Implement the smallest safe change.
5. Run relevant tests, static checks, and formatting.
6. Review the diff for unintended changes and secrets.
7. Update documentation and task status.
8. Report files changed, commands/tests run, results, known limitations, and next blocker.

## Agent handoff protocol
Use the structured contracts in `docs/AGENT_SPECIFICATIONS.md`. Every agent result must include:
- `status`
- `summary`
- `findings`
- `evidence`
- `assumptions`
- `unknowns`
- `risks`
- `recommended_next_action`
- `created_at`

Reject malformed or incomplete outputs. Do not let downstream agents treat an inference as a verified fact.

## Safety gates
- Uploaded archives are untrusted input.
- Analysis must be read-only.
- Execution occurs only in a disposable, resource-limited sandbox.
- Network access is disabled by default in the sandbox.
- Generated changes are shown as diffs and require approval.
- Tests run against a disposable copy and test database.
- Guardian review is required before a revival can be marked verified.
- Rollback must remain available after applying a patch.

## Scope control
The MVP must support one well-defined target project and one complete workflow. If time is constrained, simplify visualizations and defer integrations rather than compromising safety or end-to-end functionality.

## Definition of done
A task is done only when:
- Its acceptance criteria are met.
- Automated tests pass or failures are explicitly documented.
- No known critical security issue is introduced.
- The change is reviewed for unintended side effects.
- Relevant docs are updated.
- The implementation is integrated with the working application.

## Progress report format
At each milestone report:
- Completed:
- In progress:
- Tests and results:
- Risks/blockers:
- Decisions needed:
- Next tasks:
- Remaining time estimate:

## Change control
Ask the product owner before:
- Changing the core product scope.
- Changing the selected stack or architecture.
- Adding a paid external service.
- Enabling network access for uploaded code.
- Applying destructive data operations.
- Changing the meaning of verified/inferred/unknown.
- Removing human approval or Guardian checks.
