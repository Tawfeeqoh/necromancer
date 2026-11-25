import type { Project, Upload, WorkflowStatus, Finding, RevivalTask, Dossier, WorkspaceData, HealthInfo } from './types';

const API_BASE = 'http://localhost:8000/api/v1';

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to list projects');
  return res.json();
}

export async function uploadArchive(projectId: string, file: File): Promise<Upload> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/projects/${projectId}/uploads`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload archive');
  return res.json();
}

export async function startWorkflow(projectId: string, uploadId: string): Promise<WorkflowStatus> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_id: uploadId, goals: ['understand', 'diagnose', 'repair'] })
  });
  if (!res.ok) throw new Error('Failed to start workflow');
  return res.json();
}

export async function getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
  const res = await fetch(`${API_BASE}/workflows/${workflowId}`);
  if (!res.ok) throw new Error('Failed to fetch workflow status');
  return res.json();
}

export async function getFindings(projectId: string): Promise<Finding[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/findings`);
  if (!res.ok) throw new Error('Failed to fetch findings');
  return res.json();
}

export async function getRevivalPlan(workflowId: string): Promise<RevivalTask[]> {
  const res = await fetch(`${API_BASE}/workflows/${workflowId}/plan`);
  if (!res.ok) throw new Error('Failed to fetch revival plan');
  return res.json();
}

export async function submitTaskDecision(taskId: string, decision: 'approved' | 'rejected', reason?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reason })
  });
  if (!res.ok) throw new Error('Failed to submit decision');
  return res.json();
}

export async function getDossier(projectId: string): Promise<Dossier> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/dossier`);
  if (!res.ok) throw new Error('Failed to fetch dossier');
  return res.json();
}

export async function getWorkspace(projectId: string): Promise<WorkspaceData> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workspace`);
  if (!res.ok) throw new Error('Failed to fetch project workspace');
  return res.json();
}

export async function rollbackProject(projectId: string): Promise<{ status: string; head_commit: string }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/rollback`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to rollback project');
  return res.json();
}

export function getDossierDownloadUrl(projectId: string, format: 'json' | 'markdown'): string {
  return `${API_BASE}/projects/${projectId}/dossier/download?format=${format}`;
}
