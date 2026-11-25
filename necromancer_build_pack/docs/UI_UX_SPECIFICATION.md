# UI/UX Design Specification

## 1. Experience principles
Necromancer should feel like a serious, high-quality engineering product, not a generic AI dashboard or cyberpunk-themed demo.

Design principles:
- Clear hierarchy and excellent typography.
- Strong editorial copy and purposeful motion.
- Calm, confident interface; avoid excessive glow, neon, skulls, flames, and cliché horror imagery.
- Show evidence, not decorative AI theatrics.
- Make dangerous actions and approval states unmistakable.
- Prioritize desktop for the engineering workspace while remaining responsive.

## 2. Product narrative
The interface should communicate four stages:
1. The abandoned system is received.
2. Its structure and intent are investigated.
3. A controlled revival is performed.
4. The revived system is verified and documented.

Suggested product line:
**“Recover what the code was meant to do. Restore what still matters. Prove what works.”**

## 3. Information architecture
- Landing / project list.
- New revival project.
- Upload and intake.
- Revival workspace.
- Overview.
- Architecture.
- Intent reconstruction.
- Diagnosis.
- Revival plan.
- Patch review.
- Test results.
- Guardian review.
- Revival dossier.

## 4. Core screens

### Project intake
- Explain accepted ZIP format and limits.
- Show security/privacy note.
- Drag-and-drop and browse controls.
- Show validation and extraction status.
- Never imply code is safe merely because upload succeeded.

### Revival workspace
- Project identity and workflow status.
- Stage timeline with completed/current/blocked states.
- Summary of verified findings and open questions.
- Recent agent activity with understandable descriptions.
- Clear next action.

### Architecture view
- File/module hierarchy.
- Entry points and dependency relationships.
- Distinguish observed links from inferred relationships.
- Provide accessible list/table alternative to graph.

### Intent reconstruction
- Product purpose summary.
- Candidate business rules.
- Evidence references and status labels.
- Unknowns/questions for human confirmation.

### Diagnosis
- Severity filters.
- Finding title, explanation, evidence, impact, recommendation.
- Do not use severity color as the only indicator.

### Revival plan
- Phased task list.
- Priority, risk, dependencies, affected files.
- Validation method.
- Approval state.

### Patch review
- Unified diff with syntax highlighting.
- Changed files and summary.
- Risk and migration notes.
- Explicit approve/reject controls.
- Make clear that approval applies to the displayed patch version.

### Testing and Guardian
- Actual command and exit code.
- Test totals and failure details when available.
- Guardian status and rationale.
- Never display a success state before results exist.

### Dossier
- Downloadable report.
- Original/revived hashes.
- Findings, changes, tests, Guardian outcome, limitations.
- Integrity verification result.

## 5. Design system
Define tokens for:
- Color: neutral foundation, one restrained primary accent, semantic success/warning/error/info.
- Typography: display, heading, body, mono/code.
- Spacing: consistent scale.
- Radius, borders, shadows, elevation.
- Buttons, inputs, tabs, cards, badges, tables, dialogs, toasts, code diff.
- Focus, hover, disabled, loading, empty, error states.

Avoid choosing final brand colors without a design review. Ensure contrast meets WCAG AA where practical.

## 6. Interaction requirements
- Show progress for long-running work.
- Preserve workspace state on refresh.
- Allow cancellation where safe.
- Explain blocked stages and recovery actions.
- Confirm destructive or consequential actions.
- Keyboard-accessible navigation and dialogs.
- Respect reduced-motion preferences.
- Avoid fake live logs or fabricated progress.

## 7. Content tone
Use precise, calm, engineering-oriented language.
Prefer “Evidence suggests…” over “We discovered with certainty…” when appropriate.
Use labels: Verified, Inferred, Unknown.
Avoid anthropomorphic agent chatter and exaggerated claims.

## 8. Responsive behavior
- Desktop: full workspace, side navigation, multi-panel analysis.
- Tablet: collapsible navigation and stacked panels.
- Mobile: project status, findings, and reports remain readable; complex diff editing can be limited.

## 9. MVP design priority
Polish the upload, workspace, findings, patch review, test result, and dossier screens. Simplify secondary visualizations before sacrificing core workflow clarity.
