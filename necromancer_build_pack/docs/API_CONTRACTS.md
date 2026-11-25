# API Contracts

## 1. Conventions
- Base path: `/api/v1`
- JSON request/response bodies except multipart upload and file download.
- Use UUIDs for resource IDs.
- Use consistent error shape.
- Return `202 Accepted` for long-running workflow creation.
- Long-running tasks expose status polling; WebSocket/SSE is optional, not required for the first working slice.
- Authenticate and authorize every project-specific endpoint if user accounts are enabled.

## 2. Error response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The uploaded archive could not be accepted.",
    "details": [],
    "request_id": "uuid"
  }
}
```

## 3. Endpoints

### Create project
`POST /projects`
```json
{ "name": "Legacy Billing App", "description": "Inherited PHP application" }
```
Returns `201` with project identity and status.

### Upload source archive
`POST /projects/{project_id}/uploads`
- Content type: `multipart/form-data`
- Field: `file`
- Enforce upload size and archive validation limits.
Returns `202` with upload ID and validation status.

### Start revival workflow
`POST /projects/{project_id}/workflows`
```json
{ "upload_id": "uuid", "goals": ["understand", "diagnose", "repair"] }
```
Returns `202` with workflow ID and initial state.

### Get workflow status
`GET /workflows/{workflow_id}`
Returns:
```json
{
  "id": "uuid",
  "status": "RUNNING",
  "current_stage": "ARCHAEOLOGY",
  "progress": {
    "completed_stages": 1,
    "total_stages": 8
  },
  "updated_at": "ISO-8601"
}
```
Progress is indicative; never fabricate percentage completion.

### Get findings
`GET /projects/{project_id}/findings`
Optional filters: `severity`, `evidence_status`, `agent_name`.

### Get reports
`GET /projects/{project_id}/reports`
Returns report metadata and artifact download links.

### Get revival plan
`GET /workflows/{workflow_id}/plan`

### Approve/reject task
`POST /tasks/{task_id}/decision`
```json
{ "decision": "approved", "reason": "Proceed with the proposed isolated repair." }
```
Only an authorized user can approve. Approval is scoped to the exact patch/task version shown.

### Generate patch
`POST /tasks/{task_id}/patches`
```json
{ "base_revision": "sha256-or-revision-id" }
```
Returns `202` with patch ID and status `proposed`.

### Get patch diff
`GET /patches/{patch_id}`
Returns changed files, unified diff, base revision, patch hash, and status.

### Apply approved patch
`POST /patches/{patch_id}/apply`
No request body required. Reject unless the exact patch has a valid approval and workspace is isolated.

### Run validation
`POST /patches/{patch_id}/tests`
```json
{ "test_profile": "demo-default" }
```
Returns `202` with test run ID.

### Get test result
`GET /test-runs/{test_run_id}`
Returns actual command, exit code, timestamps, and log artifact references. Redact secrets.

### Get Guardian review
`GET /patches/{patch_id}/guardian-review`

### Generate dossier
`POST /workflows/{workflow_id}/dossier`
Returns `202` or completed artifact metadata.

### Verify integrity manifest
`POST /integrity/verify`
```json
{ "manifest_artifact_id": "uuid" }
```
Returns computed hashes and match/mismatch outcomes.

## 4. Status and enums
Workflow states are defined in `TECHNICAL_ARCHITECTURE.md`.
Finding severity: `critical`, `high`, `medium`, `low`, `info`.
Evidence status: `verified`, `inferred`, `unknown`.
Patch status: `proposed`, `approved`, `applied`, `rejected`, `rolled_back`.

## 5. API requirements
- Validate all input.
- Enforce upload and request size limits.
- Apply rate limits to expensive AI/workflow endpoints.
- Use idempotency keys for patch application and other state-changing operations where feasible.
- Do not expose filesystem paths or secrets.
- Return clear conflict responses for stale approvals/base revisions.
- Document actual implementation; do not leave endpoints as pretend stubs.
