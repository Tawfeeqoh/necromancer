# Necromancer — Security Steering

## Threat Model & Constraints
Untrusted code submitted to Necromancer must be treated as potentially malicious or exploit-laden.

## Critical Guardrails
1. **No Host Execution:** Untrusted legacy code (PHP scripts, test runners, entry points) must NEVER execute directly on the host machine.
2. **Container Sandbox Isolation (`sandbox.py`):**
   - Dynamic execution must occur in disposable Docker containers.
   - Required isolation flags:
     - `--network none` (strict network isolation)
     - `--read-only` root filesystem (with writable tmpfs mounted only at `/workspace/tmp` if needed)
     - `--memory 512m` and `--cpus 1.0` (resource exhaustion limits)
     - `--user 1000:1000` (non-root execution)
     - `--cap-drop ALL` (drop all Linux capabilities)
   - If container isolation is unavailable on the host, dynamic execution is disabled (`SANDBOX_UNAVAILABLE`), preventing insecure fallback to host execution.
3. **Upload Protection (`archive_validator.py`):**
   - Streaming disk-write size enforcement (max 50 MB).
   - Zip bomb rejection (max extraction size 250 MB, max ratio 20x).
   - Zip symlink rejection (`external_attr >> 16 & 0o170000 == 0o120000`).
   - Path traversal prevention (`..` resolution and relative path escaping).
4. **CORS Restrictions:**
   - Origins restricted to explicit trusted hosts (`CORS_ORIGINS`). Wildcard `*` with credentials is strictly prohibited.
