# Deployment and Operations Guide

## 1. Goal
Deploy a stable public MVP demo while keeping untrusted project execution isolated from the web application.

## 2. Deployment architecture
Recommended separation:
- Frontend static hosting.
- Backend API service.
- Persistent database/storage.
- Separate sandbox worker or isolated execution service.
- Model API access from backend only.

Do not deploy a design where the public API server directly executes uploaded source code.

## 3. Environment configuration
Create `.env.example` with placeholders for:
```dotenv
APP_ENV=development
APP_SECRET=replace_me
DATABASE_URL=sqlite:///./necromancer.db
AI_PROVIDER=replace_me
AI_API_KEY=replace_me
UPLOAD_STORAGE_PATH=./storage/uploads
ARTIFACT_STORAGE_PATH=./storage/artifacts
SANDBOX_PROVIDER=disabled
MAX_UPLOAD_MB=50
```
Adjust names to the actual implementation. Never commit real values.

## 4. Pre-deployment checklist
- All required tests pass.
- Production secrets configured securely.
- Debug mode disabled.
- HTTPS enabled.
- Upload limits configured.
- CORS restricted to intended frontend origin.
- Authentication/authorization enabled if user data is stored.
- Rate limits enabled.
- Sandbox isolated and resource-limited.
- Network disabled for sandbox by default.
- Storage permissions restricted.
- Logs redact secrets.
- Database migrations tested.
- Backup and cleanup procedures documented.
- Health checks available.

## 5. Deployment sequence
1. Provision frontend, API, database, artifact storage, and sandbox separately.
2. Configure environment variables.
3. Run database migrations.
4. Deploy backend.
5. Deploy frontend with correct API base URL.
6. Verify health endpoint.
7. Upload a harmless test archive.
8. Run static analysis.
9. If sandbox is configured, run the controlled demo test.
10. Verify dossier download and hash check.
11. Review logs for errors and accidental secret exposure.

## 6. Operations
- Monitor API errors, workflow failures, model usage, storage usage, and sandbox resource consumption.
- Set maximum workflow duration and cancellation behavior.
- Clean temporary workspaces after configured retention.
- Preserve required audit artifacts.
- Rotate credentials if exposure is suspected.
- Do not retain uploaded code indefinitely without a clear product policy.

## 7. Demo fallback
If external model access or sandbox execution fails during presentation:
- Clearly label any fallback as a prerecorded or fixture-based demonstration.
- Do not present fixture output as live analysis.
- Keep a known-good demo archive and pre-generated report available.
- Explain which portions are live and which are fallback.

## 8. Open deployment decisions
Confirm hosting provider, domain, database/storage service, sandbox provider, model provider, budget, and retention policy before production deployment.
