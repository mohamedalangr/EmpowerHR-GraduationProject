import { useEffect, useMemo, useState } from 'react';
import { getMyBenefits, updateMyBenefitStatus } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Pending: 'orange',
  Enrolled: 'green',
  Waived: 'gray',
};

const daysUntilDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const getBenefitTone = (item) => {
  if (item?.status === 'Pending' && daysUntilDate(item?.effectiveDate) <= 14) return 'red';
  if (item?.status === 'Enrolled') return 'green';
  if (item?.status === 'Pending') return 'orange';
  return 'gray';
};

export function EmployeeBenefitsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, language } = useLanguage();
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [notes, setNotes] = useState({});

  const loadBenefits = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyBenefits(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setBenefits(list);
      const nextNotes = {};
      list.forEach((item) => {
        nextNotes[item.enrollmentID] = item.employeeNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load benefits', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenefits();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: benefits.length,
    enrolled: benefits.filter((item) => item.status === 'Enrolled').length,
    pending: benefits.filter((item) => item.status === 'Pending').length,
  }), [benefits]);

  const waivedCount = benefits.filter((item) => item.status === 'Waived').length;
  const upcomingEffectiveCount = benefits.filter((item) => daysUntilDate(item.effectiveDate) >= 0 && daysUntilDate(item.effectiveDate) <= 30).length;
  const highContributionCount = benefits.filter((item) => Number(item.employeeContribution || 0) >= 150).length;
  const decisionMomentum = stats.total ? Math.round((stats.enrolled / stats.total) * 100) : 0;

  const benefitsFocusQueue = useMemo(() => {
    const statusRank = { Pending: 3, Enrolled: 2, Waived: 1 };
    return [...benefits]
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || daysUntilDate(a.effectiveDate) - daysUntilDate(b.effectiveDate)
        || Number(b.employeeContribution || 0) - Number(a.employeeContribution || 0)
        || String(a.benefitName || '').localeCompare(String(b.benefitName || '')))
      .slice(0, 4);
  }, [benefits]);

  const benefitTypePressureMap = useMemo(() => {
    const grouped = benefits.reduce((acc, item) => {
      const key = item.benefitType || 'Other';
      if (!acc[key]) {
        acc[key] = { benefitType: key, count: 0, pendingCount: 0, contribution: 0 };
      }
      acc[key].count += 1;
      acc[key].contribution += Number(item.employeeContribution || 0);
      if (item.status === 'Pending') acc[key].pendingCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.pendingCount - a.pendingCount || b.count - a.count || b.contribution - a.contribution)
      .slice(0, 4);
  }, [benefits]);

  const benefitsPlaybook = useMemo(() => {
    const plays = [];

    if (stats.pending > 0) {
      plays.push({
        title: t('Resolve pending enrollments first'),
        note: t('Pending benefits are the clearest place to confirm your decisions and reduce enrollment drift.'),
      });
    }
    if (upcomingEffectiveCount > 0) {
      plays.push({
        title: t('Check plans starting soon'),
        note: t('Benefits with near-term effective dates deserve a quick review so coverage starts without surprises.'),
      });
    }
    if (highContributionCount > 0) {
      plays.push({
        title: t('Review higher-contribution options'),
        note: t('Plans with a larger employee contribution are worth an extra cost-benefit check before confirming.'),
      });
    }
    if (stats.enrolled > 0) {
      plays.push({
        title: t('Keep a record of confirmed coverage'),
        note: t('Your enrolled plans create a useful baseline for future benefit and cost discussions.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Benefits visibility will grow here'),
      note: t('As more plans are assigned, this page will highlight the strongest enrollment and coverage signals.'),
    }];
  }, [highContributionCount, stats.enrolled, stats.pending, t, upcomingEffectiveCount]);

  const strongestSignal = stats.pending > 0
    ? t('Some benefit decisions are still pending, so confirming those plans is the clearest next action.')
    : upcomingEffectiveCount > 0
      ? t('A few plans are starting soon, making timing and coverage review the most useful next check.')
      : highContributionCount > 0
        ? t('Some options carry higher employee contributions, so cost clarity matters most right now.')
        : t('Your benefits portfolio looks steady right now, with no major pressure signals standing out.');

  const handleStatusUpdate = async (enrollmentID, status) => {
    setSavingId(`${enrollmentID}-${status}`);
    try {
      await updateMyBenefitStatus(enrollmentID, { status, note: notes[enrollmentID] || '' });
      toast(`Benefit marked as ${status.toLowerCase()}`);
      await loadBenefits();
    } catch (error) {
      toast(error.message || 'Failed to update benefit status', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Benefits')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Review your available benefit plans, costs, and confirm your enrollment decision.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Benefit Plans'), value: stats.total, accent: '#111827' },
          { label: t('Enrolled'), value: stats.enrolled, accent: '#10B981' },
          { label: t('Pending Action'), value: stats.pending, accent: '#E8321A' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Benefits Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Pending'), value: stats.pending, color: '#E8321A', note: t('Benefit plans still waiting for your enrollment decision.') },
                { label: t('Starting Soon'), value: upcomingEffectiveCount, color: '#B54708', note: t('Plans with an effective date approaching in the next month.') },
                { label: t('High Contribution'), value: highContributionCount, color: '#175CD3', note: t('Options with a higher employee-cost share.') },
                { label: t('Momentum'), value: `${decisionMomentum}%`, color: '#027A48', note: t('Share of assigned plans that are already confirmed as enrolled.') },
              ].map((item) => (
                <div key={item.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 12px', background: '#fff' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 23, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid #FDE68A', background: '#FFFBEB', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#B45309', marginBottom: 6 }}>{t('Strongest signal')}</div>
              <div style={{ fontSize: 13.5, color: '#92400E' }}>{strongestSignal}</div>
            </div>
          </div>

          <div className="hr-table-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Benefits Focus Queue')}</h3>
            </div>
            {benefitsFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority benefit actions will appear here as plans are assigned.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {benefitsFocusQueue.map((item) => (
                  <div key={`queue-${item.enrollmentID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.benefitName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t(item.benefitType)} • {formatMoney(item.employeeContribution, language)} {t('employee share')}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{t('Effective')} {item.effectiveDate || t('TBA')}</div>
                    </div>
                    <Badge label={t(item.status)} color={getBenefitTone(item)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Benefits Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {benefitsPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Benefit Type Pressure')}</div>
            {benefitTypePressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No benefit-type pattern stands out yet.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {benefitTypePressureMap.map((item) => (
                  <div key={item.benefitType} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.benefitType)}</div>
                      <Badge label={`${item.count} ${t('plans')}`} color={item.pendingCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Pending')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.pendingCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Contribution')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{formatMoney(item.contribution, language)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : benefits.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No benefits assigned')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR will publish your enrollment options here.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {benefits.map((item) => (
            <div key={item.enrollmentID} className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{item.benefitName}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {t(item.benefitType)} • {item.provider || t('Provider TBD')} • {t('Effective')} {item.effectiveDate || t('TBA')}
                  </div>
                </div>
                <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--gray-50)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Coverage')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.coverageLevel || '—'}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--gray-50)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Monthly Cost')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(item.monthlyCost, language)}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--gray-50)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Your Contribution')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(item.employeeContribution, language)}</div>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 12 }}>{item.notes || t('No additional plan notes were provided.')}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                <Textarea
                  label={t('Enrollment Note')}
                  value={notes[item.enrollmentID] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.enrollmentID]: e.target.value }))}
                  placeholder={t('Optional note for HR')}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn variant="ghost" onClick={() => handleStatusUpdate(item.enrollmentID, 'Waived')} disabled={savingId === `${item.enrollmentID}-Waived`}>
                    {savingId === `${item.enrollmentID}-Waived` ? t('Saving...') : t('Waive')}
                  </Btn>
                  <Btn onClick={() => handleStatusUpdate(item.enrollmentID, 'Enrolled')} disabled={savingId === `${item.enrollmentID}-Enrolled`}>
                    {savingId === `${item.enrollmentID}-Enrolled` ? t('Saving...') : t('Enroll')}
                  </Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
