import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hrGetEmployees,
  hrGetRosterHealth,
  hrCreateEmployeeRecord,
  hrUpdateEmployeeRecord,
  hrDeleteEmployeeRecord,
  hrGetEmployeeHistory,
  hrGetEmployeeSnapshot,
  hrChangeEmployeeRole,
  getPredictions,
} from '../../api/index.js';
import { Spinner, Modal, Btn, Badge, Input, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  jobTitle: '',
  department: '',
  team: '',
  role: 'TeamMember',
  employeeType: 'Full-time',
  location: '',
  employmentStatus: 'Active',
  yearsAtCompany: '',
  monthlyIncome: '',
};

const EMPTY_ROLE_CHANGE = {
  action: 'Promotion',
  jobTitle: '',
  role: 'TeamMember',
  department: '',
  team: '',
  monthlyIncome: '',
  notes: '',
};

const ROLE_OPTIONS = ['TeamMember', 'TeamLeader', 'HRManager', 'Admin'];
const TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Intern'];
const STATUS_OPTIONS = ['Active', 'Probation', 'On Leave'];
const ACTION_OPTIONS = ['Promotion', 'Demotion', 'Role Change'];
const EMPTY_ROSTER_HEALTH = { summary: {}, departmentBreakdown: [], followUpItems: [] };

const selectStyle = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--gray-100)',
  border: '2px solid transparent',
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--gray-900)',
  outline: 'none',
};

