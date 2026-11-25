# Database Schema Specification

## 1. Principles
- Store workflow state and audit history.
- Keep original source immutable.
- Store report/patch artifact references rather than large blobs where practical.
- Use UTC timestamps in storage and convert to user locale in UI.
- Use opaque UUID identifiers.
- Do not store secrets or unnecessary source contents in database records.

## 2. Proposed MVP tables

### users
For MVP this may be omitted if authentication is not implemented. If included:
- `id` UUID primary key
- `email` unique
- `display_name`
- `created_at`

### projects
- `id` UUID primary key
- `owner_id` nullable foreign key
- `name`
- `description` nullable
- `status`
- `created_at`
- `updated_at`

### uploads
- `id` UUID primary key
- `project_id` foreign key
- `original_filename`
- `storage_key`
- `sha256`
- `size_bytes`
- `validation_status`
- `created_at`

### workflows
- `id` UUID primary key
- `project_id` foreign key
- `status`
- `current_stage`
- `started_at`
- `completed_at` nullable
- `error_code` nullable
- `error_message` nullable

### agent_runs
- `id` UUID primary key
- `workflow_id` foreign key
- `agent_name`
- `status`
- `input_artifact_id` nullable
- `output_artifact_id` nullable
- `model_provider` nullable
- `model_name` nullable
- `prompt_version` nullable
- `started_at`
- `completed_at` nullable
- `error_message` nullable

### findings
- `id` UUID primary key
- `project_id` foreign key
- `workflow_id` foreign key
- `agent_name`
- `title`
- `description`
- `severity` (`critical`, `high`, `medium`, `low`, `info`)
- `evidence_status` (`verified`, `inferred`, `unknown`)
- `evidence_json`
- `recommendation` nullable
- `created_at`

### revival_tasks
- `id` UUID primary key
- `project_id` foreign key
- `workflow_id` foreign key
- `title`
- `description`
- `phase`
- `priority`
- `risk_level`
- `status`
- `affected_files_json`
- `validation_plan_json`
- `created_at`
- `updated_at`

### approvals
- `id` UUID primary key
- `project_id` foreign key
- `task_id` foreign key nullable
- `patch_id` foreign key nullable
- `decision` (`approved`, `rejected`)
- `decision_by` nullable
- `reason` nullable
- `created_at`

### patches
- `id` UUID primary key
- `project_id` foreign key
- `task_id` foreign key
- `base_revision`
- `patch_storage_key`
- `patch_sha256`
- `changed_files_json`
- `status` (`proposed`, `approved`, `applied`, `rejected`, `rolled_back`)
- `created_at`
- `applied_at` nullable

### test_runs
- `id` UUID primary key
- `project_id` foreign key
- `patch_id` foreign key nullable
- `status`
- `command`
- `exit_code` nullable
- `stdout_storage_key` nullable
- `stderr_storage_key` nullable
- `started_at`
- `completed_at` nullable

### guardian_reviews
- `id` UUID primary key
- `project_id` foreign key
- `patch_id` foreign key nullable
- `status` (`passed`, `blocked`, `needs_review`)
- `findings_json`
- `created_at`

### artifacts
- `id` UUID primary key
- `project_id` foreign key
- `artifact_type`
- `storage_key`
- `sha256`
- `metadata_json`
- `created_at`

### audit_events
- `id` UUID primary key
- `project_id` foreign key
- `workflow_id` foreign key nullable
- `actor_type` (`user`, `system`, `agent`)
- `actor_id` nullable
- `event_type`
- `event_data_json`
- `created_at`

## 3. Relationships
- One project has many uploads, workflows, findings, tasks, patches, tests, reviews, artifacts, and audit events.
- One workflow has many agent runs, findings, tasks, and audit events.
- One task can have multiple proposed patches over time.
- One patch can have approvals, test runs, and Guardian reviews.
- Preserve historical runs; do not overwrite prior reports.

## 4. Indexes
Create indexes on:
- `projects.owner_id`
- `uploads.project_id`
- `workflows.project_id, status`
- `agent_runs.workflow_id, agent_name`
- `findings.project_id, severity`
- `revival_tasks.workflow_id, status`
- `patches.project_id, status`
- `test_runs.patch_id`
- `audit_events.project_id, created_at`

## 5. Integrity and retention
- Enforce foreign keys.
- Use transactions for state transitions and approvals.
- Keep immutable original upload storage separate from mutable workspace storage.
- Define a retention policy and cleanup job for temporary workspaces.
- Do not delete audit history when a project is reset.
- Avoid storing credentials in any table.

## 6. MVP simplification
SQLite is sufficient for a single-user/demo deployment. Keep schema portable and use migrations. Do not implement a complex multi-tenant permission model unless the product owner explicitly requires it.
