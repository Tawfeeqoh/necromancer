# Necromancer — Testing Steering

## Test Verification Standards
1. **Never Claim a Pass Without Execution:** All reported test suites, lint runs, and regression checks must originate from actual command execution.
2. **Suite Structure:**
   - `test_archaeologist.py`: Validates file parsing, regex detection, AST inventory.
   - `test_archive_validator.py`: Tests archive validation, ZIP bomb limits, symlink detection.
   - `test_patch_integrity.py`: Verifies real diff generation, atomic `git apply`, and unchanged state on rejection.
   - `test_sandbox_and_guardian.py`: Tests container isolation flags, fallback behavior, regression blocking, and untracked file cleanup during rollback.
   - `test_upload_security.py`: Tests streaming limits, traversal rejection, symlink rejection, and CORS.
   - `test_api.py`: Tests full end-to-end API lifecycle, deterministic dossier generation, and regression blocking.
3. **Reproducibility Requirement:**
   - Running `pytest backend/tests -v` must execute all 15 tests and achieve 100% pass status cleanly.
   - Frontend linting (`npm run lint`) must report 0 errors and 0 warnings.
   - Frontend build (`npm run build`) must complete without TypeScript or bundling errors.
