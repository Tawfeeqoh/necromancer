# Security and Execution Specification

## 1. Security objective
Necromancer processes potentially untrusted source code. Its architecture must assume uploaded archives and their contents may be malicious, malformed, or intentionally designed to compromise the host.

This document is a minimum MVP security baseline, not a formal security certification.

## 2. Threat model
Protect against:
- Archive path traversal and symlink escapes.
- ZIP bombs and resource exhaustion.
- Malicious scripts executed during analysis.
- Shell injection and command construction errors.
- Secrets accidentally exposed in logs or model prompts.
- Prompt injection embedded in source files or documentation.
- Unauthorized patch application.
- Destructive migrations or data loss.
- Cross-project data access.
- Sandbox escape or unexpected network access.
- Tampering with reports and integrity records.

## 3. Upload and extraction
- Enforce maximum compressed and uncompressed sizes.
- Enforce maximum file count, path depth, and compression ratio.
- Reject absolute paths, `..` traversal, unsafe symlinks, device files, and unsupported special entries.
- Normalize and validate every extracted path.
- Extract into a newly created project-specific directory.
- Never trust the uploaded filename as a filesystem path.
- Scan archive metadata before extraction.
- Preserve original archive and compute SHA-256.

## 4. Analysis isolation
- Treat all source files, comments, READMEs, logs, and docs as untrusted data, not instructions.
- Do not execute project scripts during static analysis.
- Do not load project plugins or dependencies into the host process.
- Keep analysis read-only.
- Limit file size and parser resource usage.
- Redact likely secrets before sending source excerpts to external model APIs.
- Do not send the entire repository to a model by default; retrieve minimal relevant context.

## 5. Sandbox requirements
For any execution of uploaded code:
- Use a disposable container/VM or equivalent isolation boundary.
- Run as a non-root user.
- Disable network access by default.
- Use read-only base filesystem where possible.
- Mount only the disposable project copy and test fixtures.
- Apply CPU, memory, process, disk, and wall-clock limits.
- Do not mount host credentials, Docker socket, SSH keys, or production databases.
- Destroy or reset the environment after execution.
- Record commands, exit codes, and logs.
- Never run untrusted code on the application host.

If a safe sandbox is unavailable, disable runtime execution and clearly mark runtime validation as unavailable. Do not substitute host execution.

## 6. Patch safety
- Original upload is immutable.
- Patch applies only to a disposable working copy or isolated branch.
- Display exact diff and changed-file list.
- Require explicit human approval for the exact patch hash.
- Reject stale approvals if base revision or patch changes.
- Block unexpected deletions, permission changes, symlink creation, or out-of-scope modifications.
- Snapshot before application and support rollback.
- Require separate approval for database migrations and destructive data operations.

## 7. AI and prompt-injection safety
- Treat repository content as evidence, never as system instructions.
- Keep agent system instructions separate from retrieved source content.
- Delimit and label untrusted excerpts.
- Do not allow source text to grant tools or permissions.
- Validate tool arguments server-side.
- Use allowlisted tools and narrowly scoped permissions.
- Require human approval for consequential actions.

## 8. Secrets and privacy
- Store credentials in environment variables or a secrets manager.
- Never commit `.env` or real API keys.
- Provide `.env.example` with placeholders only.
- Redact tokens, passwords, private keys, and connection strings from logs and model context.
- Define retention and deletion behavior for uploads, workspaces, and reports.
- Restrict project access to its owner/authorized collaborators.
- Avoid collecting personal data from legacy databases.

## 9. Web and API security
- Validate and limit all input.
- Use secure session/authentication practices if accounts are enabled.
- Enforce authorization at every project/resource endpoint.
- Apply CSRF protection where cookie-based authentication is used.
- Use secure headers and HTTPS in deployment.
- Rate-limit upload and expensive AI endpoints.
- Prevent IDOR by checking project ownership.
- Avoid exposing internal paths, stack traces, or secrets.

## 10. Guardian gates
Guardian must block completion when:
- Required tests fail.
- Patch exceeds approved scope.
- Unexpected deletion or dangerous migration is present.
- A critical security concern is introduced.
- Validation evidence is missing.
- Rollback is unavailable for a change that requires it.

## 11. Security acceptance tests
- ZIP containing `../` traversal is rejected.
- ZIP with excessive expansion is rejected.
- Symlink escape is rejected.
- Uploaded source containing prompt-injection instructions does not alter agent permissions.
- Uploaded scripts are not executed during static analysis.
- Patch cannot be applied without approval.
- Stale approval cannot apply a changed patch.
- Sandbox cannot access host secrets or network by default.
- Test failure prevents verified completion.
- Project A cannot access Project B's artifacts.