function uniqueValues(items, key) {
  return [...new Set(items.map(item => item?.[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `EGP ${Number(value).toLocaleString()}`;
}

function downloadTextFile(filename, content, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function HREmployeesPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRoleChange, setShowRoleChange] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [rosterHealth, setRosterHealth] = useState(EMPTY_ROSTER_HEALTH);
  const [employeeRisks, setEmployeeRisks] = useState({});
  const [filters, setFilters] = useState({ search: '', department: '', role: '', type: '', location: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [roleChange, setRoleChange] = useState(EMPTY_ROLE_CHANGE);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const [data, latestPredictions, rosterData] = await Promise.all([
        hrGetEmployees(),
        getPredictions().catch(() => []),
        hrGetRosterHealth().catch(() => EMPTY_ROSTER_HEALTH),
      ]);
      setEmployees(Array.isArray(data) ? data : []);
      setRosterHealth(rosterData && typeof rosterData === 'object' ? rosterData : EMPTY_ROSTER_HEALTH);
      setEmployeeRisks(
        (Array.isArray(latestPredictions) ? latestPredictions : []).reduce((acc, item) => {
          if (item?.employeeID) acc[item.employeeID] = item;
          return acc;
        }, {})
      );
    } catch (error) {
      toast(error.message || 'Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch = !search || [
        employee.fullName,
        employee.email,
        employee.jobTitle,
        employee.department,
        employee.employeeID,
      ].some(value => String(value || '').toLowerCase().includes(search));

      const matchesDepartment = !filters.department || (employee.department || '') === filters.department;
      const matchesRole = !filters.role || (employee.role || '') === filters.role;
      const matchesType = !filters.type || (employee.employeeType || '') === filters.type;
      const matchesLocation = !filters.location || (employee.location || '') === filters.location;

      return matchesSearch && matchesDepartment && matchesRole && matchesType && matchesLocation;
    });
  }, [employees, filters]);

  const departments = useMemo(() => uniqueValues(employees, 'department'), [employees]);
  const roles = useMemo(() => uniqueValues(employees, 'role'), [employees]);
  const locations = useMemo(() => uniqueValues(employees, 'location'), [employees]);
  const activeCount = employees.filter(employee => employee.employmentStatus === 'Active').length;
  const promotionCount = employees.reduce((sum, employee) => sum + (employee.numberOfPromotions || 0), 0);
  const followUpCount = Object.values(employeeRisks).filter((item) => ['High', 'Medium'].includes(item?.riskLevel)).length;
  const rosterSummary = rosterHealth?.summary || {};
  const dataQuality = useMemo(() => {
    const salaryMapped = employees.filter((employee) => employee.monthlyIncome !== null && employee.monthlyIncome !== undefined && employee.monthlyIncome !== '').length;
    const locationMapped = employees.filter((employee) => String(employee.location || '').trim() !== '').length;
    const departmentMapped = employees.filter((employee) => String(employee.department || '').trim() !== '').length;
    const totalChecks = employees.length * 3;
    const completedChecks = salaryMapped + locationMapped + departmentMapped;
    return {
      salaryMapped,
      locationMapped,
      departmentMapped,
      probationCount: employees.filter((employee) => employee.employmentStatus === 'Probation').length,
      onLeaveCount: employees.filter((employee) => employee.employmentStatus === 'On Leave').length,
      coveragePct: totalChecks ? Math.round((completedChecks / totalChecks) * 100) : 0,
    };
  }, [employees]);
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '—');
  const formatDateTime = (value) => (value ? new Date(value).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : '—');
  const riskColor = (level) => {
    if (level === 'High') return 'red';
    if (level === 'Medium') return 'orange';
    if (level === 'Low') return 'green';
    return 'gray';
  };

  const setField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const setRoleChangeField = (key) => (event) => {
    setRoleChange((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const normalizePayload = () => ({
    ...form,
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    monthlyIncome: form.monthlyIncome === '' ? null : Number(form.monthlyIncome),
    yearsAtCompany: form.yearsAtCompany === '' ? null : Number(form.yearsAtCompany),
  });

  const resetForm = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (employee) => {
    setSelected(employee);
    setForm({
      ...EMPTY_FORM,
      ...employee,
      monthlyIncome: employee.monthlyIncome ?? '',
      yearsAtCompany: employee.yearsAtCompany ?? '',
    });
    setShowEdit(true);
  };

  const openRoleChangeModal = (employee) => {
    setSelected(employee);
    setRoleChange({
      action: 'Promotion',
      jobTitle: employee.jobTitle || '',
      role: employee.role || 'TeamMember',
      department: employee.department || '',
      team: employee.team || '',
      monthlyIncome: employee.monthlyIncome ?? '',
      notes: '',
    });
    setShowRoleChange(true);
  };

  const openHistoryModal = async (employee) => {
    setSelected(employee);
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const data = await hrGetEmployeeHistory(employee.employeeID);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(error.message || 'Failed to load job history', 'error');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openSnapshotModal = async (employee) => {
    setSelected(employee);
    setShowSnapshot(true);
    setSnapshot(null);
    setSnapshotLoading(true);
    try {
      const data = await hrGetEmployeeSnapshot(employee.employeeID);
      setSnapshot(data || null);
    } catch (error) {
      toast(error.message || 'Failed to load employee 360 view', 'error');
      setSnapshot(null);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleCreate = async () => {
    const payload = normalizePayload();
    if (!payload.fullName || !payload.email) {
      toast('Full name and email are required', 'error');
      return;
    }

    setSaving(true);
    try {
      await hrCreateEmployeeRecord(payload);
      toast('Employee record created');
      setShowCreate(false);
      resetForm();
      await loadEmployees();
    } catch (error) {
      toast(error.message || 'Failed to create employee', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const payload = normalizePayload();
    if (!selected?.employeeID) return;
    if (!payload.fullName || !payload.email) {
      toast('Full name and email are required', 'error');
      return;
    }

    setSaving(true);
    try {
      await hrUpdateEmployeeRecord(selected.employeeID, payload);
      toast('Employee record updated');
      setShowEdit(false);
      resetForm();
      await loadEmployees();
    } catch (error) {
      toast(error.message || 'Failed to update employee', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!selected?.employeeID) return;

    setSaving(true);
    try {
      await hrChangeEmployeeRole(selected.employeeID, {
        ...roleChange,
        monthlyIncome: roleChange.monthlyIncome === '' ? null : Number(roleChange.monthlyIncome),
      });
      toast(`${roleChange.action} saved and logged`);
      setShowRoleChange(false);
      await loadEmployees();
      if (selected) {
        await openHistoryModal({ ...selected, ...roleChange, monthlyIncome: roleChange.monthlyIncome });
      }
    } catch (error) {
      toast(error.message || 'Failed to save promotion / demotion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (employee) => {
    if (!window.confirm(`Archive ${employee.fullName}?`)) return;
    try {
      await hrDeleteEmployeeRecord(employee.employeeID);
      toast('Employee archived');
      await loadEmployees();
    } catch (error) {
      toast(error.message || 'Failed to archive employee', 'error');
    }
  };

  const handleExportEmployees = () => {
    const rows = [
      ['Employee ID', 'Full Name', 'Email', 'Job Title', 'Department', 'Team', 'Role', 'Type', 'Location', 'Status', 'Monthly Income', 'Attrition Risk'],
      ...filteredEmployees.map((employee) => [
        employee.employeeID || '',
        employee.fullName || '',
        employee.email || '',
        employee.jobTitle || '',
        employee.department || '',
        employee.team || '',
        employee.role || '',
        employee.employeeType || '',
        employee.location || '',
        employee.employmentStatus || '',
        employee.monthlyIncome ?? '',
        employeeRisks[employee.employeeID]?.riskLevel || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadTextFile(`employees-directory-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(t('Employee directory exported.'));
  };

  const handleExportRosterHealth = () => {
    const rows = [
      ['Employee', 'Department', 'Status', 'Priority', 'Risk Level', 'Flags', 'Recommended Action'],
      ...(rosterHealth?.followUpItems || []).map((item) => [
        item.employeeName || '',
        item.department || '',
        item.employmentStatus || '',
        item.priority || '',
        item.riskLevel || '',
        (item.flags || []).join(' | '),
        item.recommendedAction || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadTextFile(`roster-health-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(t('Roster health exported.'));
  };

  const statusColor = (status) => {
    if (status === 'Active') return 'green';
    if (status === 'On Leave') return 'orange';
    if (status === 'Probation') return 'accent';
    return 'gray';
  };

  const FormFields = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label={t('Full Name *')} value={form.fullName} onChange={setField('fullName')} placeholder="e.g. Salma Mostafa" />
        <Input label={t('Email *')} type="email" value={form.email} onChange={setField('email')} placeholder="employee@company.com" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label={t('Job Title')} value={form.jobTitle} onChange={setField('jobTitle')} placeholder="e.g. HR Specialist" />
        <Input label={t('Department')} value={form.department} onChange={setField('department')} placeholder="e.g. Human Resources" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label={t('Team')} value={form.team} onChange={setField('team')} placeholder="e.g. Talent Operations" />
        <Input label={t('Location')} value={form.location} onChange={setField('location')} placeholder="e.g. Cairo" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Role')}</label>
          <select value={form.role} onChange={setField('role')} style={selectStyle}>
            {ROLE_OPTIONS.map(option => <option key={option} value={option}>{t(`role.${option}`)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Employee Type')}</label>
          <select value={form.employeeType} onChange={setField('employeeType')} style={selectStyle}>
            {TYPE_OPTIONS.map(option => <option key={option} value={option}>{t(option)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Status')}</label>
          <select value={form.employmentStatus} onChange={setField('employmentStatus')} style={selectStyle}>
            {STATUS_OPTIONS.map(option => <option key={option} value={option}>{t(option)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label={t('Years at Company')} type="number" min="0" value={form.yearsAtCompany} onChange={setField('yearsAtCompany')} placeholder="0" />
        <Input label={t('Monthly Income')} type="number" min="0" value={form.monthlyIncome} onChange={setField('monthlyIncome')} placeholder="0" />
      </div>
    </div>
  );

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.employees.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {t('page.employees.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="outline" onClick={handleExportEmployees}>{t('Export CSV')}</Btn>
          <Btn variant="ghost" onClick={() => setFilters({ search: '', department: '', role: '', type: '', location: '' })}>{t('Clear Filters')}</Btn>
          <Btn onClick={() => { resetForm(); setShowCreate(true); }}>
            <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('Add Employee')}
          </Btn>
        </div>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>
              {t(isAdminView ? 'Admin Control Center' : 'HR Operations')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {t(isAdminView
                ? 'Oversee users, access coverage, and operational readiness across the platform.'
                : 'People operations, compliance, and service delivery.')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/dashboard'))}>{t('nav.dashboard')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/reviews'))}>{t('nav.reviews')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('nav.approvals')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/forms'))}>{t('nav.forms')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Departments'), value: departments.length, color: '#2563EB' },
            { label: t('Role Coverage'), value: roles.length, color: '#7C3AED' },
            { label: t('Needs Follow-up'), value: rosterSummary.followUpCount ?? followUpCount, color: '#F59E0B' },
            { label: t('profile completeness'), value: `${dataQuality.coveragePct}%`, color: dataQuality.coveragePct >= 80 ? '#16A34A' : '#E8321A' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hr-stats-grid" style={{ marginBottom: 22 }}>
        {[
          { label: 'Total Employees', value: employees.length },
          { label: 'Active Employees', value: activeCount, color: '#22C55E' },
          { label: 'Departments', value: departments.length },
          { label: 'Needs Follow-up', value: rosterSummary.followUpCount ?? followUpCount, color: '#F59E0B' },
          { label: 'Incomplete Profiles', value: rosterSummary.incompleteProfiles ?? 0, color: '#E8321A' },
          { label: 'Logged Promotions', value: promotionCount },
        ].map(card => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: card.color || 'var(--gray-900)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 22 }}>
        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Audit Readiness')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-900)' }}>{dataQuality.coveragePct}%</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('profile completeness')}</div>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${dataQuality.coveragePct}%`, height: '100%', background: dataQuality.coveragePct >= 80 ? '#16A34A' : '#E8321A', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Salary mapped')}</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{dataQuality.salaryMapped}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Location mapped')}</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{dataQuality.locationMapped}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Department mapped')}</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{dataQuality.departmentMapped}</div>
            </div>
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Trust & Follow-up Signals')}</div>
          <div style={{ display: 'grid', gap: 10, fontSize: 13.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Probation cases')}</span><strong>{dataQuality.probationCount}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('On leave')}</span><strong>{dataQuality.onLeaveCount}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Attrition follow-up')}</span><strong>{followUpCount}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Visible in current view')}</span><strong>{filteredEmployees.length}/{employees.length}</strong></div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color="green" label={`${t('History & 360')} ${t('enabled')}`} />
            <Badge color="accent" label={`${t('Export')} CSV`} />
          </div>
        </div>
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 22 }}>
        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)' }}>{t('Roster Health Watch')}</div>
            <Btn size="sm" variant="ghost" onClick={handleExportRosterHealth}>{t('Export Roster CSV')}</Btn>
          </div>
          {(rosterHealth?.followUpItems || []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority roster follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {(rosterHealth?.followUpItems || []).map((item) => (
                <div key={item.employeeID} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #E7EAEE', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                    <Badge label={t(item.priority)} color={item.priority === 'High' ? 'red' : item.priority === 'Medium' ? 'orange' : 'gray'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.department || '—'} • {item.jobTitle || '—'} • {t(item.employmentStatus || 'Unknown')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {(item.flags || []).map((flag) => <Badge key={`${item.employeeID}-${flag}`} label={t(flag)} color="accent" />)}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{t(item.recommendedAction)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Department Watch')}</div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 12, fontSize: 13.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Attrition follow-up')}</span><strong>{rosterSummary.attritionFollowUp ?? followUpCount}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Probation cases')}</span><strong>{rosterSummary.probationCases ?? dataQuality.probationCount}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Recent movements')}</span><strong>{rosterSummary.recentMovements ?? promotionCount}</strong></div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(rosterHealth?.departmentBreakdown || []).slice(0, 5).map((item) => (
              <div key={item.department} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                <span style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{item.department}</span>
                <strong style={{ fontSize: 12.5 }}>{item.followUpCount} • {t('High')}: {item.highPriorityCount}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 22 }}>
        <div className="hr-filter-grid">
          <Input label={t('Search')} value={filters.search} onChange={(event) => setFilters(prev => ({ ...prev, search: event.target.value }))} placeholder="Name, email, title..." style={{ marginBottom: 0 }} />

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Department')}</label>
            <select value={filters.department} onChange={(event) => setFilters(prev => ({ ...prev, department: event.target.value }))} style={selectStyle}>
              <option value="">{t('All')}</option>
              {departments.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Role')}</label>
            <select value={filters.role} onChange={(event) => setFilters(prev => ({ ...prev, role: event.target.value }))} style={selectStyle}>
              <option value="">{t('All')}</option>
              {[...new Set([...ROLE_OPTIONS, ...roles])].map(option => <option key={option} value={option}>{t(`role.${option}`)}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Type')}</label>
            <select value={filters.type} onChange={(event) => setFilters(prev => ({ ...prev, type: event.target.value }))} style={selectStyle}>
              <option value="">{t('All')}</option>
              {TYPE_OPTIONS.map(option => <option key={option} value={option}>{t(option)}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Location')}</label>
            <select value={filters.location} onChange={(event) => setFilters(prev => ({ ...prev, location: event.target.value }))} style={selectStyle}>
              <option value="">{t('All')}</option>
              {locations.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : filteredEmployees.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '70px 32px' }}>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 6 }}>{t('No employee records match the current filters.')}</p>
          <p style={{ fontSize: 12, color: 'var(--gray-300)' }}>{t('Create a new record or clear the filters to continue.')}</p>
        </div>
      ) : (
        <div className="hr-table-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['Employee', 'Role', 'Department', 'Type', 'Location', 'Status', ''].map((heading) => (
                  <th key={heading} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>
                    {t(heading)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const employeeRisk = employeeRisks[employee.employeeID];
                return (
                <tr key={employee.employeeID} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{employee.fullName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{employee.email}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 2 }}>{employee.employeeID}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{employee.jobTitle || '—'}</div>
                    <div style={{ marginTop: 6 }}><Badge label={employee.role ? t(`role.${employee.role}`) : t('Unassigned')} color="accent" /></div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{employee.department || '—'}</td>
                  <td style={{ padding: '16px 20px' }}><Badge label={employee.employeeType ? t(employee.employeeType) : '—'} color="gray" /></td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{employee.location || '—'}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                      <Badge label={employee.employmentStatus ? t(employee.employmentStatus) : t('Unknown')} color={statusColor(employee.employmentStatus)} />
                      {employeeRisk && (
                        <Badge label={`${t('Attrition Risk')}: ${t(employeeRisk.riskLevel)}`} color={riskColor(employeeRisk.riskLevel)} />
                      )}
                      <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{t('Salary')}: {formatMoney(employee.monthlyIncome)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Btn size="sm" variant="outline" onClick={() => openSnapshotModal(employee)}>{t('360 View')}</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(employee)}>{t('Edit')}</Btn>
                      <Btn size="sm" variant="accent" onClick={() => openRoleChangeModal(employee)}>{t('Promote / Demote')}</Btn>
                      <Btn size="sm" variant="outline" onClick={() => openHistoryModal(employee)}>{t('History')}</Btn>
                      <Btn size="sm" variant="danger" onClick={() => handleArchive(employee)}>{t('Archive')}</Btn>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title={t('Add Employee Record')} maxWidth={720}>
        <FormFields />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => { setShowCreate(false); resetForm(); }} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleCreate} style={{ flex: 1 }} disabled={saving}>{saving ? t('Saving...') : t('Create Employee')}</Btn>
        </div>
      </Modal>

      <Modal open={showEdit} onClose={() => { setShowEdit(false); resetForm(); }} title={t('Edit Employee Record')} maxWidth={720}>
        <FormFields />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => { setShowEdit(false); resetForm(); }} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleUpdate} style={{ flex: 1 }} disabled={saving}>{saving ? t('Saving...') : t('Save Changes')}</Btn>
        </div>
      </Modal>

      <Modal open={showRoleChange} onClose={() => setShowRoleChange(false)} title={`${t('Promote / Demote')} — ${selected?.fullName || ''}`} maxWidth={760}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Change Type')}</label>
            <select value={roleChange.action} onChange={setRoleChangeField('action')} style={selectStyle}>
              {ACTION_OPTIONS.map(option => <option key={option} value={option}>{t(option)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('New Role')}</label>
            <select value={roleChange.role} onChange={setRoleChangeField('role')} style={selectStyle}>
              {ROLE_OPTIONS.map(option => <option key={option} value={option}>{t(`role.${option}`)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={t('New Job Title')} value={roleChange.jobTitle} onChange={setRoleChangeField('jobTitle')} placeholder="e.g. Senior HR Specialist" />
          <Input label={t('New Monthly Income')} type="number" min="0" value={roleChange.monthlyIncome} onChange={setRoleChangeField('monthlyIncome')} placeholder="e.g. 18000" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Department" value={roleChange.department} onChange={setRoleChangeField('department')} placeholder="Department" />
          <Input label="Team" value={roleChange.team} onChange={setRoleChangeField('team')} placeholder="Team" />
        </div>

        <Textarea label={t('Notes')} value={roleChange.notes} onChange={setRoleChangeField('notes')} placeholder={t('Reason for promotion / demotion')} />

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowRoleChange(false)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleRoleChange} style={{ flex: 1 }} disabled={saving}>{saving ? t('Saving...') : t('Save & Log Change')}</Btn>
        </div>
      </Modal>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={`${t('Job History')} — ${selected?.fullName || ''}`} maxWidth={760}>
        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
        ) : historyItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--gray-500)' }}>
            {t('No promotion or demotion history has been logged yet.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {historyItems.map((item) => (
              <div key={item.historyID} style={{ background: 'var(--gray-50)', borderRadius: 16, padding: '16px 18px', border: '1px solid #EAECF0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge label={t(item.action)} color={item.action === 'Promotion' ? 'green' : item.action === 'Demotion' ? 'orange' : 'accent'} />
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{new Date(item.changedAt).toLocaleString()}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('By')} {item.changedBy || t('HR Manager')}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--gray-700)', lineHeight: 1.6 }}>
                  <div><strong>Title:</strong> {item.previousJobTitle || '—'} → {item.newJobTitle || '—'}</div>
                  <div><strong>Role:</strong> {item.previousRole || '—'} → {item.newRole || '—'}</div>
                  <div><strong>Department:</strong> {item.previousDepartment || '—'} → {item.newDepartment || '—'}</div>
                  <div><strong>Team:</strong> {item.previousTeam || '—'} → {item.newTeam || '—'}</div>
                  <div><strong>Salary:</strong> {formatMoney(item.previousMonthlyIncome)} → {formatMoney(item.newMonthlyIncome)}</div>
                </div>
                {item.notes && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--gray-600)' }}>
                    <strong>Notes:</strong> {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={showSnapshot}
        onClose={() => { setShowSnapshot(false); setSnapshot(null); }}
        title={`${t('Employee 360 View')} — ${selected?.fullName || ''}`}
        maxWidth={1080}
      >
        {snapshotLoading ? (
          <div style={{ textAlign: 'center', padding: 50 }}><Spinner /></div>
        ) : !snapshot ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--gray-500)' }}>
            {t('No employee snapshot available right now.')}
          </div>
        ) : (
          <>
            <div className="hr-surface-card" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{snapshot.employee.fullName}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                    {snapshot.employee.jobTitle || '—'} • {snapshot.employee.department || '—'} • {snapshot.employee.team || '—'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                    {snapshot.employee.email} • {snapshot.employee.employeeID}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <Badge label={snapshot.employee.employmentStatus ? t(snapshot.employee.employmentStatus) : t('Unknown')} color={statusColor(snapshot.employee.employmentStatus)} />
                  <Badge label={snapshot.attrition?.riskLevel ? `${t('Attrition Risk')}: ${t(snapshot.attrition.riskLevel)}` : t('Prediction pending')} color={riskColor(snapshot.attrition?.riskLevel)} />
                </div>
              </div>
            </div>

            <div className="hr-stats-grid" style={{ marginBottom: 18 }}>
              {[
                { label: 'Years at Company', value: snapshot.employee.yearsAtCompany ?? '—' },
                { label: 'Average Rating', value: snapshot.summary?.averageReviewRating ?? 0, color: '#7C3AED' },
                { label: 'Attendance Completion', value: `${snapshot.summary?.attendanceRate ?? 0}%`, color: '#2563EB' },
                { label: 'Latest Payroll', value: formatMoney(snapshot.summary?.latestNetPay ?? 0), color: '#10B981' },
              ].map((card) => (
                <div key={card.label} className="hr-stat-card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.color || 'var(--gray-900)' }}>{card.value}</div>
                </div>
              ))}
            </div>

            <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 18 }}>
              <div className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Work Snapshot')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><strong>{snapshot.summary?.activeGoals ?? 0}</strong><div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Active Goals')}</div></div>
                  <div><strong>{snapshot.summary?.openTasks ?? 0}</strong><div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Open Tasks')}</div></div>
                  <div><strong>{snapshot.summary?.assignedTraining ?? 0}</strong><div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Assigned Training')}</div></div>
                  <div><strong>{snapshot.summary?.completedTraining ?? 0}</strong><div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Completed Training')}</div></div>
                </div>
              </div>

              <div className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('AI Retention Outlook')}</div>
                {snapshot.attrition ? (
                  <>
                    <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--gray-700)', lineHeight: 1.6 }}>{t(snapshot.attrition.explanationSummary || '')}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {(snapshot.attrition.riskDrivers || []).slice(0, 3).map((driver, index) => (
                        <Badge key={`${driver.title}-${index}`} label={t(driver.title)} color={riskColor(driver.severity === 'high' ? 'High' : driver.severity === 'medium' ? 'Medium' : 'Low')} />
                      ))}
                    </div>
                    <ul style={{ margin: 0, paddingInlineStart: 18, display: 'grid', gap: 6, fontSize: 13, color: 'var(--gray-700)' }}>
                      {(snapshot.attrition.recommendedActions || []).slice(0, 3).map((action, index) => <li key={`${action}-${index}`}>{t(action)}</li>)}
                    </ul>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--gray-500)' }}>{t('No attrition prediction has been run for this employee yet.')}</p>
                )}
              </div>
            </div>

            <div className="hr-panel-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 18 }}>
              <div className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('People Operations')}</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 13.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Pending Leave')}</span><strong>{snapshot.summary?.pendingLeave ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Open Tickets')}</span><strong>{snapshot.summary?.openTickets ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Pending Documents')}</span><strong>{snapshot.summary?.pendingDocuments ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Pending Expenses')}</span><strong>{snapshot.summary?.pendingExpenses ?? 0}</strong></div>
                </div>
              </div>

              <div className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Recent Goals')}</div>
                {(snapshot.goals || []).length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {snapshot.goals.slice(0, 3).map((goal) => (
                      <div key={goal.goalID} style={{ paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{goal.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(goal.status || 'In Progress')} • {goal.progress ?? 0}%</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No recent goals found.')}</div>}
              </div>

              <div className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Recent Tasks')}</div>
                {(snapshot.tasks || []).length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {snapshot.tasks.slice(0, 3).map((task) => (
                      <div key={task.taskID} style={{ paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{task.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(task.status || 'To Do')} • {task.progress ?? 0}%</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No recent tasks found.')}</div>}
              </div>
            </div>

            <div className="hr-panel-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 18 }}>
              <div className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Recent Reviews')}</div>
                {(snapshot.reviews || []).length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {snapshot.reviews.slice(0, 3).map((review) => (
                      <div key={review.reviewID} style={{ paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{review.reviewPeriod}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(review.status || 'Submitted')} • {review.overallRating}/5</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No recent reviews found.')}</div>}
              </div>

              <div className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('Payroll Snapshot')}</div>
                {(snapshot.payroll || []).length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {snapshot.payroll.slice(0, 3).map((record) => (
                      <div key={record.payrollID} style={{ paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{record.payPeriod}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{formatMoney(record.netPay)} • {t(record.status || 'Draft')}</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No payroll records found yet.')}</div>}
              </div>
            </div>

            <div className="hr-surface-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>{t('History Timeline')}</div>
              {(snapshot.history || []).length ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {snapshot.history.slice(0, 4).map((item) => (
                    <div key={item.historyID} style={{ paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <strong>{t(item.action)}</strong>
                        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{formatDateTime(item.changedAt)}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginTop: 4 }}>{item.previousJobTitle || '—'} → {item.newJobTitle || '—'}</div>
                      {item.notes ? <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.notes}</div> : null}
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No history entries logged yet.')}</div>}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
