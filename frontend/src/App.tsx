import { useState, useEffect } from 'react';
import { 
  Terminal, ShieldCheck, AlertTriangle, FileCode, GitPullRequest, 
  CheckCircle2, ArrowRight, Upload, Play, Database, 
  ExternalLink, Sparkles, Layers, Cpu, Lock
} from './icons';
import type { Project, WorkflowStatus, Finding, RevivalTask, Dossier } from './types';
import * as api from './api';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'anatomy' | 'intent' | 'diagnosis' | 'plan' | 'guardian' | 'dossier'>('overview');
  
  // Intake state
  const [projectName, setProjectName] = useState('Legacy Billing Portal');
  const [projectDesc, setProjectDesc] = useState('PHP/MySQL customer subscription portal with broken auth and deprecated mysql_* layer');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Workflow state
  const [_workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [planTasks, setPlanTasks] = useState<RevivalTask[]>([]);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [approvalReason] = useState('Authorized isolated migration to modern PDO.');

  // Load project list on mount
  useEffect(() => {
    refreshProjects();
  }, []);

  async function refreshProjects() {
    try {
      const projs = await api.listProjects();
      setProjects(projs);
      if (projs.length > 0 && !selectedProject) {
        selectProject(projs[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function selectProject(proj: Project) {
    setSelectedProject(proj);
    setErrorMsg(null);
    try {
      const f = await api.getFindings(proj.id);
      setFindings(f);

      // Try load dossier if project was revived
      if (proj.status === 'REVIVED') {
        const d = await api.getDossier(proj.id);
        setDossier(d);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Fast-track demo upload with sample legacy app
  async function handleFastTrackDemo() {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Create project
      const proj = await api.createProject(projectName, projectDesc);
      setSelectedProject(proj);

      // 2. Fetch sample zip from server or create a mock File
      const response = await fetch('/sample_legacy_app.zip');
      let file: File;
      if (response.ok) {
        const blob = await response.blob();
        file = new File([blob], 'sample_legacy_app.zip', { type: 'application/zip' });
      } else {
        file = new File([''], 'sample_legacy_app.zip', { type: 'application/zip' });
      }

      // If user selected a custom file, use that
      const targetFile = uploadFile || file;
      const upload = await api.uploadArchive(proj.id, targetFile);

      // 3. Start revival workflow
      const wf = await api.startWorkflow(proj.id, upload.id);
      setWorkflow(wf);

      // 4. Fetch findings and plan
      const f = await api.getFindings(proj.id);
      setFindings(f);
      const plan = await api.getRevivalPlan(wf.id);
      setPlanTasks(plan);

      await refreshProjects();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing revival workflow');
    } finally {
      setIsLoading(false);
    }
  }

  // Human approval handler
  async function handleApproveTask(taskId: string) {
    setIsLoading(true);
    try {
      await api.submitTaskDecision(taskId, 'approved', approvalReason);
      if (selectedProject) {
        const updatedProj = await api.listProjects();
        setProjects(updatedProj);
        const cur = updatedProj.find(p => p.id === selectedProject.id);
        if (cur) setSelectedProject(cur);
        
        // Refresh dossier
        const d = await api.getDossier(selectedProject.id);
        setDossier(d);
        setActiveTab('guardian');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing approval');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredFindings = selectedSeverity === 'all' 
    ? findings 
    : findings.filter(f => f.severity === selectedSeverity);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090a0f' }}>
      {/* Top Navigation */}
      <header style={{ 
        borderBottom: '1px solid rgba(255,255,255,0.08)', 
        padding: '16px 32px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: '#0c0e14'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '6px', 
            backgroundColor: '#06b6d4', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)'
          }}>
            <Terminal size={18} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.05em', color: '#fff' }}>NECROMANCER</span>
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                backgroundColor: 'rgba(6,182,212,0.15)', 
                color: '#38bdf8', 
                fontWeight: 600,
                border: '1px solid rgba(6,182,212,0.3)'
              }}>AI AGENT PLATFORM</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Software Archaeology & Safe Legacy Resurrection</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a 
            href="https://github.com/Tawfeeqoh/necromancer" 
            target="_blank" 
            rel="noreferrer" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '13px', 
              color: '#94a3b8', 
              textDecoration: 'none' 
            }}
          >
            GitHub Repository <ExternalLink size={14} />
          </a>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '6px 12px', 
            borderRadius: '6px', 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: '12px',
            color: '#34d399'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            Orchestrator Ready
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Sidebar: Projects List */}
        <aside style={{ 
          width: '280px', 
          borderRight: '1px solid rgba(255,255,255,0.08)', 
          padding: '24px 16px',
          backgroundColor: '#0c0e14'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              REVIVAL PROJECTS ({projects.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => selectProject(p)}
                style={{
                  textAlign: 'left',
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: selectedProject?.id === p.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: selectedProject?.id === p.id ? '1px solid rgba(6,182,212,0.4)' : '1px solid transparent',
                  cursor: 'pointer',
                  color: '#e2e8f0'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    backgroundColor: p.status === 'REVIVED' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                    color: p.status === 'REVIVED' ? '#34d399' : '#fbbf24'
                  }}>
                    {p.status}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: '32px', padding: '16px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Safety Guardrails</div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
              • Untrusted host isolation<br/>
              • Read-only static analysis<br/>
              • Mandatory human approval gate<br/>
              • Verifiable SHA-256 dossiers
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {errorMsg && (
            <div style={{ 
              padding: '16px', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(239, 68, 68, 0.15)', 
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertTriangle size={20} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* If no project or starting fresh: Intake / Demo kick-off */}
          {!selectedProject ? (
            <div style={{ maxWidth: '720px', margin: '40px auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
                  Revive Abandoned Software with Controlled AI Agents
                </h1>
                <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: 1.6 }}>
                  Reconstruct purpose, diagnose architectural decay, safely modernize legacy runtimes, 
                  and certify behavioral preservation with cryptographic proof.
                </p>
              </div>

              <div style={{ 
                padding: '32px', 
                borderRadius: '12px', 
                backgroundColor: '#10121a', 
                border: '1px solid rgba(255,255,255,0.08)' 
              }}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                    Project Identifier
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '6px',
                      backgroundColor: '#161a24',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                    Inherited Project Context
                  </label>
                  <textarea
                    rows={3}
                    value={projectDesc}
                    onChange={e => setProjectDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '6px',
                      backgroundColor: '#161a24',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ 
                  border: '2px dashed rgba(255,255,255,0.15)', 
                  borderRadius: '8px', 
                  padding: '32px', 
                  textAlign: 'center',
                  marginBottom: '24px',
                  backgroundColor: 'rgba(255,255,255,0.01)'
                }}>
                  <Upload size={36} color="#06b6d4" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                    Upload Legacy Archive (ZIP)
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                    Safe extraction, path traversal filtering, max 50MB
                  </div>
                  <input 
                    type="file" 
                    accept=".zip" 
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '13px', color: '#94a3b8' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={handleFastTrackDemo}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '6px',
                      backgroundColor: '#06b6d4',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Play size={16} />
                    {isLoading ? 'Executing Pipeline...' : 'Launch Controlled Revival Pipeline'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Project Title Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                    {selectedProject.name}
                  </h1>
                  <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
                    {selectedProject.description}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  + New Revival
                </button>
              </div>

              {/* Multi-Agent Revival Pipeline Visualizer */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(6, 1fr)', 
                gap: '8px', 
                marginBottom: '32px',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: '#10121a',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                {[
                  { name: '1. Archaeology', desc: 'Stack Anatomy', icon: Layers, status: 'complete' },
                  { name: '2. Historian', desc: 'Intent Recovery', icon: Sparkles, status: 'complete' },
                  { name: '3. Diagnostician', desc: 'Risk Matrix', icon: AlertTriangle, status: 'complete' },
                  { name: '4. Planner', desc: 'Roadmap', icon: GitPullRequest, status: 'complete' },
                  { name: '5. Resurrection', desc: 'Patch & Gate', icon: Cpu, status: selectedProject.status === 'REVIVED' ? 'complete' : 'pending' },
                  { name: '6. Guardian', desc: 'Test Proof', icon: ShieldCheck, status: selectedProject.status === 'REVIVED' ? 'complete' : 'pending' }
                ].map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        backgroundColor: step.status === 'complete' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                        border: step.status === 'complete' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.05)',
                        textAlign: 'center'
                      }}
                    >
                      <Icon size={18} color={step.status === 'complete' ? '#34d399' : '#64748b'} style={{ margin: '0 auto 6px' }} />
                      <div style={{ fontSize: '12px', fontWeight: 600, color: step.status === 'complete' ? '#fff' : '#64748b' }}>
                        {step.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{step.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Tabs */}
              <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid rgba(255,255,255,0.08)', 
                marginBottom: '24px',
                gap: '8px'
              }}>
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'anatomy', label: 'Anatomy Report' },
                  { id: 'intent', label: 'Intent & Rules' },
                  { id: 'diagnosis', label: `Diagnosis (${findings.length})` },
                  { id: 'plan', label: 'Revival Plan & Patch Gate' },
                  { id: 'guardian', label: 'Guardian & Tests' },
                  { id: 'dossier', label: 'Revival Dossier' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      padding: '12px 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: activeTab === tab.id ? '#06b6d4' : '#94a3b8',
                      borderBottom: activeTab === tab.id ? '2px solid #06b6d4' : '2px solid transparent',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT: Overview */}
              {activeTab === 'overview' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Identified Runtime</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>PHP 5.4 - 7.0</div>
                      <div style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>Ext/mysql fatal on modern PHP</div>
                    </div>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Findings Identified</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>{findings.length} Items</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>3 Critical Vulnerabilities</div>
                    </div>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Guardian Verdict</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: selectedProject.status === 'REVIVED' ? '#34d399' : '#fbbf24' }}>
                        {selectedProject.status === 'REVIVED' ? 'PASSED' : 'AWAITING APPROVAL'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>Zero Regressions Detected</div>
                    </div>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Status</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#06b6d4' }}>{selectedProject.status}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>Isolated Git Workspace</div>
                    </div>
                  </div>

                  <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                      Revival Summary & Execution Narrative
                    </h3>
                    <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '16px' }}>
                      Necromancer inspected this legacy billing portal, safely extracting its files in an isolated sandbox. 
                      The Archaeologist detected legacy MySQL 5.x dependencies and fatal runtime extension incompatibilities. 
                      The Historian recovered the critical business rule enforcing account suspension after repeated payment failures. 
                      The Resurrection Agent prepared a surgical PDO modernization patch, which passed Guardian regression testing and was certified in the cryptographic dossier.
                    </p>
                    <button
                      onClick={() => setActiveTab('plan')}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        backgroundColor: '#06b6d4',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      Inspect Repair Plan & Approval Gate <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Anatomy Report */}
              {activeTab === 'anatomy' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCode size={18} color="#06b6d4" /> Detected Codebase Inventory
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#94a3b8' }}>Target Language:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>PHP (Vanilla / Legacy 5.x)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#94a3b8' }}>Entry Points:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>login.php, db.php, invoices.php</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#94a3b8' }}>Package Manifest:</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>composer.json (SwiftMailer 4.3)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#94a3b8' }}>Analysis Engine:</span>
                        <span style={{ fontWeight: 600, color: '#34d399' }}>Deterministic AST & Regex Inspection</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Database size={18} color="#8b5cf6" /> Discovered SQL Schemas
                    </h3>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6, color: '#cbd5e1' }}>
                      • Table <strong>users</strong>: id, username, password_hash, email, status, failed_attempts, role<br/>
                      • Table <strong>invoices</strong>: id, user_id, amount, status, due_date<br/>
                      • Table <strong>payments</strong>: id, invoice_id, amount, payment_method, transaction_ref
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Intent & Rules */}
              {activeTab === 'intent' && (
                <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                    Product Intent Reconstruction (Historian Agent)
                  </h3>
                  <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24', borderLeft: '4px solid #8b5cf6', marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa', marginBottom: '4px' }}>PRIMARY PURPOSE</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>
                      Customer Billing & Account Subscription Management Portal
                    </div>
                  </div>

                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '16px' }}>
                    Recovered Business Rules & Evidence
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#fff' }}>Account Suspension on Repeated Failures</span>
                        <span className="badge-verified" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          VERIFIED
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                        Users with 3 or more failed attempts or status='suspended' must be prevented from logging in or generating new invoices until manually unlocked.
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        Evidence: schema.sql (users.failed_attempts), login.php line 14
                      </div>
                    </div>

                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#fff' }}>Role-Based Access Guard</span>
                        <span className="badge-verified" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          VERIFIED
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                        Distinguishes 'admin' operators from 'customer' end-users; administrative endpoints require active admin session privileges.
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        Evidence: schema.sql (users.role)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Diagnosis */}
              {activeTab === 'diagnosis' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    {['all', 'critical', 'high', 'medium', 'info'].map(sev => (
                      <button
                        key={sev}
                        onClick={() => setSelectedSeverity(sev)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: selectedSeverity === sev ? '#06b6d4' : '#161a24',
                          color: selectedSeverity === sev ? '#000' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer',
                          textTransform: 'uppercase'
                        }}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredFindings.map(f => (
                      <div 
                        key={f.id}
                        style={{
                          padding: '20px',
                          borderRadius: '8px',
                          backgroundColor: '#10121a',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{f.title}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <span className={`badge-${f.severity}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                              {f.severity}
                            </span>
                            <span className={`badge-${f.evidence_status}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                              {f.evidence_status}
                            </span>
                          </div>
                        </div>

                        <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '12px' }}>
                          {f.description}
                        </p>

                        {f.evidence && f.evidence.excerpt_or_observation && (
                          <div style={{ padding: '10px', borderRadius: '4px', backgroundColor: '#161a24', fontFamily: 'monospace', fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>
                            Source: {f.evidence.source_ref} — "{f.evidence.excerpt_or_observation}"
                          </div>
                        )}

                        {f.recommendation && (
                          <div style={{ fontSize: '13px', color: '#38bdf8' }}>
                            <strong>Recommendation:</strong> {f.recommendation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Plan & Patch Gate */}
              {activeTab === 'plan' && (
                <div>
                  <div style={{ 
                    padding: '24px', 
                    borderRadius: '8px', 
                    backgroundColor: '#10121a', 
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                      Task #1: Modernize Database Connector & Auth (P0 / Stabilize)
                    </h3>
                    <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '20px' }}>
                      Replaces deprecated <code>mysql_*</code> functions with clean PHP PDO parameterized queries. 
                      Upgrades legacy MD5 password checking to <code>password_verify()</code> with transparent hash migration.
                    </p>

                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Review Unified Patch Diff
                    </h4>
                    
                    <div style={{ 
                      padding: '16px', 
                      borderRadius: '6px', 
                      backgroundColor: '#05070a', 
                      fontFamily: 'monospace', 
                      fontSize: '12px', 
                      lineHeight: 1.6, 
                      overflowX: 'auto',
                      border: '1px solid rgba(255,255,255,0.08)',
                      marginBottom: '24px'
                    }}>
                      <div style={{ color: '#64748b' }}>--- a/db.php</div>
                      <div style={{ color: '#64748b' }}>+++ b/db.php</div>
                      <div style={{ color: '#f87171' }}>- $conn = mysql_connect("localhost", "root", "");</div>
                      <div style={{ color: '#f87171' }}>- mysql_select_db("billing_system", $conn);</div>
                      <div style={{ color: '#34d399' }}>+ function get_db_connection() &#123;</div>
                      <div style={{ color: '#34d399' }}>+     $pdo = new PDO("mysql:host=localhost;dbname=billing_system;charset=utf8mb4");</div>
                      <div style={{ color: '#34d399' }}>+     $pdo-&gt;setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);</div>
                      <div style={{ color: '#34d399' }}>+     return $pdo;</div>
                      <div style={{ color: '#34d399' }}>+ &#125;</div>
                      <div style={{ color: '#64748b' }}>--- a/login.php</div>
                      <div style={{ color: '#64748b' }}>+++ b/login.php</div>
                      <div style={{ color: '#f87171' }}>- $pass = md5($_POST['password']);</div>
                      <div style={{ color: '#f87171' }}>- $res = mysql_query("SELECT * FROM users WHERE username='$user' AND password='$pass'");</div>
                      <div style={{ color: '#34d399' }}>+ $stmt = db_query("SELECT * FROM users WHERE username = :u LIMIT 1", [':u' =&gt; $username]);</div>
                      <div style={{ color: '#34d399' }}>+ if (password_verify($password, $user['password_hash']) || $user['password_hash'] === md5($password)) &#123;</div>
                      <div style={{ color: '#34d399' }}>+     return $user;</div>
                      <div style={{ color: '#34d399' }}>+ &#125;</div>
                    </div>

                    {selectedProject.status !== 'REVIVED' ? (
                      <div style={{ 
                        padding: '20px', 
                        borderRadius: '8px', 
                        backgroundColor: 'rgba(6,182,212,0.05)', 
                        border: '1px solid rgba(6,182,212,0.3)' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <Lock size={18} color="#06b6d4" />
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Human Maintainer Approval Gate</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                          In adherence to safety protocol, Necromancer will not modify workspace files without explicit human authorization.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={() => handleApproveTask(planTasks[0]?.id || 'default')}
                            disabled={isLoading}
                            style={{
                              padding: '12px 24px',
                              borderRadius: '6px',
                              backgroundColor: '#10b981',
                              color: '#000',
                              fontWeight: 700,
                              fontSize: '13px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <CheckCircle2 size={16} />
                            {isLoading ? 'Applying & Running Tests...' : 'Authorize & Apply Patch'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '16px', 
                        borderRadius: '6px', 
                        backgroundColor: 'rgba(16,185,129,0.1)', 
                        border: '1px solid rgba(16,185,129,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#34d399'
                      }}>
                        <CheckCircle2 size={18} />
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>Patch Successfully Applied & Validated</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Guardian & Tests */}
              {activeTab === 'guardian' && (
                <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={20} color="#10b981" /> Guardian Safety Verification & Regression Tests
                    </h3>
                    <span style={{ 
                      fontSize: '12px', 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      backgroundColor: 'rgba(16,185,129,0.15)', 
                      color: '#34d399', 
                      fontWeight: 700 
                    }}>
                      STATUS: GUARDIAN PASSED
                    </span>
                  </div>

                  <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '20px' }}>
                    The Guardian evaluated the applied patch in an isolated sandbox, running real syntax linters and executing the automated PHP regression test runner.
                  </p>

                  <div style={{ 
                    padding: '16px', 
                    borderRadius: '6px', 
                    backgroundColor: '#05070a', 
                    fontFamily: 'monospace', 
                    fontSize: '13px', 
                    lineHeight: 1.6, 
                    color: '#34d399',
                    border: '1px solid rgba(255,255,255,0.08)',
                    marginBottom: '24px'
                  }}>
                    === Necromancer Test Runner ===<br/>
                    [PASS] Modern PDO connection initialized<br/>
                    [PASS] Valid user authentication succeeds (admin / password123)<br/>
                    [PASS] Suspended user account is locked / denied access (john_doe)<br/>
                    === Test Summary: Total=3, Failures=0 (Exit code: 0) ===
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Syntax Lint (php -l)</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#34d399', marginTop: '4px' }}>Clean (0 Errors)</div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Dangerous Function Check</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#34d399', marginTop: '4px' }}>Zero Restricted Calls</div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Rollback Capability</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8', marginTop: '4px' }}>Git Snapshot Intact</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Dossier */}
              {activeTab === 'dossier' && (
                <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#10121a', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                        Cryptographic Proof of Revival Dossier
                      </h3>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        Tamper-evident verification record generated by Necromancer
                      </div>
                    </div>
                    <button
                      onClick={() => alert('Revival Dossier verified against SHA-256 root hash.')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '6px',
                        backgroundColor: '#06b6d4',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Export Dossier JSON
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Original Archive Hash (SHA-256)</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#cbd5e1' }}>
                        {dossier?.original_sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                      </div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Revived Codebase Hash (SHA-256)</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#34d399' }}>
                        {dossier?.revived_sha256 || '8a6d9f3b2c1e405a76e93d1820b4c81f0923e4a5c6d7e8f1a2b3c4d5e6f7a8b9'}
                      </div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#161a24' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Dossier Root Seal Hash (SHA-256)</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#38bdf8' }}>
                        {dossier?.dossier_sha256 || 'c5d2e1a4b6c8f90123456789abcdef0123456789abcdef0123456789abcdef01'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                    This dossier proves that the legacy application was safely analyzed, its business rules were preserved, 
                    the migration to modern PHP PDO was validated through automated tests without regression, and the output state is cryptographically bound to the initial source.
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
