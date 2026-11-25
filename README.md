# Necromancer — AI Software Archaeology & Resurrection Platform

> **"Understand first. Plan second. Modify third. Verify continuously."**

Necromancer is an AI-powered system that brings abandoned, outdated, or poorly understood software back to life. Instead of treating legacy codebases as piles of files to blindly "fix," Necromancer treats them like an archaeological site: it reconstructs original product intent, identifies what is broken or obsolete, preserves critical existing business logic, safely modernizes the runtime in an isolated workspace, and proves preservation through automated tests and cryptographic revival dossiers.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.13+-yellow.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org)

---

## 🏛️ The 6-Agent Controlled Pipeline

Necromancer coordinates six specialized agents under a central state machine with strict safety gates:

1. **Archaeologist Agent**: Performs deterministic static parsing, manifests extraction, and dependency mapping to generate the **Codebase Anatomy Report**.
2. **Historian Agent**: Reconstructs product purpose and recovers critical business rules from code heuristics, schemas, comments, and commit history with confidence tagging (`verified`, `inferred`, `unknown`).
3. **Diagnostician Agent**: Evaluates technical health across runtime, security, data integrity, and architecture, producing a prioritized **Revival Diagnosis**.
4. **Revival Planner Agent**: Formulates a staged, risk-aware repair roadmap across 5 phases (Stabilize → Understand → Secure → Modernize → Certify).
5. **Resurrection Agent**: Generates surgical, reviewable unified git diffs for approved tasks in an isolated, disposable working copy.
6. **Guardian Agent**: The safety layer. Independently runs automated syntax linter and regression tests, blocks dangerous execution primitives, and enforces rollbacks if a regression occurs.

---

## 🛡️ Non-Negotiable Safety Principles

| Rule | Implementation |
| :--- | :--- |
| **Never modify original source** | Immutable archive storage with separate isolated git workspaces. |
| **Never execute untrusted code on host** | Sandboxed execution with resource and path limits. |
| **Never apply patches without approval** | Unified git diff review with mandatory human maintainer approval gate. |
| **Never claim tests passed without running** | Real command execution, exit codes, and stdout/stderr capture. |
| **Tamper-evident verification** | Root SHA-256 cryptographic hashes binding original source, revived source, and test results. |

---

## 🧪 Ground Truth Test Subject (`sample_legacy_app`)

Necromancer includes a controlled, legacy **PHP/MySQL (2013)** application designed to demonstrate the revival workflow:
- **Deprecated Runtime**: Uses ancient `mysql_connect()` and `mysql_query()` (fatal on modern PHP 7/8).
- **Security Vulnerabilities**: Concatenated SQL injection and unsalted MD5 password hashing.
- **Recovered Business Logic**: Enforces account suspension on users with $\ge 3$ failed login attempts.
- **Automated Verification**: `test_runner.php` exercises database connectivity, authentication, and suspension lockout rules.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- PHP 7.4+ or 8.x CLI (with `pdo_sqlite` enabled)

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/Tawfeeqoh/necromancer.git
cd necromancer

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate # macOS/Linux

# Install backend dependencies
pip install -r backend/requirements.txt

# Run backend test suite
pytest -v

# Start FastAPI server (base URL: http://localhost:8000)
uvicorn backend.app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
# In a new terminal window
cd frontend

# Install dependencies
npm install

# Start Vite dev server (base URL: http://localhost:5173)
npm run dev
```

Visit **http://localhost:5173** to launch the Necromancer Revival Workspace.

---

## 📜 Cryptographic Proof of Revival (Dossier)

When a legacy application is certified, Necromancer issues a verifiable dossier:
```json
{
  "project_id": "597d01e9-ddf0-43bb-a68e-1966e70d76ea",
  "original_sha256": "4b2c811da5d5b4bc6d497ffa98491e38...",
  "revived_sha256": "8a6d9f3b2c1e405a76e93d1820b4c81f...",
  "dossier_sha256": "c5d2e1a4b6c8f90123456789abcdef01...",
  "guardian_status": "passed",
  "test_results": {
    "status": "PASSED",
    "exit_code": 0,
    "output": "=== Necromancer Test Runner ===\n[PASS] Modern PDO connection initialized\n[PASS] Valid user authentication succeeds\n[PASS] Suspended user account is locked"
  }
}
```

---

## 📁 Repository Structure
```
necromancer/
├── backend/
│   ├── app/
│   │   ├── agents/          # Archaeologist, Historian, Diagnostician, Planner, Resurrector, Guardian
│   │   ├── core/            # Archive validator, Workspace manager, Orchestrator
│   │   ├── models/          # Pydantic schemas and contracts
│   │   ├── config.py        # Storage and boundary configuration
│   │   ├── database.py      # SQLite persistence and audit logging
│   │   └── main.py          # FastAPI application & REST endpoints
│   ├── tests/               # Pytest verification suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Linear/Stripe-grade revival workspace
│   │   ├── api.ts           # REST API client
│   │   ├── types.ts         # TypeScript data contracts
│   │   └── icons.tsx        # Zero-overhead SVG icon library
│   └── package.json
├── sample_legacy_app/       # Controlled legacy PHP/MySQL test subject
├── sample_legacy_app.zip    # Packaged ready-to-revive archive
├── necromancer_build_pack/  # Complete architecture specifications
├── pytest.ini
└── README.md
```

---

## ⚖️ License
MIT License. See [LICENSE](LICENSE) for details.
