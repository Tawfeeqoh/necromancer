export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Upload {
  id: string;
  project_id: string;
  original_filename: string;
  sha256: string;
  size_bytes: number;
  validation_status: string;
  created_at: string;
}

export interface WorkflowStatus {
  id: string;
  project_id: string;
  status: string;
  current_stage: string;
  progress: {
    completed_stages: number;
    total_stages: number;
  };
  updated_at: string;
  error_message?: string | null;
}

export interface Finding {
  id: string;
  project_id: string;
  workflow_id: string;
  agent_name: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  evidence_status: 'verified' | 'inferred' | 'unknown';
  evidence: any;
  recommendation?: string | null;
  created_at: string;
}

export interface RevivalTask {
  id: string;
  project_id: string;
  workflow_id: string;
  title: string;
  description: string;
  phase: string;
  priority: string;
  risk_level: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'planned';
  affected_files: string[];
  validation_plan: {
    test_command: string;
    expected_outcome: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Dossier {
  project_id: string;
  workflow_id: string;
  original_sha256: string;
  revived_sha256: string;
  dossier_sha256: string;
  summary: string;
  findings_summary: Record<string, number>;
  tasks_summary: Record<string, number>;
  test_results: {
    status: string;
    exit_code: number | null;
    output: string | null;
  };
  guardian_status: string;
  created_at: string;
}

export interface WorkspaceData {
  project: Project;
  upload: Upload | null;
  workflow: WorkflowStatus | null;
  anatomy: {
    project_metrics?: {
      primary_language?: string;
      total_files?: number;
      loc_estimate?: number;
    };
    entry_points?: string[];
    schema_tables?: string[];
    dependencies?: Record<string, any>;
    analysis_method?: string;
  } | null;
  intent: {
    primary_purpose?: string;
    business_rules?: Array<{
      title: string;
      description: string;
      evidence: string;
      confidence: string;
      status: string;
    }>;
    domain_concepts?: string[];
  } | null;
  diagnosis: {
    breaking_changes?: any[];
    security_vulnerabilities?: any[];
    behavioral_drift?: any[];
  } | null;
  tasks: RevivalTask[];
  patches: Array<{
    id: string;
    task_id: string;
    base_revision: string;
    result_revision?: string | null;
    patch_sha256: string;
    changed_files: string[];
    diff: string;
    status: string;
    created_at: string;
  }>;
  test_runs: Array<{
    id: string;
    task_id: string;
    command: string;
    exit_code: number | null;
    output: string;
    status: string;
    created_at: string;
  }>;
  guardian_reviews: Array<{
    id: string;
    task_id: string;
    status: string;
    findings: string[];
    created_at: string;
  }>;
}

export interface HealthInfo {
  status: string;
  version: string;
  sandbox_available: boolean;
  sandbox_type: string;
}
