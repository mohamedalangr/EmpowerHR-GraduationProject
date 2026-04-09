import { useEffect, useMemo, useState } from 'react';
import { acknowledgeMyPolicy, getMyPolicies } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Draft: 'gray',
  Published: 'orange',
  Acknowledged: 'green',
};

const daysUntilDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
};

const getPolicyWindowLabel = (value, t) => {
  const days = daysUntilDate(value);
  if (!Number.isFinite(days)) return t('No effective date');
  if (days < 0) return `${Math.abs(days)} ${t('days active')}`;
  if (days === 0) return t('Effective today');
  if (days === 1) return t('Effective tomorrow');
  return `${days} ${t('days until effective')}`;
};

const getPolicyTone = (item) => {
  const days = daysUntilDate(item?.effectiveDate);
  if (item?.status === 'Acknowledged') return 'green';
  if (item?.status === 'Published' && days < 0) return 'red';
  if (item?.status === 'Published' && days <= 7) return 'orange';
  return STATUS_COLORS[item?.status] || 'gray';
};

export function EmployeePoliciesPage() {
  const toast = useToast();
  const { t } = useLanguage();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [notes, setNotes] = useState({});

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const data = await getMyPolicies();
      const list = Array.isArray(data) ? data : [];
      setPolicies(list);
      const nextNotes = {};
      list.forEach((item) => {
        nextNotes[item.policyID] = '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load policy feed', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const stats = useMemo(() => ({
    total: policies.length,
    published: policies.filter((item) => item.status === 'Published').length,
    acknowledged: policies.filter((item) => item.status === 'Acknowledged').length,
  }), [policies]);

  const dueSoonCount = policies.filter((item) => item.status === 'Published' && Number.isFinite(daysUntilDate(item.effectiveDate)) && daysUntilDate(item.effectiveDate) <= 7).length;
  const overdueAckCount = policies.filter((item) => item.status === 'Published' && Number.isFinite(daysUntilDate(item.effectiveDate)) && daysUntilDate(item.effectiveDate) < 0).length;
  const recentPolicyCount = policies.filter((item) => Number.isFinite(daysUntilDate(item.effectiveDate)) && Math.abs(daysUntilDate(item.effectiveDate)) <= 30).length;

  const policyFocusQueue = useMemo(() => {
    const statusRank = { Published: 3, Acknowledged: 2, Draft: 1 };
    return [...policies]
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || daysUntilDate(a.effectiveDate) - daysUntilDate(b.effectiveDate)
        || String(a.title || '').localeCompare(String(b.title || '')))
      .slice(0, 4);
  }, [policies]);

  const audiencePressureMap = useMemo(() => {
    const grouped = policies.reduce((acc, item) => {
      const key = item.audience || 'All Employees';
      if (!acc[key]) {
        acc[key] = { audience: key, count: 0, publishedCount: 0, acknowledgedCount: 0, dueSoonCount: 0 };
      }
      acc[key].count += 1;
      if (item.status === 'Published') acc[key].publishedCount += 1;
      if (item.status === 'Acknowledged') acc[key].acknowledgedCount += 1;
      if (item.status === 'Published' && Number.isFinite(daysUntilDate(item.effectiveDate)) && daysUntilDate(item.effectiveDate) <= 7) {
        acc[key].dueSoonCount += 1;
      }
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.publishedCount - a.publishedCount || b.dueSoonCount - a.dueSoonCount || b.count - a.count)
      .slice(0, 4);
  }, [policies]);

  const policyPlaybook = useMemo(() => {
    const plays = [];

    if (overdueAckCount > 0) {
      plays.push({
        title: t('Acknowledge overdue policies first'),
        note: t('Published policies that are already active deserve the fastest response because they often affect current work rules.'),
      });
    }
    if (dueSoonCount > 0) {
      plays.push({
        title: t('Review upcoming policy changes'),
        note: t('Policies becoming effective soon are the best place to check instructions and ask questions early.'),
      });
    }
    if (stats.published > 0) {
      plays.push({
        title: t('Keep acknowledgment notes clear'),
        note: t('Short notes help HR know you reviewed the announcement and any follow-up is understood.'),
      });
    }
    if (recentPolicyCount > 0) {
      plays.push({
        title: t('Stay current on recent updates'),
        note: t('Recently issued policies are easier to absorb when you review them in the same update cycle.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Policy flow looks stable'),
      note: t('Your policy feed looks steady right now, so keep reviewing updates as they are published.'),
    }];
  }, [dueSoonCount, overdueAckCount, recentPolicyCount, stats.published, t]);

  const strongestSignal = overdueAckCount > 0
    ? t('Some published policies are already active and still need acknowledgement, making compliance timing the clearest priority.')
    : dueSoonCount > 0
      ? t('A few policy items are nearing their effective date, so reviewing them now is the best next move.')
      : stats.published > 0
        ? t('There are open policy announcements waiting for acknowledgment, so steady follow-through remains the main focus.')
        : t('Your policy feed looks stable right now, with no major acknowledgement pressure standing out.');

  const handleAcknowledge = async (policyID) => {
    setSavingId(policyID);
    try {
      await acknowledgeMyPolicy(policyID, { note: notes[policyID] || '' });
      toast('Policy acknowledged');
      await loadPolicies();
    } catch (error) {
      toast(error.message || 'Failed to acknowledge policy', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Policy Feed')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Review policy updates and acknowledge that you have read each announcement.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Total Items'), value: stats.total, accent: '#111827' },
          { label: t('Published'), value: stats.published, accent: '#E8321A' },
          { label: t('Acknowledged'), value: stats.acknowledged, accent: '#10B981' },
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Policy Compliance Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Due Soon'), value: dueSoonCount, color: '#E8321A', note: t('Published policies with an effective date approaching in the next week.') },
                { label: t('Active Now'), value: overdueAckCount, color: '#DC2626', note: t('Already-effective policy items that still need acknowledgment.') },
                { label: t('Recent'), value: recentPolicyCount, color: '#175CD3', note: t('Policies issued or becoming effective in the current review window.') },
                { label: t('Acknowledged'), value: stats.acknowledged, color: '#027A48', note: t('Announcements you have already confirmed and closed out.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Acknowledgement Queue')}</h3>
            </div>
            {policyFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority policy items will appear here as announcements are published.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {policyFocusQueue.map((item) => (
                  <div key={`queue-${item.policyID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{t(item.category)} • {t(item.audience)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{getPolicyWindowLabel(item.effectiveDate, t)}</div>
                    </div>
                    <Badge label={t(item.status)} color={getPolicyTone(item)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Policy Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {policyPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Audience Pressure')}</div>
            {audiencePressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No audience pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {audiencePressureMap.map((item) => (
                  <div key={item.audience} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.audience)}</div>
                      <Badge label={`${item.count} ${t('policies')}`} color={item.publishedCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Published')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.publishedCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Due Soon')}</div>
                        <div style={{ fontWeight: 700, color: '#DC2626' }}>{item.dueSoonCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Acked')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.acknowledgedCount}</div>
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
      ) : policies.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No policies available')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR will publish announcements here.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {policies.map((item) => (
            <div key={item.policyID} className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {t(item.category)} • {t(item.audience)} • {t('Effective')} {item.effectiveDate || t('TBA')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={getPolicyWindowLabel(item.effectiveDate, t)} color={getPolicyTone(item)} />
                  <Badge label={t(item.status)} color={getPolicyTone(item)} />
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14 }}>{item.content}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                <Textarea
                  label={t('Acknowledgment Note')}
                  value={notes[item.policyID] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.policyID]: e.target.value }))}
                  placeholder={t('Optional note to HR')}
                />
                <Btn onClick={() => handleAcknowledge(item.policyID)} disabled={savingId === item.policyID}>
                  {savingId === item.policyID ? t('Saving...') : t('Acknowledge')}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
