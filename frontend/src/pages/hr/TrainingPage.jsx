import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreateTraining, hrGetTraining, hrGetTrainingCompliance } from '../../api/index.js';
import { Badge, Btn, DatalistInput, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  title: '',
  description: '',
  category: 'Technical',
  durationHours: 1,
  assignedEmployeeIDs: [],
  dueDate: '',
};

const EMPTY_COMPLIANCE = {
  summary: {},
  categoryBreakdown: [],
  followUpItems: [],
};

export function HRTrainingPage() {
  const toast = useToast();
  const { t } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [courses, setCourses] = useState([]);
  const [compliance, setCompliance] = useState(EMPTY_COMPLIANCE);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const [data, complianceData] = await Promise.all([
        hrGetTraining(),
        hrGetTrainingCompliance().catch(() => null),
      ]);
      setCourses(Array.isArray(data) ? data : []);
      setCompliance(complianceData && typeof complianceData === 'object' ? complianceData : EMPTY_COMPLIANCE);
    } catch (error) {
      toast(error.message || 'Failed to load training courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const stats = useMemo(() => ({
    total: compliance?.summary?.trackedCourses ?? courses.length,
    assigned: courses.reduce((sum, course) => sum + Number(course.assignedCount || 0), 0),
    completed: compliance?.summary?.completedCourses ?? courses.reduce((sum, course) => sum + Number(course.completedCount || 0), 0),
    dueSoon: compliance?.summary?.dueSoonCourses ?? 0,
    overdue: compliance?.summary?.overdueCourses ?? 0,
  }), [compliance, courses]);

  const courseTitles = useMemo(() => [...new Set(courses.map((course) => course.title).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [courses]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast('Course title is required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const employeeIDs = Array.isArray(form.assignedEmployeeIDs)
        ? form.assignedEmployeeIDs.filter(Boolean)
        : String(form.assignedEmployeeIDs || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

      await hrCreateTraining({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        durationHours: Number(form.durationHours || 1),
        assignedEmployeeIDs: employeeIDs,
        dueDate: form.dueDate || null,
      });
      toast('Training course created');
      setForm(INITIAL_FORM);
      await loadCourses();
    } catch (error) {
      toast(error.message || 'Failed to create training course', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCompliance = () => {
    const items = compliance?.followUpItems || [];
    if (!items.length) {
      toast('No training compliance follow-up items to export.', 'error');
      return;
    }

    const rows = [
      ['Course', 'Category', 'Due State', 'Due Date', 'Pending Employees', 'Completion Rate', 'Recommended Action'],
      ...items.map((item) => ([
        item.title,
        item.category,
        item.dueState,
        item.dueDate || '',
        item.pendingEmployees,
        `${item.completionRate}%`,
        item.recommendedAction,
      ])),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `training-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Training compliance report exported');
  };

  const getStatusColor = (status) => (status === 'Completed' ? 'green' : status === 'In Progress' ? 'orange' : 'gray');
  const getDueStateColor = (dueState) => (dueState === 'Overdue' ? 'red' : dueState === 'Due Soon' ? 'orange' : dueState === 'On Track' ? 'green' : 'gray');

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.training.title')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('page.training.subtitle')}
        </p>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 24 }}>
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/policies'))}>{t('nav.policies')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/reviews'))}>{t('nav.reviews')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/employees'))}>{t('nav.employees')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Courses'), value: stats.total, color: '#111827' },
            { label: t('Assignments'), value: stats.assigned, color: '#2563EB' },
            { label: t('Due Soon'), value: stats.dueSoon, color: '#F59E0B' },
            { label: t('Overdue'), value: stats.overdue, color: '#E8321A' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Courses', value: stats.total, accent: '#111827' },
          { label: 'Assignments', value: stats.assigned, accent: '#2563EB' },
          { label: 'Completed', value: stats.completed, accent: '#10B981' },
          { label: 'Due Soon', value: stats.dueSoon, accent: '#F59E0B' },
          { label: 'Overdue', value: stats.overdue, accent: '#E8321A' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Compliance Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>{t('Monitor overdue and due-soon learning to keep mandatory training on track.')}</div>
            </div>
            <Btn size="sm" variant="ghost" onClick={handleExportCompliance}>{t('Export Compliance CSV')}</Btn>
          </div>

          {(compliance?.followUpItems || []).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No training compliance follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {(compliance?.followUpItems || []).map((item) => (
                <div key={item.courseID} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #E7EAEE', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
                    <Badge color={getDueStateColor(item.dueState)} label={t(item.dueState)} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{t(item.category)} • {t('Pending')}: {item.pendingEmployees} • {t('Completion')}: {item.completionRate}%</div>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Due Date')}: {item.dueDate || '—'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: item.employees?.length ? 8 : 0 }}>{t(item.recommendedAction)}</div>
                  {(item.employees || []).length > 0 ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {item.employees.map((employee) => (
                        <span key={`${item.courseID}-${employee.employeeID}`} style={{ fontSize: 11.5, padding: '4px 8px', borderRadius: 999, background: '#F8FAFC', border: '1px solid #E7EAEE', color: 'var(--gray-600)' }}>
                          {employee.employeeName} • {t(employee.status)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Category Breakdown')}</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {(compliance?.categoryBreakdown || []).map((item) => (
              <div key={item.category} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                <span style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{t(item.category)}</span>
                <strong style={{ fontSize: 12.5 }}>{item.courses} • {t('Overdue')}: {item.overdue} • {t('Due Soon')}: {item.dueSoon}</strong>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Snapshot')}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { label: 'At-Risk Assignments', value: compliance?.summary?.atRiskAssignments ?? 0 },
              { label: 'Average Completion Rate', value: `${compliance?.summary?.averageCompletionRate ?? 0}%` },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid #E7EAEE' }}>
                <span style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{t(item.label)}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Training Course')}</h3>
          <DatalistInput label={t('Course Title')} value={form.title} options={courseTitles} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('Select or type a course title')} />
          <Textarea label={t('Description')} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('Describe the learning objective')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Category')}</label>
              <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Technical', 'Compliance', 'Leadership', 'Soft Skills'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <Input label={t('Duration (hours)')} type="number" min="1" value={form.durationHours} onChange={(e) => setForm((prev) => ({ ...prev, durationHours: e.target.value }))} />
          </div>

          <EmployeeSelect
            label={t('Assigned Employees')}
            value={form.assignedEmployeeIDs}
            onChange={(value) => setForm((prev) => ({ ...prev, assignedEmployeeIDs: value }))}
            placeholder={t('Select employees')}
            multiple
            helperText={t('Hold Ctrl or Cmd to select more than one employee.')}
          />
          <Input label={t('Due Date')} type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Create Course')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Training Overview')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : courses.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No training courses created yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Course', 'Category', 'Assignments', 'Completed', 'Status', 'Due'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.courseID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{course.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{course.durationHours} {t('hour(s)')}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{t(course.category)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{course.assignedCount}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{course.completedCount}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(course.status)} color={getStatusColor(course.status)} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{course.dueDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
