import { useEffect, useMemo, useState } from 'react';
import { acknowledgeMyPolicy, getMyPolicies } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Draft: 'gray',
  Published: 'orange',
  Acknowledged: 'green',
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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
                <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
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
