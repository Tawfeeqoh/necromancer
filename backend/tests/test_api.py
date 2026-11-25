from fastapi.testclient import TestClient
from pathlib import Path
from backend.app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_full_revival_flow():
    # 1. Create project
    create_res = client.post("/api/v1/projects", json={
        "name": "Legacy Customer Portal",
        "description": "Inherited 2013 billing and auth system"
    })
    assert create_res.status_code == 201
    proj_data = create_res.json()
    project_id = proj_data["id"]

    # 2. Upload zip
    zip_path = Path("sample_legacy_app.zip").resolve()
    with open(zip_path, "rb") as f:
        upload_res = client.post(
            f"/api/v1/projects/{project_id}/uploads",
            files={"file": ("sample_legacy_app.zip", f, "application/zip")}
        )
    assert upload_res.status_code == 202
    upload_data = upload_res.json()
    upload_id = upload_data["id"]

    # 3. Start workflow
    wf_res = client.post(f"/api/v1/projects/{project_id}/workflows", json={
        "upload_id": upload_id,
        "goals": ["understand", "diagnose", "repair"]
    })
    assert wf_res.status_code == 202
    wf_data = wf_res.json()
    workflow_id = wf_data["id"]
    assert wf_data["status"] in ["WAITING_APPROVAL", "RUNNING"]

    # 4. Check findings
    findings_res = client.get(f"/api/v1/projects/{project_id}/findings")
    assert findings_res.status_code == 200
    findings = findings_res.json()
    assert len(findings) > 0

    # 5. Check revival plan
    plan_res = client.get(f"/api/v1/workflows/{workflow_id}/plan")
    assert plan_res.status_code == 200
    tasks = plan_res.json()
    assert len(tasks) > 0
    first_task = tasks[0]

    # 6. Approve first task
    decision_res = client.post(f"/api/v1/tasks/{first_task['id']}/decision", json={
        "decision": "approved",
        "reason": "Authorized isolated migration to modern PDO."
    })
    assert decision_res.status_code == 200
    decision_data = decision_res.json()
    assert decision_data["status"] == "completed"
    assert decision_data["guardian"]["status"] == "passed"

    # 7. Check dossier
    dossier_res = client.get(f"/api/v1/projects/{project_id}/dossier")
    assert dossier_res.status_code == 200
    dossier = dossier_res.json()
    assert len(dossier["dossier_sha256"]) == 64
    assert dossier["guardian_status"] == "passed"
