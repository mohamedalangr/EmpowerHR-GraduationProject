import { Fragment, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrGetForms, hrGetSubmissionInsights, hrGetSubmissions } from '../../api/index.js';
import { Spinner, Badge, Btn } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const downloadTextFile = (filename, content, mimeType = 'text/csv;charset=utf-8') => {
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

const EMPTY_INSIGHTS = { summary: {}, questionInsights: [], followUpItems: [] };

export function HRSubmissionPage() {
  const { t } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [forms, setForms]             = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [insights, setInsights]       = useState(EMPTY_INSIGHTS);
  const [selectedForm, setSelected]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState(null);
  const [searchTerm, setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    hrGetForms()
      .then((data) => {
        if (cancelled) return;
        const f = Array.isArray(data) ? data : [];
        setForms(f);

        if (f.length > 0) {
          setSelected(f[0].formID);
        } else {
          setSelected('');
          setSubmissions([]);
          setInsights(EMPTY_INSIGHTS);
          setLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setForms([]);
        setSelected('');
        setSubmissions([]);
        setInsights(EMPTY_INSIGHTS);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedForm) {
      if (forms.length === 0) setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      hrGetSubmissions(selectedForm),
      hrGetSubmissionInsights(selectedForm).catch(() => EMPTY_INSIGHTS),
    ])
      .then(([data, insightData]) => {
        if (cancelled) return;
        setSubmissions(Array.isArray(data) ? data : []);
        setInsights(insightData && typeof insightData === 'object' ? insightData : EMPTY_INSIGHTS);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSubmissions([]);
        setInsights(EMPTY_INSIGHTS);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedForm, forms.length]);

  const filteredSubmissions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return submissions.filter((submission) => {
      const matchesStatus = statusFilter === 'all' || (submission.status || '').toLowerCase() === statusFilter;
      const matchesSearch = !search || [submission.employeeName, submission.employeeID]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [searchTerm, statusFilter, submissions]);

  const completed = insights?.summary?.completedSubmissions ?? submissions.filter((s) => s.status === 'Completed').length;
  const pending = insights?.summary?.pendingSubmissions ?? submissions.filter((s) => s.status === 'Pending').length;
  const completionRate = insights?.summary?.completionRate ?? (submissions.length ? Math.round((completed / submissions.length) * 100) : 0);
  const avgAnswers = submissions.length
    ? Math.round(submissions.reduce((sum, item) => sum + (item.answers?.length || 0), 0) / submissions.length)
    : 0;
  const lastSubmitted = submissions.find((item) => item.submittedAt)?.submittedAt || null;
  const averageScore = insights?.summary?.averageScore ?? 0;
  const highPriorityItems = insights?.summary?.highPriorityItems ?? 0;
  const selectedFormLabel = forms.find((form) => String(form.formID) === String(selectedForm))?.title || t('No form selected');
  const submissionPulseCards = useMemo(() => ([
    {
      label: t('Selected Form'),
      value: selectedFormLabel,
      note: t('The current submission stream being reviewed by HR or Admin.'),
      accent: '#111827',
    },
    {
      label: t('Completion Rate'),
      value: `${completionRate}%`,
      note: t('How many employees have completed this form so far.'),
      accent: '#7C3AED',
    },
    {
      label: t('Average Answers'),
      value: avgAnswers,
      note: t('Typical answer depth visible in the current response set.'),
      accent: '#2563EB',
    },
    {
      label: t('Priority Flags'),
      value: highPriorityItems,
      note: t('Signals that may need HR follow-up or closer review.'),
      accent: '#F59E0B',
    },
  ]), [avgAnswers, completionRate, highPriorityItems, selectedFormLabel, t]);

  const handleExport = () => {
    const rows = [
      ['Employee', 'Employee ID', 'Status', 'Submitted At', 'Answer Count'],
      ...filteredSubmissions.map((submission) => [
        submission.employeeName || '',
        submission.employeeID || '',
        submission.status || '',
        submission.submittedAt || '',
        submission.answers?.length || 0,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const formLabel = forms.find((form) => String(form.formID) === String(selectedForm))?.title || 'submissions';
    downloadTextFile(`${formLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-submissions.csv`, csv);
  };

  const handleExportInsights = () => {
    const rows = [
      ['Question', 'Type', 'Response Rate', 'Average Score', 'Yes Rate'],
      ...(insights?.questionInsights || []).map((item) => [
        item.questionText || '',
        item.fieldType || '',
        `${item.responseRate ?? 0}%`,
        item.averageScore ?? '',
        item.yesRate ?? '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const formLabel = forms.find((form) => String(form.formID) === String(selectedForm))?.title || 'submission-insights';
    downloadTextFile(`${formLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-insights.csv`, csv);
  };

  return (
    <div className="hr-page-shell">
      {/* Header */}
      <div className="hr-page-header is-split">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.submissions.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>{t('page.submissions.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={selectedForm} onChange={e => setSelected(e.target.value)} style={{
            padding: '10px 16px', borderRadius: 12, border: '1px solid #E7EAEE',
            fontSize: 13, fontWeight: 600, background: '#fff',
            color: 'var(--gray-700)', outline: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(17,19,24,.03)',
          }}>
            {forms.map(f => <option key={f.formID} value={f.formID}>{f.title}</option>)}
          </select>
          <Btn variant="outline" onClick={handleExport} disabled={filteredSubmissions.length === 0}>{t('Export CSV')}</Btn>
        </div>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 20 }}>
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/forms'))}>{t('nav.forms')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/jobs'))}>{t('nav.jobs')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/reviews'))}>{t('nav.reviews')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Total'), value: insights?.summary?.totalSubmissions ?? submissions.length, color: 'var(--gray-900)' },
            { label: t('Pending'), value: pending, color: '#E8321A' },
            { label: t('Completion Rate'), value: `${completionRate}%`, color: '#7C3AED' },
            { label: t('Priority Flags'), value: highPriorityItems, color: '#F59E0B' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 20 }}>
        {submissionPulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="hr-stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total', value: insights?.summary?.totalSubmissions ?? submissions.length, color: 'var(--gray-900)' },
          { label: 'Completed', value: completed, color: '#22C55E' },
          { label: 'Pending', value: pending, color: 'var(--red)' },
          { label: 'Completion Rate', value: `${completionRate}%`, color: '#7C3AED' },
          { label: 'Avg Score', value: averageScore ? `${averageScore}/4` : '—', color: '#2563EB' },
          { label: 'Priority Flags', value: highPriorityItems, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(s.label)}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Executive Snapshot')}</div>
          <div style={{ display: 'grid', gap: 10, fontSize: 13.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Average answers per submission')}</span><strong>{avgAnswers}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Latest response')}</span><strong>{lastSubmitted ? new Date(lastSubmitted).toLocaleString() : '—'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Visible rows')}</span><strong>{filteredSubmissions.length}</strong></div>
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Reporting Filters')}</div>
            <Btn size="sm" variant="ghost" onClick={handleExportInsights}>{t('Export Insights CSV')}</Btn>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 10 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('Search employee or ID')}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid #E7EAEE', outline: 'none' }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid #E7EAEE', outline: 'none', background: '#fff' }}
            >
              <option value="all">{t('All')}</option>
              <option value="completed">{t('Completed')}</option>
              <option value="pending">{t('Pending')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Question Insights')}</div>
          {(insights?.questionInsights || []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No question insight signals are available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {(insights?.questionInsights || []).slice(0, 5).map((item) => (
                <div key={item.questionID} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Question signal')}</div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{item.questionText}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)' }}>{t(item.fieldType)} • {t('Response Rate')}: {item.responseRate ?? 0}%</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 4 }}>
                    {item.averageScore !== undefined ? `${t('Average Score')}: ${item.averageScore || 0}/4` : item.yesRate !== undefined ? `${t('Yes Rate')}: ${item.yesRate || 0}%` : `${t('Responses')}: ${item.responseCount || 0}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Follow-up Priorities')}</div>
          {(insights?.followUpItems || []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No urgent feedback follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {(insights?.followUpItems || []).map((item) => (
                <div key={`${item.questionID}-${item.priority}`} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Priority follow-up')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13.5 }}>{item.questionText}</strong>
                    <Badge label={t(item.priority)} color={item.priority === 'High' ? 'red' : 'orange'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.issue} • {item.metric}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{item.recommendedAction}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : forms.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>{t('No feedback forms exist yet. Create a form first, then submissions will appear here.')}</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>{t('No submissions for this form yet.')}</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>{t('No submissions match the current reporting filter.')}</p>
        </div>
      ) : (
        <div className="hr-table-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['Employee', 'Status', 'Submitted At', 'Answers', ''].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map(sub => (
                <Fragment key={sub.submissionID}>
                  <tr style={{ borderBottom: expanded === sub.submissionID ? 'none' : '1px solid #F3F4F6' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.employeeName || sub.employeeID}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{sub.employeeID}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <Badge label={t(sub.status)} color={sub.status === 'Completed' ? 'green' : 'orange'} />
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--gray-500)' }}>
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13 }}>
                      {sub.answers?.length || 0} {t('answers')}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <Btn size="sm" variant="ghost" onClick={() => setExpanded(expanded === sub.submissionID ? null : sub.submissionID)}>
                        {expanded === sub.submissionID ? t('Hide') : t('View')}
                      </Btn>
                    </td>
                  </tr>
                  {expanded === sub.submissionID && (
                    <tr key={`${sub.submissionID}-expanded`}>
                      <td colSpan="5" style={{ padding: '0 20px 20px', background: 'var(--gray-50)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, paddingTop: 12 }}>
                          {sub.answers?.map((a) => {
                            const val = a.scoreValue ?? (a.booleanValue !== null ? (a.booleanValue ? t('Yes') : t('No')) : a.decimalValue);
                            return (
                              <div key={a.questionID} style={{ background: 'var(--white)', borderRadius: 12, padding: '12px 16px', border: '1px solid #EAECF0' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
                                  {a.fieldType ? t(a.fieldType) : t('Question')}
                                </div>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>
                                  {a.questionText || `Q: ${a.questionID?.slice(0, 8)}...`}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>{String(val)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
