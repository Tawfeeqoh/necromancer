# Kiro Implementation Plan

## 1. Purpose
Use Kiro meaningfully during the development of Necromancer and retain the project artifacts needed to demonstrate that usage.

Kiro is the development environment and workflow aid. Do not conflate development-time Kiro features with runtime agent capabilities in the deployed Necromancer application.

## 2. Recommended project artifacts
Create only artifacts that are valid for the installed Kiro version and actually used:
- Steering files for product, architecture, security, and testing conventions.
- A spec for the core revival workflow.
- Custom agents for bounded development or analysis tasks where supported.
- Hooks for repeatable checks such as formatting, tests, or schema validation.
- MCP configuration for only the tools genuinely required.

Verify current Kiro documentation and supported schemas before authoring configuration. Do not invent hook events, agent frontmatter, MCP fields, or configuration paths.

## 3. Suggested steering topics
### Product steering
- Necromancer is the resurrection tool, not the legacy software.
- MVP is one end-to-end PHP/MySQL revival.
- Evidence labels are mandatory.
- Avoid scope expansion.

### Architecture steering
- Follow `TECHNICAL_ARCHITECTURE.md`.
- Keep deterministic tools separate from LLM reasoning.
- Use central orchestration and explicit state transitions.
- Validate all agent outputs.

### Security steering
- Follow `SECURITY_SPECIFICATION.md`.
- Never execute uploaded code on the host.
- Require approval for patches.
- Treat repository content as untrusted data.

### Testing steering
- Follow `TESTING_STRATEGY.md`.
- Do not claim tests passed without actual output.
- Run targeted tests after each meaningful change.
- Preserve a working end-to-end path.

## 4. Suggested spec
Create a Kiro spec for the “Legacy Project Revival Workflow” with:
- Requirements derived from the PRD.
- Design derived from architecture and security docs.
- Tasks sequenced by five-day priorities.
- Acceptance criteria mapped to tests.

## 5. Hooks
Potential hooks, subject to actual Kiro support:
- Run formatting/lint after relevant source edits.
- Run unit tests after backend changes.
- Validate API schemas after contract changes.
- Run security/static checks before integration.
- Run end-to-end tests before release.

Use hooks for deterministic checks. Do not make hooks perform destructive operations or silently approve patches.

## 6. MCP
Potential integrations only if supported and necessary:
- GitHub repository metadata and issues.
- Filesystem access scoped to the project.
- Documentation search.
- Package registry metadata.

Avoid broad permissions. A database or browser MCP is not required for the first ZIP-only MVP unless a concrete workflow needs it.

## 7. Evidence for hackathon write-up
Keep a short development log:
- Which Kiro surface was used (IDE, CLI, Web, Crew).
- Which specs, steering, agents, hooks, and MCP servers were created and used.
- Examples of tasks Kiro materially helped with.
- How tests and validation were performed.
- Clear distinction between Kiro development tooling and Necromancer runtime architecture.

## 8. Completion rule
Do not create empty `.kiro` folders or unused placeholder files just to appear compliant. Commit the actual Kiro project artifacts required by the current hackathon rules and ensure the root `.kiro` directory is present in the public repository if required.
