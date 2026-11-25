from pathlib import Path
from backend.app.agents.archaeologist import ArchaeologistAgent

def test_archaeologist_on_sample_legacy_app():
    sample_dir = Path("sample_legacy_app").resolve()
    anatomy = ArchaeologistAgent.inspect(sample_dir)

    assert anatomy["status"] == "completed"
    metrics = anatomy["project_metrics"]
    assert "PHP" in metrics["languages"] or "PHP (Vanilla / Legacy)" in metrics["languages"]
    assert metrics["total_files"] >= 4

    findings = anatomy["findings"]
    assert len(findings) > 0

    # Ensure deprecated mysql_* was detected
    mysql_findings = [f for f in findings if "mysql_" in f["title"].lower() or "deprecated" in f["title"].lower()]
    assert len(mysql_findings) > 0
    assert mysql_findings[0]["evidence_status"] == "verified"
