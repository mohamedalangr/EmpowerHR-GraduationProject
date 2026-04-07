import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, Modal, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { getJobs, hrGetJobPipelineHealth, createJob, updateJob } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const downloadTextFile = (filename, content, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export function HRJobPostingsPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';

  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [pipelineHealth, setPipelineHealth] = useState(null);

  const empty = { title: '', description: '', min_experience_years: 0, required_degree: 'Bachelor',
                  weight_skills: 0.40, weight_experience: 0.30, weight_education: 0.10, weight_semantic: 0.20 };
  const [form, setForm] = useState(empty);

  const DEGREES = ['Unknown', 'High School', 'Associate', 'Bachelor', 'Master', 'PhD'];

  const load = async () => {
    setLoading(true);
    try {
      const [jobData, healthData] = await Promise.all([
        getJobs(),
        hrGetJobPipelineHealth().catch(() => null),
      ]);
      setJobs(Array.isArray(jobData) ? jobData : []);
      setPipelineHealth(healthData || null);
    } catch {
      toast('Failed to load job postings', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const weightsValid = () => {
    const total = +form.weight_skills + +form.weight_experience + +form.weight_education + +form.weight_semantic;
    return Math.abs(total - 1.0) < 0.001;
  };

  const handleCreate = async () => {
    if (!form.title.trim())       { toast('Title is required', 'error'); return; }
    if (!form.description.trim()) { toast('Description is required', 'error'); return; }
    if (!weightsValid())          { toast('Weights must sum to 1.0', 'error'); return; }
    setSaving(true);
    try {
      const res = await createJob(form);
      if (res.id) { toast('Job posting created'); setShowCreate(false); setForm(empty); load(); }
      else toast(res.detail ?? 'Failed to create job', 'error');
    } catch { toast('Failed to create job', 'error'); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!form.title.trim())       { toast('Title is required', 'error'); return; }
    if (!form.description.trim()) { toast('Description is required', 'error'); return; }
    if (!weightsValid())          { toast('Weights must sum to 1.0', 'error'); return; }
    setSaving(true);
    try {
      const res = await updateJob(selected.id, form);
      if (res.id) { toast('Job updated'); setShowEdit(false); load(); }
      else toast(res.detail ?? 'Failed to update job', 'error');
    } catch { toast('Failed to update job', 'error'); }
    setSaving(false);
  };

  const handleToggleActive = async (job) => {
    try {
      await updateJob(job.id, {
        title: job.title,
        description: job.description,
        min_experience_years: job.min_experience_years,
        required_degree: job.required_degree,
        weight_skills: job.weight_skills,
        weight_experience: job.weight_experience,
        weight_education: job.weight_education,
        weight_semantic: job.weight_semantic,
        is_active: !job.is_active,
      });
      toast(job.is_active ? 'Job deactivated' : 'Job activated');
      load();
    } catch { toast('Failed to update job', 'error'); }
  };

  const handleCopyPublicLink = async (job) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const publicUrl = `${baseUrl}/careers?job=${job.id}`;

    try {
      await navigator.clipboard.writeText(publicUrl);
      toast('Public application link copied');
    } catch {
      toast(publicUrl, 'success');
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: '#fff',
    border: '1.5px solid #E7EAEE', borderRadius: 12, fontSize: 13.5,
    outline: 'none', fontFamily: 'var(--sans)', color: 'var(--gray-900)',
    boxShadow: '0 1px 2px rgba(17,19,24,.03)',
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: 'var(--gray-700)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
  };

  const pipelineTotals = pipelineHealth?.totals || {};
  const funnelSummary = pipelineHealth?.funnelSummary || {};
  const followUpItems = pipelineHealth?.followUpItems || [];
  const jobBreakdown = pipelineHealth?.jobBreakdown || [];

  const statusColor = (state) => {
    if (state === 'Overdue') return 'red';
    if (state === 'At Risk') return 'orange';
    if (state === 'Paused') return 'gray';
    return 'green';
  };

  const formatDateLabel = (value) => {
    if (!value) return t('No recent activity');
    try {
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium' }).format(new Date(value));
    } catch {
      return '—';
    }
  };

  const handleExportPipelineHealth = () => {
    try {
      const dateLabel = new Date().toISOString().slice(0, 10);
      const rows = [
        ['Section', 'Label', 'Value', 'Extra'],
        ['Totals', 'Active Jobs', pipelineTotals.activeJobs ?? 0, ''],
        ['Totals', 'Total Candidates', pipelineTotals.totalCandidates ?? 0, ''],
        ['Totals', 'Stale Candidates', pipelineTotals.staleCandidates ?? 0, ''],
        ['Totals', 'Jobs Without Applicants', pipelineTotals.jobsWithoutApplicants ?? 0, ''],
        ['Totals', 'Talent Pool Candidates', pipelineTotals.talentPoolCandidates ?? 0, ''],
        [],
        ['Funnel', 'Applied', funnelSummary.appliedCount ?? 0, ''],
        ['Funnel', 'Shortlisted', funnelSummary.shortlistedCount ?? 0, ''],
        ['Funnel', 'Interview', funnelSummary.interviewCount ?? 0, ''],
        ['Funnel', 'Hired', funnelSummary.hiredCount ?? 0, ''],
        ['Funnel', 'Rejected', funnelSummary.rejectedCount ?? 0, ''],
      ];

      if (jobBreakdown.length) {
        rows.push([]);
        rows.push(['Jobs', 'Title', 'Applicants', 'Status / Metrics']);
        jobBreakdown.forEach((item) => {
          rows.push([
            'Jobs',
            item.jobTitle,
            item.applicantCount ?? 0,
            `${item.followUpState} | ${item.inReviewCount ?? 0} in review | ${item.interviewCount ?? 0} interviews | avg ATS ${item.averageAtsScore ?? 0}`,
          ]);
        });
      }

      if (followUpItems.length) {
        rows.push([]);
        rows.push(['Follow-Up', 'Candidate / Role', 'Waiting Days', 'Summary']);
        followUpItems.forEach((item) => {
          rows.push([
            item.type || 'Follow-Up',
            item.candidateName || item.jobTitle || '—',
            item.waitingDays ?? 0,
            `${item.jobTitle || ''} | ${item.reviewStage || ''} | ${item.slaState || ''} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`recruitment-pipeline-${dateLabel}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Recruitment snapshot exported.'));
    } catch {
      toast(t('Failed to export recruitment snapshot.'), 'error');
    }
  };

  const jobPulseCards = useMemo(() => ([
    {
      label: t('Open Roles'),
      value: pipelineTotals.activeJobs ?? jobs.filter((job) => job.is_active).length,
      note: t('Positions currently live and accepting applications.'),
      accent: '#22C55E',
    },
    {
      label: t('Applicants in Funnel'),
      value: pipelineTotals.totalCandidates ?? jobs.reduce((sum, job) => sum + (job.submission_count || 0), 0),
      note: t('Candidates moving through sourcing, review, and interview steps.'),
      accent: '#2563EB',
    },
    {
      label: t('Talent Pool'),
      value: pipelineTotals.talentPoolCandidates ?? 0,
      note: t('Promising profiles saved for current or future openings.'),
      accent: '#7C3AED',
    },
    {
      label: t('Sourcing Gaps'),
      value: pipelineTotals.jobsWithoutApplicants ?? 0,
      note: t('Roles that may need stronger outreach or refreshed visibility.'),
      accent: '#E8321A',
    },
  ]), [jobs, pipelineTotals.activeJobs, pipelineTotals.jobsWithoutApplicants, pipelineTotals.talentPoolCandidates, pipelineTotals.totalCandidates, t]);

  const WeightInput = ({ label, fieldKey }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" step="0.05" min="0" max="1" style={inputStyle} {...field(fieldKey)} />
    </div>
  );

  const FormFields = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Job Title *</label>
        <input style={inputStyle} placeholder="e.g. Senior Backend Engineer" {...field('title')} />
      </div>
      <div>
        <label style={labelStyle}>Job Description *</label>
        <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
          placeholder="Full job description — skills, responsibilities, requirements..." {...field('description')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Min. Experience (years)</label>
          <input type="number" min="0" step="0.5" style={inputStyle} {...field('min_experience_years')} />
        </div>
        <div>
          <label style={labelStyle}>Required Degree</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} {...field('required_degree')}>
            {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {/* Weights */}
      <div>
        <label style={{ ...labelStyle, marginBottom: 10 }}>Scoring Weights (must sum to 1.0)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <WeightInput label="Skills"      fieldKey="weight_skills" />
          <WeightInput label="Experience"  fieldKey="weight_experience" />
          <WeightInput label="Education"   fieldKey="weight_education" />
          <WeightInput label="Semantic"    fieldKey="weight_semantic" />
        </div>
        <div style={{ fontSize: 12, color: weightsValid() ? '#22C55E' : 'var(--red)', marginTop: 6, fontWeight: 600 }}>
          Total: {(+form.weight_skills + +form.weight_experience + +form.weight_education + +form.weight_semantic).toFixed(2)}
          {weightsValid() ? ' ✓' : ' — must equal 1.0'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="hr-page-shell">

      {/* Header */}
      <div className="hr-page-header is-split">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.jobs.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>{t('page.jobs.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="outline" onClick={handleExportPipelineHealth}>{t('Export Pipeline CSV')}</Btn>
          <Btn onClick={() => { setForm(empty); setShowCreate(true); }}>
            <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('New Job Posting')}
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/cv-ranking'))}>{t('nav.cvRanking')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/submissions'))}>{t('nav.submissions')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/forms'))}>{t('nav.forms')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Total Postings'), value: jobs.length, color: 'var(--gray-900)' },
            { label: t('Active'), value: pipelineTotals.activeJobs ?? jobs.filter((j) => j.is_active).length, color: '#22C55E' },
            { label: t('Total Applicants'), value: pipelineTotals.totalCandidates ?? jobs.reduce((a, j) => a + (j.submission_count || 0), 0), color: '#2563EB' },
            { label: t('Needs Follow-Up'), value: pipelineTotals.staleCandidates ?? 0, color: '#E8321A' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 22 }}>
        {jobPulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="hr-stats-grid" style={{ marginBottom: 28 }}>
        {[
          { label: 'Total Postings', value: jobs.length, sub: `${pipelineTotals.activeJobs ?? jobs.filter(j => j.is_active).length} ${t('active roles')}` },
          { label: 'Total Applicants', value: pipelineTotals.totalCandidates ?? jobs.reduce((a, j) => a + (j.submission_count || 0), 0), sub: `${pipelineTotals.talentPoolCandidates ?? 0} ${t('in talent pool')}` },
          { label: 'Needs Follow-Up', value: pipelineTotals.staleCandidates ?? 0, color: '#E8321A', sub: `${pipelineTotals.jobsWithoutApplicants ?? 0} ${t('roles need sourcing')}` },
          { label: 'Active', value: pipelineTotals.activeJobs ?? jobs.filter(j => j.is_active).length, color: '#22C55E', sub: `${pipelineTotals.jobsWithoutApplicants ?? 0} ${t('without applicants')}` },
        ].map((s) => (
          <div key={s.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(s.label)}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color ?? 'var(--gray-900)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {pipelineHealth ? (
        <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.15fr .85fr', marginBottom: 28 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Hiring Funnel')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
                {[
                  { label: 'Applied', value: funnelSummary.appliedCount ?? 0, bg: '#EFF6FF', color: '#2563EB' },
                  { label: 'Shortlisted', value: funnelSummary.shortlistedCount ?? 0, bg: '#F5F3FF', color: '#7C3AED' },
                  { label: 'Interview', value: funnelSummary.interviewCount ?? 0, bg: '#FFF7ED', color: '#C2410C' },
                  { label: 'Hired', value: funnelSummary.hiredCount ?? 0, bg: '#ECFDF3', color: '#027A48' },
                  { label: 'Rejected', value: funnelSummary.rejectedCount ?? 0, bg: '#FFF1F3', color: '#BE123C' },
                ].map((stage) => (
                  <div key={stage.label} style={{ borderRadius: 14, padding: '14px 12px', background: stage.bg }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: stage.color }}>{t(stage.label)}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: stage.color, marginTop: 6 }}>{stage.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hr-table-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Role Health Watch')}</h3>
              </div>
              {jobBreakdown.length === 0 ? (
                <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No recruitment pipeline activity yet.')}</div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {jobBreakdown.slice(0, 6).map((item) => (
                    <div key={item.jobID} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.jobTitle}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                          {item.applicantCount ?? 0} {t('applicants')} · {item.inReviewCount ?? 0} {t('in review')} · {item.interviewCount ?? 0} {t('interviews')}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>
                          {t('Avg ATS')}: {item.averageAtsScore ?? 0} · {formatDateLabel(item.lastActivityAt)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                        <Badge label={t(item.followUpState)} color={statusColor(item.followUpState)} />
                        <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{item.staleCandidates ?? 0} {t('stale')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Recruitment Follow-Up')}</div>
            {followUpItems.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '28px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No urgent hiring follow-up items right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {followUpItems.map((item) => (
                  <div key={item.id} className="workspace-action-card">
                    <div className="workspace-action-eyebrow">{t('Recruiting follow-up')}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.candidateName || item.jobTitle}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.jobTitle} · {t(item.reviewStage)}</div>
                      </div>
                      <Badge label={t(item.slaState)} color={statusColor(item.slaState)} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-700)', marginTop: 10 }}>{item.summary}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.waitingDays ?? 0} {t('days waiting')}</span>
                      <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath(item.path || '/hr/jobs'))}>{t('Open')}</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Jobs list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : jobs.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '80px 32px' }}>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 4 }}>{t('No job postings yet')}</p>
          <p style={{ fontSize: 12, color: 'var(--gray-300)' }}>{t('Create your first posting to start receiving applications')}</p>
        </div>
      ) : (
        <div className="hr-table-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['Title', 'Min. Exp', 'Degree', 'Applicants', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{job.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 2, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.description}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{job.min_experience_years}+ {t('yrs')}</td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{job.required_degree}</td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5, fontWeight: 600 }}>{job.submission_count ?? 0}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <Badge label={job.is_active ? t('Active') : t('Inactive')} color={job.is_active ? 'green' : 'gray'} />
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn size="sm" variant={job.is_active ? 'ghost' : 'primary'}
                        onClick={() => handleToggleActive(job)}>
                        {job.is_active ? t('Deactivate') : t('Activate')}
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => handleCopyPublicLink(job)}>
                        {t('Public Link')}
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => {
                        setSelected(job);
                        setForm({
                          title: job.title, description: job.description,
                          min_experience_years: job.min_experience_years,
                          required_degree: job.required_degree,
                          weight_skills: job.weight_skills, weight_experience: job.weight_experience,
                          weight_education: job.weight_education, weight_semantic: job.weight_semantic,
                        });
                        setShowEdit(true);
                      }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('Create Job Posting')} maxWidth={600}>
        <FormFields />
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleCreate} style={{ flex: 1 }} disabled={saving}>{saving ? t('Creating...') : t('Create Posting')}</Btn>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={t('Edit Job Posting')} maxWidth={600}>
        <FormFields />
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setShowEdit(false)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleUpdate} style={{ flex: 1 }} disabled={saving}>{saving ? t('Saving...') : t('Save Changes')}</Btn>
        </div>
      </Modal>

    </div>
  );
}
