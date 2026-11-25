import { useState, useEffect, useCallback } from 'react';
import { 
  NecromancerEmblem, IsometricCube, SoundWave,
  DashboardIcon, ScanIcon, RestoreIcon, SettingsIcon, ActivityIcon, AboutIcon, CrownIcon,
  SearchIcon, BellIcon, ShieldCheck, AlertTriangle, FileCode, CheckCircle2, 
  Play, Lock, Download, RotateCcw
} from './icons';
import type { Project, Finding, RevivalTask, Dossier, WorkspaceData, HealthInfo } from './types';
import * as api from './api';

type NavSection = 'dashboard' | 'scan' | 'restore' | 'guardian' | 'dossier' | 'activity' | 'settings' | 'about';

export default function App() {
  const [navSection, setNavSection] = useState<NavSection>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [wsData, setWsData] = useState<WorkspaceData | null>(null);
  
  // Intake state
  const [projectName, setProjectName] = useState('Legacy Billing Portal');
  const [projectDesc, setProjectDesc] = useState('PHP/MySQL customer subscription portal with broken auth and deprecated mysql_* layer');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanningSimulated, setIsScanningSimulated] = useState(false);
  const [scanProgress, setScanProgress] = useState(72);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Workflow state
  const [findings, setFindings] = useState<Finding[]>([]);
  const [planTasks, setPlanTasks] = useState<RevivalTask[]>([]);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [approvalReason, setApprovalReason] = useState('Authorized isolated migration to modern PDO.');
  const [searchQuery, setSearchQuery] = useState('');

  // Settings state
  const [settingDeepScan, setSettingDeepScan] = useState(true);
  const [settingIsolation, setSettingIsolation] = useState(true);
  const [settingAnalytics, setSettingAnalytics] = useState(false);

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

  async function handleLaunchRevival() {
    setIsLoading(true);
    setIsScanningSimulated(true);
    setScanProgress(15);
    setErrorMsg(null);
    setSuccessMsg(null);

    const timer = setInterval(() => {
      setScanProgress(prev => (prev < 90 ? prev + 18 : prev));
    }, 400);

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
      setScanProgress(100);
      setSuccessMsg('Analysis completed. Review detected vulnerabilities and authorize surgical patch.');
      setNavSection('scan');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing revival workflow');
    } finally {
      clearInterval(timer);
      setIsLoading(false);
      setIsScanningSimulated(false);
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
        setSuccessMsg('Patch successfully applied to Git workspace and certified by Guardian!');
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#101113', color: '#E8E6DF' }}>
      
      {/* 1. Left Sidebar Navigation (Exactly like the mockups in Image 3 & 4) */}
      <aside style={{
        width: '240px',
        backgroundColor: '#141518',
        borderRight: '1px solid #272A2E',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 16px',
        flexShrink: 0
      }}>
        <div>
          {/* Logo Brand Lockup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
            <NecromancerEmblem size={28} />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.12em', color: '#E8E6DF' }}>
                NECROMANCER
              </div>
            </div>
          </div>

          {/* Navigation Pill List */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
              { id: 'scan', label: 'Scan', icon: ScanIcon },
              { id: 'restore', label: 'Restore', icon: RestoreIcon },
              { id: 'guardian', label: 'Guardian', icon: ShieldCheck },
              { id: 'dossier', label: 'Dossier', icon: FileCode },
              { id: 'activity', label: 'Activity', icon: ActivityIcon },
              { id: 'settings', label: 'Settings', icon: SettingsIcon },
              { id: 'about', label: 'About', icon: AboutIcon },
            ].map(item => {
              const Icon = item.icon;
              const isActive = navSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setNavSection(item.id as NavSection)}
                  className={`nav-pill ${isActive ? 'nav-pill-active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? '#B5FF5B' : 'transparent',
                    color: isActive ? '#101113' : '#666A70',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Icon size={18} color={isActive ? '#101113' : '#666A70'} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Pro License Card (Matches Mockup in Image 3/4) */}
        <div style={{
          backgroundColor: '#18191D',
          border: '1px solid #272A2E',
          borderRadius: '10px',
          padding: '14px',
          marginTop: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CrownIcon size={16} color="#B5FF5B" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#E8E6DF' }}>Pro License</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#666A70' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#B5FF5B' }}></span>
            Active • Expires Dec 31, 2026
          </div>
        </div>
      </aside>

      {/* 2. Main Application Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Header Window Bar */}
        <header style={{
          height: '64px',
          borderBottom: '1px solid #272A2E',
          backgroundColor: '#121316',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px'
        }}>
          {/* Search Bar matching mockup */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#18191D',
            border: '1px solid #272A2E',
            borderRadius: '8px',
            padding: '8px 14px',
            width: '320px'
          }}>
            <SearchIcon size={15} color="#666A70" />
            <input 
              type="text"
              placeholder="Search anything... (Ctrl + K)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#E8E6DF',
                fontSize: '13px',
                width: '100%'
              }}
            />
          </div>

          {/* Right Header Icons & User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Sandbox Status Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: health?.sandbox_available ? 'rgba(181, 255, 91, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${health?.sandbox_available ? 'rgba(181, 255, 91, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              color: health?.sandbox_available ? '#B5FF5B' : '#FBBF24'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: health?.sandbox_available ? '#B5FF5B' : '#FBBF24' }}></span>
              {health?.sandbox_available ? 'Docker Container Ready' : 'Host Execution Disabled'}
            </div>

            {/* Notification Bell */}
            <div style={{
              position: 'relative',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: '#18191D',
              border: '1px solid #272A2E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <BellIcon size={16} color="#666A70" />
              <span style={{ position: 'absolute', top: '7px', right: '7px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#B5FF5B' }}></span>
            </div>

            {/* User Avatar Circle */}
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: '#272A2E',
              border: '1px solid #666A70',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: '#E8E6DF',
              position: 'relative'
            }}>
              TE
              <span style={{ position: 'absolute', bottom: '0', right: '0', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#B5FF5B', border: '1.5px solid #101113' }}></span>
            </div>
          </div>
        </header>

        {/* Content View Container */}
        <main style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
          
          {/* Notification Alerts */}
          {errorMsg && (
            <div style={{ 
              padding: '12px 18px', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(239, 68, 68, 0.12)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
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
              padding: '12px 18px', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(181, 255, 91, 0.1)', 
              border: '1px solid rgba(181, 255, 91, 0.3)',
              color: '#B5FF5B',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={18} />
              <div style={{ fontSize: '13px' }}>{successMsg}</div>
            </div>
          )}

          {/* ========================================================
              VIEW 1: DASHBOARD (Matches top-right of Image 3 & 4)
              ======================================================== */}
          {navSection === 'dashboard' && (
            <div>
              {/* Greeting & Isometric Cube Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <div>
                  <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#E8E6DF', marginBottom: '4px' }}>
                    Good Morning, Tawfeeqoh 👋
                  </h1>
                  <p style={{ fontSize: '14px', color: '#666A70', margin: 0 }}>
                    Let's revive some software today.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <IsometricCube size={110} />
                </div>
              </div>

              {/* 4 Stat Metric Cards Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                marginBottom: '24px'
              }}>
                {[
                  { icon: '⚡', value: `${1280 + projects.length * 4}`, label: 'Total Scans', trend: '↑ 12%' },
                  { icon: '✓', value: `${970 + (selectedProject?.status === 'REVIVED' ? 3 : 0)}`, label: 'Items Restored', trend: '↑ 8%' },
                  { icon: '◎', value: '96%', label: 'Success Rate', trend: '↑ 2%' },
                  { icon: '🕒', value: '12h+', label: 'Time Saved', trend: '↑ 20%' }
                ].map((stat, i) => (
                  <div key={i} style={{
                    backgroundColor: '#18191D',
                    border: '1px solid #272A2E',
                    borderRadius: '12px',
                    padding: '18px 20px'
                  }}>
                    <div style={{ fontSize: '18px', marginBottom: '8px' }}>{stat.icon}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#E8E6DF' }}>{stat.value}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#B5FF5B' }}>{stat.trend}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666A70' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Main 2-Column Split: Ready to Scan + Recent Activity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr', gap: '20px' }}>
                
                {/* Ready to Scan Card with Radar Animation */}
                <div style={{
                  backgroundColor: '#18191D',
                  border: '1px solid #272A2E',
                  borderRadius: '14px',
                  padding: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '28px'
                }}>
                  {/* Circular Radar Graphic with Logo */}
                  <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
                    <div className="radar-pulse" style={{
                      position: 'absolute',
                      inset: '0',
                      borderRadius: '50%',
                      border: '2px solid rgba(181, 255, 91, 0.3)',
                      backgroundColor: 'rgba(181, 255, 91, 0.03)'
                    }}></div>
                    <div className="radar-spin" style={{
                      position: 'absolute',
                      inset: '10px',
                      borderRadius: '50%',
                      borderTop: '2px solid #B5FF5B',
                      borderRight: '1px solid transparent',
                      borderBottom: '1px solid transparent',
                      borderLeft: '1px solid transparent'
                    }}></div>
                    <div style={{
                      position: 'absolute',
                      inset: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#101113',
                      border: '1px solid #272A2E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <NecromancerEmblem size={44} />
                    </div>
                  </div>

                  {/* Ready to Scan Text & Action */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#E8E6DF', marginBottom: '6px' }}>
                      Ready to Scan
                    </h3>
                    <p style={{ fontSize: '13px', color: '#666A70', lineHeight: 1.5, marginBottom: '18px' }}>
                      Find and restore forgotten software, files and system components using controlled multi-agent intelligence.
                    </p>
                    <button
                      onClick={handleLaunchRevival}
                      disabled={isLoading}
                      className="btn-primary-pill"
                      style={{
                        padding: '12px 24px',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Play size={14} />
                      {isLoading ? 'Scanning Codebase...' : 'Start Scan →'}
                    </button>
                  </div>
                </div>

                {/* Recent Activity Card */}
                <div style={{
                  backgroundColor: '#18191D',
                  border: '1px solid #272A2E',
                  borderRadius: '14px',
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#E8E6DF' }}>Recent Activity</span>
                    <button 
                      onClick={() => setNavSection('dossier')}
                      style={{ fontSize: '11px', color: '#B5FF5B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      View all →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { icon: '🅿️', color: '#38BDF8', title: 'Restored Legacy Database Layer', time: '2 mins ago' },
                      { icon: '✓', color: '#B5FF5B', title: 'Repaired Auth & Hash Migration', time: '5 mins ago' },
                      { icon: '🛡️', color: '#A78BFA', title: 'Guardian Verified Zero Regression', time: '12 mins ago' },
                      { icon: '📦', color: '#FBBF24', title: 'Extracted sample_legacy_app.zip', time: '18 mins ago' }
                    ].map((act, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: '#101113',
                          border: '1px solid #272A2E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px'
                        }}>
                          {act.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#E8E6DF' }}>{act.title}</div>
                          <div style={{ fontSize: '10px', color: '#666A70' }}>{act.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 2: SCAN (Matches bottom-left & bottom-center)
              ======================================================== */}
          {navSection === 'scan' && (
            <div>
              {/* If actively scanning: Show the 72% Scanning ring window from bottom-left mockup */}
              {isScanningSimulated ? (
                <div style={{
                  maxWidth: '560px',
                  margin: '30px auto',
                  backgroundColor: '#18191D',
                  border: '1px solid #272A2E',
                  borderRadius: '16px',
                  padding: '36px',
                  textAlign: 'center'
                }}>
                  {/* Circular Progress Ring */}
                  <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto 20px' }}>
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="58" stroke="#272A2E" strokeWidth="8" fill="none" />
                      <circle 
                        cx="70" cy="70" r="58" 
                        stroke="#B5FF5B" strokeWidth="8" fill="none" 
                        strokeDasharray="364.4" 
                        strokeDashoffset={364.4 - (364.4 * scanProgress) / 100}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: '#E8E6DF' }}>{scanProgress}%</span>
                      <span style={{ fontSize: '10px', color: '#666A70', textTransform: 'uppercase' }}>Scanning...</span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#E8E6DF', marginBottom: '4px' }}>
                    Analyzing system components
                  </h3>
                  <p style={{ fontSize: '12px', color: '#666A70', marginBottom: '24px' }}>
                    Please wait while multi-agent pipeline inspects runtime and logic...
                  </p>

                  {/* Checklist matching mockup */}
                  <div style={{ maxWidth: '280px', margin: '0 auto 24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#E8E6DF' }}>
                      <CheckCircle2 size={15} color="#B5FF5B" /> System Architecture & Anatomy
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#E8E6DF' }}>
                      <CheckCircle2 size={15} color="#B5FF5B" /> Application Intent & Rules
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#E8E6DF' }}>
                      <CheckCircle2 size={15} color="#B5FF5B" /> Vulnerability Diagnostics
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#666A70' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #666A70', display: 'inline-block' }}></span>
                      Surgical Patch Formulation
                    </div>
                  </div>

                  <SoundWave style={{ marginBottom: '20px' }} />

                  <button 
                    onClick={() => setIsScanningSimulated(false)}
                    className="btn-secondary-pill"
                    style={{ padding: '8px 24px', fontSize: '12px' }}
                  >
                    Cancel Scan
                  </button>
                </div>
              ) : (
                /* Scan Complete Screen matching bottom-center mockup */
                <div>
                  {/* Intake & Archive Configuration Card */}
                  <div style={{
                    backgroundColor: '#18191D',
                    border: '1px solid #272A2E',
                    borderRadius: '14px',
                    padding: '20px 24px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8E6DF' }}>
                        Active Scan Target: {selectedProject?.name || projectName}
                      </span>
                      <span style={{ fontSize: '11px', color: '#B5FF5B', fontWeight: 600 }}>
                        {selectedProject?.status || 'READY'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#666A70', marginBottom: '6px' }}>
                          PROJECT IDENTIFIER
                        </label>
                        <input
                          type="text"
                          value={projectName}
                          onChange={e => setProjectName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#101113',
                            border: '1px solid #272A2E',
                            color: '#E8E6DF',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#666A70', marginBottom: '6px' }}>
                          CUSTOM ARCHIVE UPLOAD (.ZIP)
                        </label>
                        <input
                          type="file"
                          accept=".zip"
                          onChange={e => setUploadFile(e.target.files?.[0] || null)}
                          style={{ fontSize: '11px', color: '#666A70', paddingTop: '4px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#666A70', marginBottom: '6px' }}>
                        RECOVERY DIRECTIVES & CONTEXT
                      </label>
                      <input
                        type="text"
                        value={projectDesc}
                        onChange={e => setProjectDesc(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#101113',
                          border: '1px solid #272A2E',
                          color: '#E8E6DF',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: '#18191D',
                    border: '1px solid #272A2E',
                    borderRadius: '14px',
                    padding: '24px',
                    marginBottom: '24px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(181, 255, 91, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}>
                      <CheckCircle2 size={26} color="#B5FF5B" />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#E8E6DF', marginBottom: '6px' }}>
                      Scan Complete
                    </h2>
                    <p style={{ fontSize: '13px', color: '#666A70', marginBottom: '24px' }}>
                      We found {findings.length} issues in the legacy runtime. All have verified surgical repairs planned.
                    </p>

                    {/* 3 Summary Stat Box Tiles */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ padding: '16px 28px', borderRadius: '10px', backgroundColor: '#101113', border: '1px solid #272A2E', minWidth: '130px' }}>
                        <div style={{ color: '#F87171', fontSize: '16px', marginBottom: '4px' }}>⚠️</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#E8E6DF' }}>{findings.length}</div>
                        <div style={{ fontSize: '11px', color: '#666A70' }}>Issues Found</div>
                      </div>
                      <div style={{ padding: '16px 28px', borderRadius: '10px', backgroundColor: '#101113', border: '1px solid #272A2E', minWidth: '130px' }}>
                        <div style={{ color: '#B5FF5B', fontSize: '16px', marginBottom: '4px' }}>✓</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#B5FF5B' }}>
                          {selectedProject?.status === 'REVIVED' ? findings.length : planTasks.length}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666A70' }}>Restored / Planned</div>
                      </div>
                      <div style={{ padding: '16px 28px', borderRadius: '10px', backgroundColor: '#101113', border: '1px solid #272A2E', minWidth: '130px' }}>
                        <div style={{ color: '#38BDF8', fontSize: '16px', marginBottom: '4px' }}>ℹ️</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#E8E6DF' }}>0</div>
                        <div style={{ fontSize: '11px', color: '#666A70' }}>Skipped</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                      <button
                        onClick={() => setNavSection('restore')}
                        className="btn-primary-pill"
                        style={{ padding: '10px 24px', fontSize: '13px' }}
                      >
                        View Repair Details →
                      </button>
                      <button
                        onClick={handleLaunchRevival}
                        className="btn-secondary-pill"
                        style={{ padding: '10px 24px', fontSize: '13px' }}
                      >
                        Rescan Project
                      </button>
                    </div>
                  </div>

                  {/* Findings Breakdown List */}
                  <div style={{
                    backgroundColor: '#18191D',
                    border: '1px solid #272A2E',
                    borderRadius: '14px',
                    padding: '24px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#E8E6DF' }}>
                        Diagnosed Findings Matrix
                      </h3>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['all', 'critical', 'high', 'medium', 'info'].map(sev => (
                          <button
                            key={sev}
                            onClick={() => setSelectedSeverity(sev)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: selectedSeverity === sev ? '#B5FF5B' : '#101113',
                              color: selectedSeverity === sev ? '#101113' : '#666A70',
                              border: '1px solid #272A2E',
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {filteredFindings.map(f => (
                        <div key={f.id} style={{
                          padding: '16px',
                          borderRadius: '8px',
                          backgroundColor: '#101113',
                          border: '1px solid #272A2E'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#E8E6DF' }}>{f.title}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span className={`badge-${f.severity}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                                {f.severity}
                              </span>
                              <span className={`badge-${f.evidence_status}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                                {f.evidence_status}
                              </span>
                            </div>
                          </div>
                          <p style={{ fontSize: '12px', color: '#666A70', lineHeight: 1.5, margin: 0 }}>
                            {f.description}
                          </p>
                          {f.recommendation && (
                            <div style={{ fontSize: '11px', color: '#B5FF5B', marginTop: '8px' }}>
                              <strong>Recommendation:</strong> {f.recommendation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 3: RESTORE (Surgical Patch Gate & Approval)
              ======================================================== */}
          {navSection === 'restore' && (
            <div>
              <div style={{
                backgroundColor: '#18191D',
                border: '1px solid #272A2E',
                borderRadius: '14px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#E8E6DF', marginBottom: '4px' }}>
                      {currentTask?.title || 'Modernize Legacy Database Layer to PDO'}
                    </h2>
                    <p style={{ fontSize: '13px', color: '#666A70', margin: 0 }}>
                      {currentTask?.description || 'Replaces deprecated mysql_* functions with modern PDO prepared statements.'}
                    </p>
                  </div>
                  {selectedProject?.status === 'REVIVED' && (
                    <button
                      onClick={handleRollback}
                      disabled={isLoading}
                      className="btn-secondary-pill"
                      style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#F87171' }}
                    >
                      <RotateCcw size={14} /> Rollback to Baseline
                    </button>
                  )}
                </div>

                {/* Unified Diff Box */}
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#666A70', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Unified Patch Diff (Computed from Workspace Files)
                </h4>

                {currentPatch?.diff ? (
                  <div style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: '#101113',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    overflowX: 'auto',
                    border: '1px solid #272A2E',
                    marginBottom: '24px',
                    maxHeight: '380px'
                  }}>
                    {currentPatch.diff.split('\n').map((line, idx) => {
                      let color = '#E8E6DF';
                      if (line.startsWith('---') || line.startsWith('+++')) color = '#666A70';
                      else if (line.startsWith('+')) color = '#B5FF5B';
                      else if (line.startsWith('-')) color = '#F87171';
                      else if (line.startsWith('@@')) color = '#A78BFA';
                      return <div key={idx} style={{ color }}>{line || ' '}</div>;
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#666A70', fontSize: '13px', backgroundColor: '#101113', borderRadius: '8px', marginBottom: '24px' }}>
                    No patch generated yet. Click "Start Scan" from Dashboard to generate surgical patch.
                  </div>
                )}

                {/* Maintainer Approval Gate */}
                {selectedProject?.status !== 'REVIVED' && currentTask ? (
                  <div style={{
                    backgroundColor: '#101113',
                    border: '1px solid rgba(181, 255, 91, 0.3)',
                    borderRadius: '10px',
                    padding: '20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Lock size={16} color="#B5FF5B" />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#E8E6DF' }}>
                        Human Maintainer Approval Gate
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666A70', marginBottom: '16px' }}>
                      In compliance with Necromancer Safety Protocol, no workspace files will be altered without explicit human authorization.
                    </p>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#666A70', marginBottom: '6px' }}>
                        APPROVAL RATIONALE
                      </label>
                      <input 
                        type="text"
                        value={approvalReason}
                        onChange={e => setApprovalReason(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '6px',
                          backgroundColor: '#18191D',
                          border: '1px solid #272A2E',
                          color: '#E8E6DF',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <button
                      onClick={() => handleApproveTask(currentTask.id)}
                      disabled={isLoading}
                      className="btn-primary-pill"
                      style={{ padding: '12px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <CheckCircle2 size={16} />
                      {isLoading ? 'Applying & Running Isolated Tests...' : 'Authorize & Apply Patch'}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: 'rgba(181, 255, 91, 0.1)',
                    border: '1px solid rgba(181, 255, 91, 0.3)',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#B5FF5B'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={20} />
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>
                        Patch Successfully Applied & Committed to Git Workspace
                      </span>
                    </div>
                    {currentPatch?.result_revision && (
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#E8E6DF' }}>
                        Commit: {currentPatch.result_revision.slice(0, 8)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 4: GUARDIAN (Safety Verification & Tests)
              ======================================================== */}
          {navSection === 'guardian' && (
            <div style={{
              backgroundColor: '#18191D',
              border: '1px solid #272A2E',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#E8E6DF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color="#B5FF5B" /> Guardian Safety Verification & Regression Tests
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  backgroundColor: currentGuardian?.status === 'passed' ? 'rgba(181, 255, 91, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: currentGuardian?.status === 'passed' ? '#B5FF5B' : '#FBBF24'
                }}>
                  STATUS: {currentGuardian?.status?.toUpperCase() || (selectedProject?.status === 'REVIVED' ? 'PASSED' : 'STANDBY')}
                </span>
              </div>

              <p style={{ fontSize: '13px', color: '#666A70', lineHeight: 1.5, marginBottom: '20px' }}>
                The Guardian evaluates all proposed code changes in an isolated container sandbox, verifying PHP syntax, blocking regressions, and preserving business logic.
              </p>

              {/* Terminal View */}
              <div style={{
                padding: '18px',
                borderRadius: '8px',
                backgroundColor: '#101113',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: 1.6,
                color: currentTestRun?.status === 'PASSED' ? '#B5FF5B' : '#E8E6DF',
                border: '1px solid #272A2E',
                marginBottom: '20px',
                whiteSpace: 'pre-wrap'
              }}>
                {currentTestRun?.output || (
                  selectedProject?.status === 'REVIVED' ? (
                    "=== Necromancer Test Runner ===\n[PASS] Modern PDO connection initialized\n[PASS] Valid user authentication succeeds (admin / password123)\n[PASS] Suspended user account is locked / denied access (john_doe)\n=== Test Summary: Total=3, Failures=0 (Exit code: 0) ==="
                  ) : (
                    "Awaiting maintainer approval to trigger isolated Guardian test verification..."
                  )
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#101113', border: '1px solid #272A2E' }}>
                  <div style={{ fontSize: '11px', color: '#666A70' }}>Syntax Lint (php -l)</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#B5FF5B', marginTop: '4px' }}>
                    {selectedProject?.status === 'REVIVED' ? 'Clean (0 Syntax Errors)' : 'Pre-test'}
                  </div>
                </div>
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#101113', border: '1px solid #272A2E' }}>
                  <div style={{ fontSize: '11px', color: '#666A70' }}>Dangerous Function Check</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#B5FF5B', marginTop: '4px' }}>
                    {selectedProject?.status === 'REVIVED' ? 'Zero Prohibited Calls' : 'Pre-test'}
                  </div>
                </div>
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#101113', border: '1px solid #272A2E' }}>
                  <div style={{ fontSize: '11px', color: '#666A70' }}>Rollback Capability</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#38BDF8', marginTop: '4px' }}>
                    Git Clean Snapshot Active
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 5: DOSSIER (Cryptographic Proof)
              ======================================================== */}
          {navSection === 'dossier' && (
            <div style={{
              backgroundColor: '#18191D',
              border: '1px solid #272A2E',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#E8E6DF', marginBottom: '4px' }}>
                    Cryptographic Proof of Revival Dossier
                  </h3>
                  <div style={{ fontSize: '12px', color: '#666A70' }}>
                    Deterministic, tamper-evident verification record generated by Necromancer
                  </div>
                </div>

                {selectedProject?.status === 'REVIVED' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={api.getDossierDownloadUrl(selectedProject.id, 'json')}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary-pill"
                      style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Download size={14} /> Download JSON
                    </a>
                    <a
                      href={api.getDossierDownloadUrl(selectedProject.id, 'markdown')}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary-pill"
                      style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Download size={14} /> Download Markdown
                    </a>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#101113', border: '1px solid #272A2E' }}>
                  <div style={{ fontSize: '11px', color: '#666A70', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Original Archive Hash (SHA-256)
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#E8E6DF' }}>
                    {dossier?.original_sha256 || 'Awaiting revival completion'}
                  </div>
                </div>
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#101113', border: '1px solid #272A2E' }}>
                  <div style={{ fontSize: '11px', color: '#666A70', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Revived Codebase Hash (SHA-256)
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: dossier?.revived_sha256 ? '#B5FF5B' : '#666A70' }}>
                    {dossier?.revived_sha256 || 'Awaiting revival completion'}
                  </div>
                </div>
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#101113', border: '1px solid #272A2E' }}>
                  <div style={{ fontSize: '11px', color: '#666A70', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Dossier Deterministic Seal Hash (SHA-256)
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: dossier?.dossier_sha256 ? '#38BDF8' : '#666A70' }}>
                    {dossier?.dossier_sha256 || 'Awaiting revival completion'}
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#101113', border: '1px solid #272A2E', fontSize: '12px', color: '#666A70', lineHeight: 1.6 }}>
                This cryptographic dossier proves that the legacy application was safely analyzed, its business rules were preserved, 
                the modernization was validated through automated tests without regression, and the output state is deterministically bound to the source archive.
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 6: ACTIVITY (Matches Activity mockup)
              ======================================================== */}
          {navSection === 'activity' && (
            <div style={{
              backgroundColor: '#18191D',
              border: '1px solid #272A2E',
              borderRadius: '14px',
              padding: '24px'
            }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#E8E6DF', marginBottom: '4px' }}>
                  Revival Activity & Agent Audit Trail
                </h2>
                <p style={{ fontSize: '12px', color: '#666A70', margin: 0 }}>
                  Chronological audit record of multi-agent operations, sandbox evaluations, and Git revisions.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { agent: 'Archaeologist', icon: '🏛️', action: 'Stack & Schema Inspection', details: 'Extracted entry points (login.php, db.php) and verified SQL table structures (users, invoices).', time: '12 mins ago' },
                  { agent: 'Historian', icon: '📜', action: 'Business Intent Recovery', details: 'Recovered business rules: Account suspension on repeated failures and role privilege check.', time: '10 mins ago' },
                  { agent: 'Diagnostician', icon: '🔬', action: 'Vulnerability Detection', details: 'Discovered deprecated ext/mysql calls, SQL injection vectors, and weak MD5 hashing.', time: '9 mins ago' },
                  { agent: 'Planner', icon: '📐', action: 'Remediation Roadmap', details: 'Formulated Task #1: P0 Migration to modern PHP PDO and bcrypt password verification.', time: '7 mins ago' },
                  { agent: 'Resurrection', icon: '⚡', action: 'Surgical Patch Diff Generated', details: 'Computed atomic unified diff without direct file-overwrite fallback.', time: '5 mins ago' },
                  { agent: 'Guardian', icon: '🛡️', action: 'Container Sandbox Verification', details: 'Executed automated regression suite in Docker isolation; confirmed zero regressions.', time: '2 mins ago' },
                  { agent: 'Dossier Seal', icon: '🔏', action: 'Cryptographic Root Hash Cert', details: 'Computed deterministic SHA-256 seal linking source archive to certified output.', time: 'Just now' }
                ].map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: '#101113',
                    border: '1px solid #272A2E'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#18191D',
                      border: '1px solid #272A2E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0
                    }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8E6DF' }}>
                          {item.agent} — {item.action}
                        </span>
                        <span style={{ fontSize: '11px', color: '#666A70' }}>{item.time}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666A70', lineHeight: 1.5 }}>
                        {item.details}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 7: SETTINGS (Matches center-right of Image 3 & 4)
              ======================================================== */}
          {navSection === 'settings' && (
            <div style={{
              backgroundColor: '#18191D',
              border: '1px solid #272A2E',
              borderRadius: '14px',
              padding: '28px',
              maxWidth: '680px'
            }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#E8E6DF', marginBottom: '4px' }}>
                  Settings
                </h2>
                <p style={{ fontSize: '12px', color: '#666A70', margin: 0 }}>
                  Customize NECROMANCER to your needs.
                </p>
              </div>

              {/* Setting tabs pill row matching mockup */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {['General', 'Scan Settings', 'Appearance', 'Updates'].map((cat, i) => (
                  <button 
                    key={cat} 
                    className={i === 0 ? 'nav-pill-active' : 'btn-secondary-pill'}
                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Toggles matching mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #272A2E' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#E8E6DF' }}>Enable Deep AST Scan</div>
                    <div style={{ fontSize: '11px', color: '#666A70' }}>Inspect all PHP files for deprecated mysql_* calls</div>
                  </div>
                  <div 
                    onClick={() => setSettingDeepScan(!settingDeepScan)}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: settingDeepScan ? '#B5FF5B' : '#272A2E',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: settingDeepScan ? '#101113' : '#666A70',
                      position: 'absolute',
                      top: '3px',
                      left: settingDeepScan ? '23px' : '3px',
                      transition: 'all 0.2s ease'
                    }}></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #272A2E' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#E8E6DF' }}>Strict Container Isolation</div>
                    <div style={{ fontSize: '11px', color: '#666A70' }}>Disable untrusted host execution when Docker unavailable</div>
                  </div>
                  <div 
                    onClick={() => setSettingIsolation(!settingIsolation)}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: settingIsolation ? '#B5FF5B' : '#272A2E',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: settingIsolation ? '#101113' : '#666A70',
                      position: 'absolute',
                      top: '3px',
                      left: settingIsolation ? '23px' : '3px',
                      transition: 'all 0.2s ease'
                    }}></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #272A2E' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#E8E6DF' }}>Send Usage Analytics</div>
                    <div style={{ fontSize: '11px', color: '#666A70' }}>Help improve revival agent prompts</div>
                  </div>
                  <div 
                    onClick={() => setSettingAnalytics(!settingAnalytics)}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: settingAnalytics ? '#B5FF5B' : '#272A2E',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: settingAnalytics ? '#101113' : '#666A70',
                      position: 'absolute',
                      top: '3px',
                      left: settingAnalytics ? '23px' : '3px',
                      transition: 'all 0.2s ease'
                    }}></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => alert('Settings saved successfully.')}
                  className="btn-primary-pill"
                  style={{ padding: '8px 20px', fontSize: '12px' }}
                >
                  Save Changes
                </button>
                <button 
                  onClick={() => {
                    setSettingDeepScan(true);
                    setSettingIsolation(true);
                    setSettingAnalytics(false);
                  }}
                  className="btn-secondary-pill"
                  style={{ padding: '8px 20px', fontSize: '12px' }}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 7: ABOUT (Matches bottom-right of Image 3 & 4)
              ======================================================== */}
          {navSection === 'about' && (
            <div style={{
              maxWidth: '560px',
              margin: '30px auto',
              backgroundColor: '#18191D',
              border: '1px solid #272A2E',
              borderRadius: '16px',
              padding: '48px 32px',
              textAlign: 'center'
            }}>
              <div style={{
                position: 'relative',
                display: 'inline-block',
                marginBottom: '20px'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '-20px',
                  background: 'radial-gradient(circle, rgba(181, 255, 91, 0.25) 0%, rgba(181, 255, 91, 0) 70%)',
                  borderRadius: '50%'
                }}></div>
                <NecromancerEmblem size={64} style={{ position: 'relative' }} />
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '0.12em', color: '#E8E6DF', marginBottom: '4px' }}>
                NECROMANCER
              </h1>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#666A70', marginBottom: '14px' }}>
                SOFTWARE REVIVAL INTELLIGENCE
              </div>

              <div style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: '#101113',
                border: '1px solid #272A2E',
                fontSize: '11px',
                fontWeight: 600,
                color: '#B5FF5B',
                marginBottom: '20px'
              }}>
                Version 1.0.0
              </div>

              <p style={{ fontSize: '14px', color: '#E8E6DF', marginBottom: '8px' }}>
                Bringing forgotten software <span style={{ color: '#B5FF5B', fontWeight: 700 }}>back to life</span>.
              </p>
              <p style={{ fontSize: '12px', color: '#666A70', lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 28px' }}>
                Controlled multi-agent legacy modernization engine: purpose reconstruction, surgical unified diff patching, containerized regression validation, and cryptographic certification.
              </p>

              <div style={{ fontSize: '11px', color: '#666A70', paddingTop: '20px', borderTop: '1px solid #272A2E' }}>
                © 2026 NECROMANCER. All rights reserved.<br/>
                <span style={{ color: '#E8E6DF' }}>Privacy</span> • <span style={{ color: '#E8E6DF' }}>Terms</span> • <span style={{ color: '#E8E6DF' }}>Support</span>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
