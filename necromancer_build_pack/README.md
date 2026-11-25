# Necromancer — Project Build Pack

## Purpose
Necromancer is an AI-powered software archaeology and resurrection platform. It helps users understand, diagnose, safely repair, modernize, test, and document abandoned, outdated, or poorly understood software.

**Important product distinction:** Necromancer is the resurrection tool. The abandoned legacy application is the software being resurrected. Necromancer itself is a newly built product, not the dead technology.

## Build objective
Deliver a credible five-day MVP that completes one end-to-end revival of one controlled legacy PHP/MySQL application. Prioritize a working, safe, evidence-backed workflow over broad language support or feature count.

## Read first
1. [`AGENTS.md`](AGENTS.md) — instructions for AI coding agents.
2. [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)
3. [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)
4. [`docs/SECURITY_SPECIFICATION.md`](docs/SECURITY_SPECIFICATION.md)
5. [`docs/AGENT_SPECIFICATIONS.md`](docs/AGENT_SPECIFICATIONS.md)

Then read the remaining specifications before implementing the relevant subsystem.

## Source of truth
- Product scope and acceptance criteria: Product Requirements.
- Architecture and technology boundaries: Technical Architecture.
- Data structures: Database Schema.
- HTTP interfaces: API Contracts.
- Agent roles and handoffs: Agent Specifications.
- Visual and interaction requirements: UI/UX Specification.
- Safety requirements: Security Specification.
- Verification: Testing Strategy.
- Deployment: Deployment Guide.
- Presentation: Demo Script.

If documents conflict, stop and report the conflict. Do not silently choose an interpretation. The user/product owner must approve material scope or architecture changes.

## MVP boundaries
- Initial input: ZIP upload.
- Initial target: one controlled PHP/MySQL legacy application.
- Initial workflow: upload → inspect → reconstruct intent → diagnose → plan → propose patch → human approval → apply in isolated workspace → test → Guardian review → dossier.
- Use SHA-256 for verifiable integrity records.
- Blockchain anchoring, bounties, contributor reputation, broad language support, and fully autonomous modernization are future work unless the core MVP is complete and explicitly approved.

## Status
This pack is a proposed implementation baseline. Validate provider-specific choices, model access, sandbox availability, Kiro capabilities, and deployment constraints before implementation. Do not claim an integration exists until it has been implemented and tested.
