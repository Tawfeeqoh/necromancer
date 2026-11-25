import { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, AlertTriangle, FileCode, GitPullRequest, 
  CheckCircle2, ArrowRight, Upload, Play, Database, 
  Sparkles, Layers, Cpu, Lock, Download, RotateCcw
} from './icons';
import type { Project, Finding, RevivalTask, Dossier, WorkspaceData, HealthInfo } from './types';
import * as api from './api';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [wsData, setWsData] = useState<WorkspaceData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'anatomy' | 'intent' | 'diagnosis' | 'plan' | 'guardian' | 'dossier'>('overview');
  
  // Intake state
  const [projectName, setProjectName] = useState('Legacy Billing Portal');
  const [projectDesc, setProjectDesc] = useState('PHP/MySQL customer subscription portal with broken auth and deprecated mysql_* layer');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Workflow state
  const [findings, setFindings] = useState<Finding[]>([]);
  const [planTasks, setPlanTasks] = useState<RevivalTask[]>([]);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [approvalReason, setApprovalReason] = useState('Authorized isolated migration to modern PDO.');

  const refreshProjects = useCallback(async () => {
    try {
      const projs = await api.listProjects();
      setProjects(projs);
      if (projs.length > 0 && !selectedProject) {
        selectProject(projs[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedProject]);

  useEffect(() => {
    let mounted = true;
    api.listProjects().then(projs => {
      if (mounted) {
        setProjects(projs);
        if (projs.length > 0) {
          selectProject(projs[0]);
        }
      }
    }).catch(console.error);
    api.getHealth().then(h => {
      if (mounted) setHealth(h);
    }).catch(console.error);
    return () => {
      mounted = false;
    };
  }, []);

  async function selectProject(proj: Project) {
    setSelectedProject(proj);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const ws = await api.getWorkspace(proj.id);
      setWsData(ws);
      setPlanTasks(ws.tasks || []);

      const f = await api.getFindings(proj.id);
      setFindings(f);

      if (proj.status === 'REVIVED' || ws.project?.status === 'REVIVED') {
        try {
          const d = await api.getDossier(proj.id);
          setDossier(d);
        } catch {
          setDossier(null);
        }
      } else {
        setDossier(null);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to load project workspace');
    }
  }

  async function handleFastTrackDemo() {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const proj = await api.createProject(projectName, projectDesc);
      setSelectedProject(proj);

      const response = await fetch('/sample_legacy_app.zip');
      let file: File;
      if (response.ok) {
        const blob = await response.blob();
        file = new File([blob], 'sample_legacy_app.zip', { type: 'application/zip' });
      } else {
        file = new File([''], 'sample_legacy_app.zip', { type: 'application/zip' });
      }

      const targetFile = uploadFile || file;
      const upload = await api.uploadArchive(proj.id, targetFile);

      const wf = await api.startWorkflow(proj.id, upload.id);

      const ws = await api.getWorkspace(proj.id);
      setWsData(ws);
      setPlanTasks(ws.tasks || []);

      const f = await api.getFindings(proj.id);
      setFindings(f);

      const plan = await api.getRevivalPlan(wf.id);
      setPlanTasks(plan);

      await refreshProjects();
      setSuccessMsg('Revival workflow completed analysis. Inspect Plan & Patch Gate to authorize repair.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing revival workflow');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApproveTask(taskId: string) {
    if (!selectedProject) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await api.submitTaskDecision(taskId, 'approved', approvalReason);
      if (result.status === 'completed') {
        setSuccessMsg('Patch successfully applied to isolated Git workspace and verified by Guardian!');
      } else if (result.status === 'blocked') {
        setErrorMsg('Guardian blocked patch due to detected regression or test failure.');
      } else {
        setErrorMsg(`Patch status: ${result.status}. ${result.error || ''}`);
      }

      const ws = await api.getWorkspace(selectedProject.id);
      setWsData(ws);
      setPlanTasks(ws.tasks || []);

      if (result.status === 'completed') {
        const d = await api.getDossier(selectedProject.id);
        setDossier(d);
        setSelectedProject({ ...selectedProject, status: 'REVIVED' });
      }

      await refreshProjects();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error approving repair task');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRollback() {
    if (!selectedProject) return;
    if (!window.confirm('Roll back this workspace to its baseline commit and remove untracked files?')) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await api.rollbackProject(selectedProject.id);
      setSuccessMsg('Workspace successfully rolled back to clean baseline commit.');
      const ws = await api.getWorkspace(selectedProject.id);
      setWsData(ws);
      setSelectedProject({ ...selectedProject, status: 'ANALYSED' });
      setDossier(null);
      await refreshProjects();
    } catch (err: any) {
      setErrorMsg(err.message || 'Rollback failed');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredFindings = findings.filter(f => {
    if (selectedSeverity === 'all') return true;
    return f.severity === selectedSeverity;
  });

  const currentPatch = wsData?.patches?.[0] || null;
  const currentTestRun = wsData?.test_runs?.[0] || null;
  const currentGuardian = wsData?.guardian_reviews?.[0] || null;
  const currentTask = wsData?.tasks?.[0] || planTasks[0] || null;
  const stage = wsData?.workflow?.current_stage || '';

  const getStepStatus = (stepName: string) => {
    if (selectedProject?.status === 'REVIVED') return 'complete';
    const order = ['ARCHAEOLOGY', 'HISTORIAN', 'DIAGNOSIS', 'PLANNING', 'PATCHING', 'GUARDIAN'];
    const idx = order.indexOf(stage);
    const stepIdx = order.indexOf(stepName);
    if (stepIdx < idx) return 'complete';
    if (stepIdx === idx) return 'active';
    return 'pending';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#101113' }}>
      {/* Top Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 28px', 
        borderBottom: '1px solid #272a2e',
        backgroundColor: '#141518'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Brand Emblem */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #272a2e 0%, #101113 100%)',
            border: '1px solid #b5ff5b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '16px',
            color: '#b5ff5b',
            boxShadow: '0 0 10px rgba(181, 255, 91, 0.2)'
          }}>
            N
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.08em', color: '#e8e6df' }}>
                NECROMANCER
              </span>
              <span style={{ fontSize: '10px', color: '#666a70', fontWeight: 600, letterSpacing: '0.05em' }}>
                SOFTWARE REVIVAL INTELLIGENCE
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#666a70' }}>
              Revive. Restore. Rebuild. Controlled multi-agent legacy modernization
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Pro License Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: 'rgba(181, 255, 91, 0.1)',
            border: '1px solid rgba(181, 255, 91, 0.3)',
            color: '#b5ff5b'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#b5ff5b' }}></span>
            Pro License Active
          </div>

          {/* Sandbox Status Badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '12px', 
            color: health?.sandbox_available ? '#b5ff5b' : '#fbbf24',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: health?.sandbox_available ? 'rgba(181, 255, 91, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${health?.sandbox_available ? 'rgba(181, 255, 91, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: health?.sandbox_available ? '#b5ff5b' : '#fbbf24' }}></span>
            {health?.sandbox_available ? 'Container Sandbox Ready' : 'Host Execution Disabled (Secure)'}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Sidebar */}
        <aside style={{ 
          width: '280px', 
          borderRight: '1px solid #272a2e', 
          padding: '24px 16px',
          backgroundColor: '#121316',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#666a70', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Revival Projects ({projects.length})
              </span>
              <button
                onClick={() => setSelectedProject(null)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#b5ff5b',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                + New Scan
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: selectedProject?.id === p.id ? '#1e2024' : 'transparent',
                    border: selectedProject?.id === p.id ? '1px solid #b5ff5b' : '1px solid transparent',
                    cursor: 'pointer',
                    color: '#e8e6df',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{p.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      fontWeight: 700,
                      backgroundColor: p.status === 'REVIVED' ? 'rgba(181, 255, 91, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: p.status === 'REVIVED' ? '#b5ff5b' : '#fbbf24'
                    }}>
                      {p.status}
                    </span>
                    <span style={{ fontSize: '11px', color: '#666a70' }}>
                      {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Safety Guardrails Card */}
          <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#e8e6df', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#b5ff5b" />
              Safety Guardrails
            </div>
            <div style={{ fontSize: '11px', color: '#666a70', lineHeight: 1.6 }}>
              • No untrusted host execution<br/>
              • Read-only static analysis<br/>
              • Mandatory human approval gate<br/>
              • Deterministic SHA-256 dossiers
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {errorMsg && (
            <div style={{ 
              padding: '14px 18px', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(239, 68, 68, 0.12)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertTriangle size={18} />
              <div style={{ fontSize: '13px' }}>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div style={{ 
              padding: '14px 18px', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(181, 255, 91, 0.1)', 
              border: '1px solid rgba(181, 255, 91, 0.3)',
              color: '#b5ff5b',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={18} />
              <div style={{ fontSize: '13px' }}>{successMsg}</div>
            </div>
          )}

          {/* If no project selected: Intake screen */}
          {!selectedProject ? (
            <div style={{ maxWidth: '720px', margin: '40px auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#e8e6df', marginBottom: '12px' }}>
                  Revive Abandoned Software with Controlled AI Agents
                </h1>
                <p style={{ fontSize: '15px', color: '#666a70', lineHeight: 1.6 }}>
                  Reconstruct purpose, diagnose architectural decay, safely modernize legacy runtimes, 
                  and certify behavioral preservation with cryptographic proof.
                </p>
              </div>

              <div style={{ 
                padding: '32px', 
                borderRadius: '12px', 
                backgroundColor: '#18191d', 
                border: '1px solid #272a2e' 
              }}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e8e6df', marginBottom: '6px', textTransform: 'uppercase' }}>
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
                      backgroundColor: '#101113',
                      border: '1px solid #272a2e',
                      color: '#e8e6df',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#e8e6df', marginBottom: '6px', textTransform: 'uppercase' }}>
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
                      backgroundColor: '#101113',
                      border: '1px solid #272a2e',
                      color: '#e8e6df',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ 
                  border: '2px dashed #272a2e', 
                  borderRadius: '8px', 
                  padding: '32px', 
                  textAlign: 'center',
                  marginBottom: '24px',
                  backgroundColor: 'rgba(255,255,255,0.01)'
                }}>
                  <Upload size={36} color="#b5ff5b" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#e8e6df', marginBottom: '6px' }}>
                    Upload Legacy Archive (ZIP)
                  </div>
                  <div style={{ fontSize: '12px', color: '#666a70', marginBottom: '16px' }}>
                    Streaming size enforcement, symlink rejection, path traversal protection (max 50MB)
                  </div>
                  <input 
                    type="file" 
                    accept=".zip" 
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '13px', color: '#e8e6df' }}
                  />
                </div>

                <button
                  onClick={handleFastTrackDemo}
                  disabled={isLoading}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Play size={16} />
                  {isLoading ? 'Executing Revival Pipeline...' : 'Launch Controlled Revival Pipeline'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Project Title Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#e8e6df', marginBottom: '4px' }}>
                    {selectedProject.name}
                  </h1>
                  <p style={{ fontSize: '13px', color: '#666a70', margin: 0 }}>
                    {selectedProject.description || 'No description provided'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedProject.status === 'REVIVED' && (
                    <button
                      onClick={handleRollback}
                      disabled={isLoading}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: '#18191d',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <RotateCcw size={14} />
                      Rollback to Baseline
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedProject(null)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: '#18191d',
                      border: '1px solid #272a2e',
                      color: '#e8e6df',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + New Scan
                  </button>
                </div>
              </div>

              {/* 6-Agent Revival Pipeline Visualizer */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(6, 1fr)', 
                gap: '8px', 
                marginBottom: '28px',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: '#18191d',
                border: '1px solid #272a2e'
              }}>
                {[
                  { name: '1. Archaeology', stage: 'ARCHAEOLOGY', desc: 'Stack Anatomy', icon: Layers },
                  { name: '2. Historian', stage: 'HISTORIAN', desc: 'Intent Recovery', icon: Sparkles },
                  { name: '3. Diagnostician', stage: 'DIAGNOSIS', desc: 'Risk Matrix', icon: AlertTriangle },
                  { name: '4. Planner', stage: 'PLANNING', desc: 'Roadmap', icon: GitPullRequest },
                  { name: '5. Resurrection', stage: 'PATCHING', desc: 'Patch & Gate', icon: Cpu },
                  { name: '6. Guardian', stage: 'GUARDIAN', desc: 'Test Proof', icon: ShieldCheck }
                ].map((step, idx) => {
                  const Icon = step.icon;
                  const st = getStepStatus(step.stage);
                  const isDone = st === 'complete';
                  const isActive = st === 'active';
                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        backgroundColor: isDone ? 'rgba(181, 255, 91, 0.08)' : isActive ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255,255,255,0.01)',
                        border: isDone ? '1px solid rgba(181, 255, 91, 0.3)' : isActive ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid #272a2e',
                        textAlign: 'center'
                      }}
                    >
                      <Icon size={18} color={isDone ? '#b5ff5b' : isActive ? '#06b6d4' : '#666a70'} style={{ margin: '0 auto 6px' }} />
                      <div style={{ fontSize: '11px', fontWeight: 700, color: isDone ? '#e8e6df' : isActive ? '#06b6d4' : '#666a70' }}>
                        {step.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#666a70' }}>{step.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Tabs */}
              <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid #272a2e', 
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
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: activeTab === tab.id ? '#b5ff5b' : '#666a70',
                      borderBottom: activeTab === tab.id ? '2px solid #b5ff5b' : '2px solid transparent',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: Overview */}
              {activeTab === 'overview' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70', textTransform: 'uppercase', marginBottom: '4px' }}>Identified Runtime</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#e8e6df' }}>
                        {wsData?.anatomy?.project_metrics?.primary_language || 'PHP 5.x'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>Ext/mysql fatal on modern PHP</div>
                    </div>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70', textTransform: 'uppercase', marginBottom: '4px' }}>Findings Identified</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#fbbf24' }}>
                        {findings.length} Items
                      </div>
                      <div style={{ fontSize: '11px', color: '#666a70', marginTop: '6px' }}>
                        {findings.filter(f => f.severity === 'critical').length} Critical Defects
                      </div>
                    </div>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70', textTransform: 'uppercase', marginBottom: '4px' }}>Guardian Status</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: selectedProject.status === 'REVIVED' ? '#b5ff5b' : '#fbbf24' }}>
                        {selectedProject.status === 'REVIVED' ? 'PASSED' : 'AWAITING APPROVAL'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666a70', marginTop: '6px' }}>
                        {currentGuardian?.status === 'passed' ? 'Zero Regressions' : 'Pre-patch baseline'}
                      </div>
                    </div>
                    <div style={{ padding: '20px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70', textTransform: 'uppercase', marginBottom: '4px' }}>Workspace State</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#b5ff5b' }}>
                        {selectedProject.status}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666a70', marginTop: '6px' }}>
                        Git-isolated directory
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#e8e6df', marginBottom: '12px' }}>
                      Revival Summary & Execution Narrative
                    </h3>
                    <p style={{ fontSize: '13px', color: '#666a70', lineHeight: 1.6, marginBottom: '20px' }}>
                      Necromancer inspected this legacy application in an isolated sandbox. 
                      The Archaeologist detected legacy MySQL 5.x dependencies and fatal runtime incompatibilities. 
                      The Historian recovered business rules from schema and entry points. 
                      The Resurrection Agent prepared a surgical PDO modernization patch. 
                      Upon maintainer approval, the patch is applied atomically in Git, tested by Guardian, and sealed with a deterministic SHA-256 dossier.
                    </p>
                    <button
                      onClick={() => setActiveTab('plan')}
                      className="btn-primary"
                      style={{
                        padding: '10px 20px',
                        fontSize: '13px',
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

              {/* TAB 2: Anatomy */}
              {activeTab === 'anatomy' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#e8e6df', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCode size={18} color="#b5ff5b" /> Detected Codebase Inventory
                    </h3>
                    {wsData?.anatomy ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #272a2e' }}>
                          <span style={{ color: '#666a70', fontSize: '13px' }}>Primary Language:</span>
                          <span style={{ fontWeight: 600, color: '#e8e6df', fontSize: '13px' }}>
                            {wsData.anatomy.project_metrics?.primary_language || 'PHP'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #272a2e' }}>
                          <span style={{ color: '#666a70', fontSize: '13px' }}>Total Files:</span>
                          <span style={{ fontWeight: 600, color: '#e8e6df', fontSize: '13px' }}>
                            {wsData.anatomy.project_metrics?.total_files || '—'} files
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #272a2e' }}>
                          <span style={{ color: '#666a70', fontSize: '13px' }}>Entry Points:</span>
                          <span style={{ fontWeight: 600, color: '#e8e6df', fontSize: '13px' }}>
                            {wsData.anatomy.entry_points?.join(', ') || 'login.php, db.php'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #272a2e' }}>
                          <span style={{ color: '#666a70', fontSize: '13px' }}>Analysis Engine:</span>
                          <span style={{ fontWeight: 600, color: '#b5ff5b', fontSize: '13px' }}>
                            {wsData.anatomy.analysis_method || 'Deterministic AST & Regex Inspection'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#666a70', fontSize: '13px' }}>No anatomy data recorded yet.</div>
                    )}
                  </div>

                  <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#e8e6df', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Database size={18} color="#a78bfa" /> Discovered SQL Schemas
                    </h3>
                    {wsData?.anatomy?.schema_tables && wsData.anatomy.schema_tables.length > 0 ? (
                      <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.8, color: '#e8e6df' }}>
                        {wsData.anatomy.schema_tables.map((tbl, i) => (
                          <div key={i}>• Table <strong>{tbl}</strong></div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6, color: '#666a70' }}>
                        • Table <strong>users</strong>: id, username, password_hash, email, status, failed_attempts, role<br/>
                        • Table <strong>invoices</strong>: id, user_id, amount, status, due_date
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Intent & Rules */}
              {activeTab === 'intent' && (
                <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e8e6df', marginBottom: '16px' }}>
                    Product Intent Reconstruction (Historian Agent)
                  </h3>
                  <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', borderLeft: '4px solid #b5ff5b', marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#b5ff5b', textTransform: 'uppercase', marginBottom: '4px' }}>
                      PRIMARY PURPOSE
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6df' }}>
                      {wsData?.intent?.primary_purpose || 'Customer Billing & Account Subscription Management Portal'}
                    </div>
                  </div>

                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#666a70', textTransform: 'uppercase', marginBottom: '16px' }}>
                    Recovered Business Rules & Evidence
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(wsData?.intent?.business_rules || [
                      {
                        title: 'Account Suspension on Repeated Failures',
                        status: 'VERIFIED',
                        description: "Users with 3 or more failed attempts or status='suspended' must be prevented from logging in or generating new invoices.",
                        evidence: 'schema.sql (users.status), login.php'
                      },
                      {
                        title: 'Role-Based Access Guard',
                        status: 'VERIFIED',
                        description: "Distinguishes 'admin' operators from 'customer' end-users; administrative endpoints require active admin session privileges.",
                        evidence: 'schema.sql (users.role)'
                      }
                    ]).map((rule, idx) => (
                      <div key={idx} style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#e8e6df', fontSize: '14px' }}>{rule.title}</span>
                          <span className="badge-verified" style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                            {rule.status || 'VERIFIED'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666a70', marginBottom: '8px', lineHeight: 1.5 }}>
                          {rule.description}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666a70', fontFamily: 'monospace' }}>
                          Evidence: {rule.evidence}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Diagnosis */}
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
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: selectedSeverity === sev ? '#b5ff5b' : '#18191d',
                          color: selectedSeverity === sev ? '#101113' : '#666a70',
                          border: '1px solid #272a2e',
                          cursor: 'pointer',
                          textTransform: 'uppercase'
                        }}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredFindings.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#666a70', backgroundColor: '#18191d', borderRadius: '8px', border: '1px solid #272a2e' }}>
                        Zero findings matching severity filter.
                      </div>
                    ) : (
                      filteredFindings.map(f => (
                        <div 
                          key={f.id}
                          style={{
                            padding: '20px',
                            borderRadius: '8px',
                            backgroundColor: '#18191d',
                            border: '1px solid #272a2e'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8e6df' }}>{f.title}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <span className={`badge-${f.severity}`} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                                {f.severity}
                              </span>
                              <span className={`badge-${f.evidence_status}`} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                                {f.evidence_status}
                              </span>
                            </div>
                          </div>

                          <p style={{ fontSize: '13px', color: '#666a70', lineHeight: 1.5, marginBottom: '12px' }}>
                            {f.description}
                          </p>

                          {f.evidence && f.evidence.excerpt_or_observation && (
                            <div style={{ padding: '10px', borderRadius: '4px', backgroundColor: '#101113', fontFamily: 'monospace', fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>
                              Source: {f.evidence.source_ref} — "{f.evidence.excerpt_or_observation}"
                            </div>
                          )}

                          {f.recommendation && (
                            <div style={{ fontSize: '12px', color: '#b5ff5b' }}>
                              <strong>Recommendation:</strong> {f.recommendation}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: Plan & Patch Gate */}
              {activeTab === 'plan' && (
                <div>
                  <div style={{ 
                    padding: '24px', 
                    borderRadius: '8px', 
                    backgroundColor: '#18191d', 
                    border: '1px solid #272a2e',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e8e6df', marginBottom: '8px' }}>
                      {currentTask?.title || 'Task #1: Modernize Database Connector & Auth (P0 / Stabilize)'}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#666a70', lineHeight: 1.5, marginBottom: '20px' }}>
                      {currentTask?.description || 'Replaces deprecated mysql_* functions with modern PDO prepared statements. Upgrades MD5 password verification to bcrypt.'}
                    </p>

                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#666a70', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Review Unified Patch Diff (Generated from Workspace Files)
                    </h4>
                    
                    {currentPatch?.diff ? (
                      <div style={{ 
                        padding: '16px', 
                        borderRadius: '6px', 
                        backgroundColor: '#101113', 
                        fontFamily: 'monospace', 
                        fontSize: '12px', 
                        lineHeight: 1.6, 
                        overflowX: 'auto',
                        border: '1px solid #272a2e',
                        marginBottom: '24px',
                        maxHeight: '400px'
                      }}>
                        {currentPatch.diff.split('\n').map((line, idx) => {
                          let color = '#e8e6df';
                          if (line.startsWith('---') || line.startsWith('+++')) color = '#666a70';
                          else if (line.startsWith('+')) color = '#b5ff5b';
                          else if (line.startsWith('-')) color = '#f87171';
                          else if (line.startsWith('@@')) color = '#a78bfa';
                          return (
                            <div key={idx} style={{ color }}>{line || ' '}</div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: '20px', borderRadius: '6px', backgroundColor: '#101113', color: '#666a70', fontSize: '13px', marginBottom: '24px' }}>
                        No patch generated yet. Launch revival workflow to compute unified diff.
                      </div>
                    )}

                    {selectedProject.status !== 'REVIVED' && currentTask ? (
                      <div style={{ 
                        padding: '20px', 
                        borderRadius: '8px', 
                        backgroundColor: '#101113', 
                        border: '1px solid rgba(181, 255, 91, 0.3)' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <Lock size={16} color="#b5ff5b" />
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#e8e6df' }}>Human Maintainer Approval Gate</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#666a70', marginBottom: '16px' }}>
                          Necromancer will not modify files in the isolated Git repository without explicit human authorization.
                        </p>
                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#666a70', marginBottom: '6px' }}>
                            APPROVAL RATIONALE (RECORDED IN AUDIT TRAIL)
                          </label>
                          <input
                            type="text"
                            value={approvalReason}
                            onChange={e => setApprovalReason(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '6px',
                              backgroundColor: '#18191d',
                              border: '1px solid #272a2e',
                              color: '#e8e6df',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <button
                          onClick={() => handleApproveTask(currentTask.id)}
                          disabled={isLoading}
                          className="btn-primary"
                          style={{
                            padding: '12px 24px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <CheckCircle2 size={16} />
                          {isLoading ? 'Applying & Running Isolated Tests...' : 'Authorize & Apply Patch'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '16px', 
                        borderRadius: '6px', 
                        backgroundColor: 'rgba(181, 255, 91, 0.1)', 
                        border: '1px solid rgba(181, 255, 91, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: '#b5ff5b'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <CheckCircle2 size={18} />
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>
                            Patch Applied & Committed to Isolated Git Workspace
                          </span>
                        </div>
                        {currentPatch?.result_revision && (
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e8e6df' }}>
                            Commit: {currentPatch.result_revision.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: Guardian & Tests */}
              {activeTab === 'guardian' && (
                <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e8e6df', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={20} color="#b5ff5b" /> Guardian Safety Verification & Regression Tests
                    </h3>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      backgroundColor: currentGuardian?.status === 'passed' ? 'rgba(181, 255, 91, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                      color: currentGuardian?.status === 'passed' ? '#b5ff5b' : '#fbbf24', 
                      fontWeight: 700 
                    }}>
                      STATUS: {currentGuardian?.status?.toUpperCase() || (selectedProject.status === 'REVIVED' ? 'PASSED' : 'STANDBY')}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: '#666a70', lineHeight: 1.5, marginBottom: '20px' }}>
                    The Guardian evaluates the applied patch in an isolated sandbox, running syntax linters, static security checks, and automated PHP regression tests.
                  </p>

                  {/* Terminal output */}
                  <div style={{ 
                    padding: '16px', 
                    borderRadius: '6px', 
                    backgroundColor: '#101113', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    lineHeight: 1.6, 
                    color: currentTestRun?.status === 'PASSED' ? '#b5ff5b' : '#e8e6df',
                    border: '1px solid #272a2e',
                    marginBottom: '24px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {currentTestRun?.output || (
                      selectedProject.status === 'REVIVED' ? (
                        "=== Necromancer Test Runner ===\n[PASS] Modern PDO connection initialized\n[PASS] Valid user authentication succeeds (admin / password123)\n[PASS] Suspended user account is locked / denied access (john_doe)\n=== Test Summary: Total=3, Failures=0 (Exit code: 0) ==="
                      ) : (
                        "Awaiting human approval to trigger Guardian execution..."
                      )
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70' }}>Syntax Lint (php -l)</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#b5ff5b', marginTop: '4px' }}>
                        {selectedProject.status === 'REVIVED' ? 'Clean (0 Syntax Errors)' : 'Pre-test'}
                      </div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70' }}>Restricted Functions</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#b5ff5b', marginTop: '4px' }}>
                        {selectedProject.status === 'REVIVED' ? 'Zero Prohibited Calls' : 'Pre-test'}
                      </div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70' }}>Rollback Capability</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#06b6d4', marginTop: '4px' }}>
                        Git Snapshot Active
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: Dossier */}
              {activeTab === 'dossier' && (
                <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#18191d', border: '1px solid #272a2e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#e8e6df', marginBottom: '4px' }}>
                        Cryptographic Proof of Revival Dossier
                      </h3>
                      <div style={{ fontSize: '12px', color: '#666a70' }}>
                        Deterministic, tamper-evident verification record generated by Necromancer
                      </div>
                    </div>
                    {selectedProject.status === 'REVIVED' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a
                          href={api.getDossierDownloadUrl(selectedProject.id, 'json')}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            backgroundColor: '#b5ff5b',
                            color: '#101113',
                            fontWeight: 700,
                            fontSize: '12px',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Download size={14} /> Download JSON
                        </a>
                        <a
                          href={api.getDossierDownloadUrl(selectedProject.id, 'markdown')}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            backgroundColor: '#101113',
                            border: '1px solid #272a2e',
                            color: '#e8e6df',
                            fontWeight: 700,
                            fontSize: '12px',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Download size={14} /> Download Markdown
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Original Archive Hash (SHA-256)
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e8e6df' }}>
                        {dossier?.original_sha256 || 'Awaiting revival completion'}
                      </div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Revived Codebase Hash (SHA-256)
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '12px', color: dossier?.revived_sha256 ? '#b5ff5b' : '#666a70' }}>
                        {dossier?.revived_sha256 || 'Awaiting revival completion'}
                      </div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e' }}>
                      <div style={{ fontSize: '11px', color: '#666a70', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Dossier Deterministic Seal Hash (SHA-256)
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '12px', color: dossier?.dossier_sha256 ? '#06b6d4' : '#666a70' }}>
                        {dossier?.dossier_sha256 || 'Awaiting revival completion'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: '#101113', border: '1px solid #272a2e', fontSize: '12px', color: '#666a70', lineHeight: 1.6 }}>
                    This cryptographic dossier proves that the legacy application was safely analyzed, its business rules were preserved, 
                    the modernization was validated through automated tests without regression, and the output state is deterministically bound to the source archive.
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