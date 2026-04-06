import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreateReview, hrGetReviewCalibration, hrGetReviews } from '../../api/index.js';
import { Badge, Btn, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  employeeID: '',
  reviewPeriod: '',
  reviewType: 'Quarterly',
  overallRating: 3,
  status: 'Submitted',
  strengths: '',
  improvementAreas: '',
  goalsSummary: '',
  reviewDate: '',
};

const STATUS_COLORS = {
  Draft: 'gray',
  Submitted: 'orange',
  Acknowledged: 'green',
};

export function HRReviewsPage() {
  const toast = useToast();
  const { t } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [reviews, setReviews] = useState([]);
  const [calibration, setCalibration] = useState({
    summary: {},
    ratingBreakdown: [],
    readinessBreakdown: [],
    followUpItems: [],
  });
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const [data, calibrationData] = await Promise.all([
        hrGetReviews(),
        hrGetReviewCalibration().catch(() => null),
      ]);
      setReviews(Array.isArray(data) ? data : []);
      setCalibration(calibrationData && typeof calibrationData === 'object'
        ? calibrationData
        : { summary: {}, ratingBreakdown: [], readinessBreakdown: [], followUpItems: [] });
    } catch (error) {
      toast(error.message || 'Failed to load performance reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const stats = useMemo(() => {
    const total = calibration?.summary?.totalReviews ?? reviews.length;
    const pendingAcknowledgements = calibration?.summary?.pendingAcknowledgements ?? reviews.filter((review) => review.status === 'Submitted').length;
    const acknowledged = calibration?.summary?.acknowledgedCount ?? reviews.filter((review) => review.status === 'Acknowledged').length;
    const calibrationAlerts = calibration?.summary?.calibrationAlerts ?? 0;
    const averageRating = reviews.length
      ? (reviews.reduce((sum, review) => sum + Number(review.overallRating || 0), 0) / reviews.length).toFixed(1)
      : '0.0';
    return { total, pendingAcknowledgements, acknowledged, calibrationAlerts, averageRating };
  }, [calibration, reviews]);

  const priorityTone = (priority) => {
    if (priority === 'Critical') return 'red';
    if (priority === 'High') return 'orange';
    if (priority === 'Opportunity') return 'green';
    return 'gray';
  };

  const handleCreate = async () => {
    if (!form.employeeID.trim() || !form.reviewPeriod.trim()) {
      toast('Employee ID and review period are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await hrCreateReview({
        employeeID: form.employeeID.trim(),
        reviewPeriod: form.reviewPeriod.trim(),
        reviewType: form.reviewType,
        overallRating: Number(form.overallRating || 3),
        status: form.status,
        strengths: form.strengths.trim(),
        improvementAreas: form.improvementAreas.trim(),
        goalsSummary: form.goalsSummary.trim(),
        reviewDate: form.reviewDate || null,
      });
      toast('Performance review created');
      setForm(INITIAL_FORM);
      await loadReviews();
    } catch (error) {
      toast(error.message || 'Failed to create performance review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCalibration = () => {
    const items = calibration?.followUpItems || [];
    if (!items.length) {
      toast('No calibration follow-up items to export.', 'error');
      return;
    }

    const rows = [
      ['Employee', 'Department', 'Review Period', 'Rating', 'Status', 'Priority', 'Retention Risk', 'Readiness', 'Recommended Action'],
      ...items.map((item) => ([
        item.employeeName,
        item.department || '',
        item.reviewPeriod,
        item.overallRating,
        item.status,
        item.priority,
        item.retentionRisk,
        item.readiness,
        item.recommendedAction,
      ])),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `review-calibration-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Review calibration report exported');
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.reviews.title')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('page.reviews.subtitle')}
        </p>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/employees'))}>{t('nav.employees')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('nav.approvals')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/forms'))}>{t('nav.forms')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Pending Acknowledgment'), value: stats.pendingAcknowledgements, accent: '#F59E0B' },
            { label: t('Calibration Alerts'), value: stats.calibrationAlerts, accent: '#E8321A' },
            { label: t('Avg. Rating'), value: stats.averageRating, accent: '#10B981' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.accent }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Reviews', value: stats.total, accent: '#111827' },
          { label: 'Pending Acknowledgment', value: stats.pendingAcknowledgements, accent: '#F59E0B' },
          { label: 'Calibration Alerts', value: stats.calibrationAlerts, accent: '#E8321A' },
          { label: 'Avg. Rating', value: stats.averageRating, accent: '#10B981' },
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
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Calibration Snapshot')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>{t('Highlight low-rated reviews, pending acknowledgements, and ready-now talent requiring HR follow-up.')}</div>
            </div>
            <Btn size="sm" variant="ghost" onClick={handleExportCalibration}>{t('Export Calibration CSV')}</Btn>
          </div>

          {(calibration?.followUpItems || []).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No calibration follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {(calibration?.followUpItems || []).map((item) => (
                <div key={`${item.reviewID}-${item.employeeID}`} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #E7EAEE', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                    <Badge color={priorityTone(item.priority)} label={t(item.priority)} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.reviewPeriod} • {t(item.status)} • {t('Rating')}: {item.overallRating}/5</div>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Retention Risk')}: {t(item.retentionRisk)} • {t('Readiness')}: {t(item.readiness)}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{t(item.recommendedAction)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Rating Distribution')}</div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            {(calibration?.ratingBreakdown || []).map((item) => (
              <div key={`rating-${item.rating}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
                  <span>{item.rating}/5</span>
                  <strong>{item.count}</strong>
                </div>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min((item.count / Math.max(stats.total || 1, 1)) * 100, 100)}%`, height: '100%', background: item.rating <= 2 ? '#E8321A' : item.rating >= 4 ? '#10B981' : '#F59E0B' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Succession Readiness')}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(calibration?.readinessBreakdown || []).map((item) => (
              <div key={item.readiness} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                <span style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{t(item.readiness)}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Review')}</h3>
          <Input label={t('Employee ID')} value={form.employeeID} onChange={(e) => setForm((prev) => ({ ...prev, employeeID: e.target.value }))} placeholder="EMP12345" />
          <Input label={t('Review Period')} value={form.reviewPeriod} onChange={(e) => setForm((prev) => ({ ...prev, reviewPeriod: e.target.value }))} placeholder="Q2 2026" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Review Type')}</label>
              <select value={form.reviewType} onChange={(e) => setForm((prev) => ({ ...prev, reviewType: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Quarterly', 'Annual', 'Probation', 'Spot'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <Input label={t('Overall Rating')} type="number" min="1" max="5" value={form.overallRating} onChange={(e) => setForm((prev) => ({ ...prev, overallRating: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Draft', 'Submitted'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <Input label={t('Review Date')} type="date" value={form.reviewDate} onChange={(e) => setForm((prev) => ({ ...prev, reviewDate: e.target.value }))} />
          </div>

          <Textarea label={t('Strengths')} value={form.strengths} onChange={(e) => setForm((prev) => ({ ...prev, strengths: e.target.value }))} placeholder={t("Highlight the employee's strongest contributions")} />
          <Textarea label={t('Improvement Areas')} value={form.improvementAreas} onChange={(e) => setForm((prev) => ({ ...prev, improvementAreas: e.target.value }))} placeholder={t('Areas to coach or develop next')} />
          <Textarea label={t('Goals Summary')} value={form.goalsSummary} onChange={(e) => setForm((prev) => ({ ...prev, goalsSummary: e.target.value }))} placeholder={t('Tie the review back to goals and next actions')} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Create Review')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Review Overview')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : reviews.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No performance reviews created yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Period', 'Rating', 'Status', 'Date', 'Acknowledged'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.reviewID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{review.employeeName || review.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{review.department || '—'} • {review.team || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{review.reviewPeriod}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(review.reviewType)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{Number(review.overallRating || 0).toFixed(0)}/5</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(review.status)} color={STATUS_COLORS[review.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{review.reviewDate || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{review.acknowledgedAt ? t('Yes') : t('No')}</td>
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
