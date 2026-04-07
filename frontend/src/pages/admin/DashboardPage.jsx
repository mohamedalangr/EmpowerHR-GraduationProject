import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getJobs,
  hrGetDocuments,
  hrGetEmployees,
  hrGetExpenses,
  hrGetForms,
  hrGetLeaveRequests,
  hrGetTickets,
} from '../../api/index.js';
import { Btn, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export function AdminDashboardPage() {
  const { t } = useLanguage();
  const { resolvePath } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [forms, setForms] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    const loadAdminWorkspace = async () => {
      setLoading(true);
      try {
        const [employeeData, jobData, formData, leaveData, expenseData, documentData, ticketData] = await Promise.all([
          hrGetEmployees().catch(() => []),
          getJobs().catch(() => []),
          hrGetForms().catch(() => []),
          hrGetLeaveRequests().catch(() => []),
          hrGetExpenses().catch(() => []),
          hrGetDocuments().catch(() => []),
          hrGetTickets().catch(() => []),
        ]);

        setEmployees(Array.isArray(employeeData) ? employeeData : []);
        setJobs(Array.isArray(jobData) ? jobData : []);
        setForms(Array.isArray(formData) ? formData : []);
        setLeaveRequests(Array.isArray(leaveData) ? leaveData : []);
        setExpenses(Array.isArray(expenseData) ? expenseData : []);
        setDocuments(Array.isArray(documentData) ? documentData : []);
        setTickets(Array.isArray(ticketData) ? ticketData : []);
      } catch (error) {
        toast(error.message || 'Failed to load the admin workspace.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadAdminWorkspace();
  }, [toast]);

  const roleCounts = useMemo(() => employees.reduce((acc, employee) => {
    const key = employee?.role || 'TeamMember';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [employees]);

  const queueCount = leaveRequests.filter((item) => item?.status === 'Pending').length
    + expenses.filter((item) => ['Pending', 'Submitted'].includes(item?.status)).length
    + documents.filter((item) => ['Pending', 'In Progress'].includes(item?.status)).length
    + tickets.filter((item) => !['Resolved', 'Closed'].includes(item?.status)).length;

  const governanceCards = [
    {
      title: t('Candidate Experience'),
      mission: t('Own the job journey, applications, and hiring updates.'),
      shared: t('Shared access') + ': ' + t('profile.workspaceSnapshot'),
      accent: '#2563EB',
    },
    {
      title: t('Employee Self-Service'),
      mission: t('Personal attendance, payroll, benefits, documents, and support.'),
      shared: t('Shared access') + ': ' + t('nav.profile'),
      accent: '#0F766E',
    },
    {
      title: t('Leadership Workspace'),
      mission: t('Team coordination, approvals, and workload follow-up.'),
      shared: t('Shared access') + ': ' + t('nav.goals') + ' / ' + t('nav.tasks'),
      accent: '#7C3AED',
    },
    {
      title: t('HR Operations'),
      mission: t('People operations, compliance, and service delivery.'),
      shared: t('Shared access') + ': ' + t('nav.dashboard'),
      accent: '#E8321A',
    },
  ];

  const adminChecklist = [
    t('Review role coverage'),
    t('Watch queue pressure'),
    t('Keep route ownership aligned'),
  ];

  const adminPulseCards = useMemo(() => ([
    {
      label: t('Access Coverage'),
      value: Object.keys(roleCounts).length,
      note: `${roleCounts.Admin || 0} ${t('admins')} · ${roleCounts.TeamLeader || 0} ${t('leaders')}`,
      accent: '#2563EB',
    },
    {
      label: t('Queue Pressure'),
      value: queueCount,
      note: t('Leave, expense, document, and support items still in motion.'),
      accent: '#E8321A',
    },
    {
      label: t('Hiring Activity'),
      value: jobs.filter((job) => job?.is_active !== false).length,
      note: `${forms.filter((item) => item?.isActive).length} ${t('active forms')} · ${employees.length} ${t('people tracked')}`,
      accent: '#7C3AED',
    },
  ]), [employees.length, forms, jobs, queueCount, roleCounts, t]);

  return (
    <div className="hr-page-shell">
      <div className="hr-page-header is-split">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Admin Control Center')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {t('Oversee users, access coverage, and operational readiness across the platform.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="outline" onClick={() => navigate('/admin/users')}>{t('nav.users')}</Btn>
          <Btn onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('nav.approvals')}</Btn>
        </div>
      </div>

      <div className="hr-surface-card admin-owned-shell" style={{ padding: 18, marginBottom: 24 }}>
        <div className="admin-shell-topline">{t('Admin Control Center')}</div>
        <div className="admin-shell-header">
          <div className="admin-shell-copy">
            <div className="admin-shell-title">{t('Access & Governance Board')}</div>
            <div className="admin-shell-subtitle">{t('Monitor route ownership, queue pressure, and workspace health from one command layer.')}</div>
            <div className="admin-shell-meta">
              <span>{t('Role Coverage')}: {Object.keys(roleCounts).length}</span>
              <span>{t('Open Service Queues')}: {queueCount}</span>
              <span>{t('Managed People')}: {employees.length}</span>
            </div>
          </div>
          <div className="admin-shell-actions">
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/admin/users'))}>{t('nav.users')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('nav.approvals')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/jobs'))}>{t('nav.jobs')}</Btn>
          </div>
        </div>
        <div className="admin-shell-focus">
          <div className="admin-focus-card">
            <div className="admin-focus-label">{t('Admin Priority')}</div>
            <div className="admin-focus-note">{t('Keep admins, leaders, and HR service routes aligned while watching approval and operations load.')}</div>
          </div>
          <div className="admin-focus-card">
            <div className="admin-focus-label">{t('Decision Checklist')}</div>
            <div className="admin-chip-list">
              {adminChecklist.map((item) => (
                <span key={item} className="admin-chip">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 24 }}>
        {adminPulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="hr-stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: t('Managed People'), value: employees.length, accent: '#111827' },
          { label: t('Open Service Queues'), value: queueCount, accent: '#E8321A' },
          { label: t('Live Workspaces'), value: 5, accent: '#2563EB' },
          { label: t('Active Forms'), value: forms.filter((item) => item?.isActive).length, accent: '#7C3AED' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.15fr .85fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Access & Governance Board')}</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {governanceCards.map((card) => (
              <div key={card.title} className="workspace-action-card">
                <div className="workspace-action-card-head">
                  <div>
                    <div className="workspace-action-eyebrow">{t('Workspace lane')}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: card.accent }}>{card.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginTop: 6 }}>{card.mission}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 6 }}>{card.shared}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('System Activity')}</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Leave approvals')}</span><strong>{leaveRequests.filter((item) => item?.status === 'Pending').length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Expense reviews')}</span><strong>{expenses.filter((item) => ['Pending', 'Submitted'].includes(item?.status)).length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Document updates')}</span><strong>{documents.filter((item) => ['Pending', 'In Progress'].includes(item?.status)).length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Support follow-up')}</span><strong>{tickets.filter((item) => !['Resolved', 'Closed'].includes(item?.status)).length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Open Positions')}</span><strong>{jobs.filter((job) => job?.is_active !== false).length}</strong></div>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/employees'))}>{t('nav.employees')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/jobs'))}>{t('nav.jobs')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/forms'))}>{t('nav.forms')}</Btn>
          </div>
        </div>
      </div>

      <div className="hr-surface-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Role Coverage')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>{t('Monitor how each role contributes and keep the right work inside the right workspace.')}</div>
          </div>
        </div>

        {Object.keys(roleCounts).length === 0 ? (
          <div className="hr-soft-empty" style={{ padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No role distribution data available yet.')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {Object.entries(roleCounts).map(([role, count]) => (
              <div key={role} style={{ border: '1px solid #E5E7EB', borderRadius: 16, padding: '14px 16px', background: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t(`role.${role}`)}</div>
                <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
