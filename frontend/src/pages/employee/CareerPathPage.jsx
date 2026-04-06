import { useEffect, useMemo, useState } from 'react';
import { acknowledgeCareerPlan, getMyCareerPath } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Active: 'orange',
  'On Track': 'blue',
  Acknowledged: 'green',
  Completed: 'green',
  'On Hold': 'red',
};

const RISK_COLORS = {
  Low: 'green',
  Medium: 'orange',
  High: 'red',
};

export function EmployeeCareerPathPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [notes, setNotes] = useState({});

  const loadPlans = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyCareerPath(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setPlans(list);
      const nextNotes = {};
      list.forEach((plan) => {
        nextNotes[plan.planID] = plan.employeeNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load career path plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: plans.length,
    readySoon: plans.filter((plan) => ['Ready Now', '6-12 Months'].includes(plan.readiness)).length,
    acknowledged: plans.filter((plan) => plan.status === 'Acknowledged').length,
  }), [plans]);

  const handleAcknowledge = async (planID) => {
    setSavingId(planID);
    try {
      await acknowledgeCareerPlan(planID, { note: notes[planID] || '' });
      toast('Career path acknowledged');
      await loadPlans();
    } catch (error) {
      toast(error.message || 'Failed to acknowledge career path', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Career Path')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Review your growth plan, readiness level, and next development steps shared by HR.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Career Plans'), value: stats.total, accent: '#111827' },
          { label: t('Ready Soon'), value: stats.readySoon, accent: '#E8321A' },
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
      ) : plans.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No career path plans yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR can add succession and growth plans from the Succession page.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {plans.map((plan) => (
            <div key={plan.planID} className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{plan.targetRole}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {t('Readiness')}: {t(plan.readiness)} • {t('Shared by')} {plan.createdBy || t('HR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge label={t(plan.status)} color={STATUS_COLORS[plan.status] || 'gray'} />
                  <Badge label={`${t('Risk')}: ${t(plan.retentionRisk)}`} color={RISK_COLORS[plan.retentionRisk] || 'gray'} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Development Actions')}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--gray-700)' }}>{plan.developmentActions || t('No development actions added yet.')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('HR Notes')}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--gray-700)' }}>{plan.notes || t('No notes shared yet.')}</div>
                </div>
              </div>

              <Textarea
                label={t('Employee Note')}
                value={notes[plan.planID] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [plan.planID]: e.target.value }))}
                placeholder={t('Add a short acknowledgment or growth note')}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                  {plan.acknowledgedAt ? `${t('Acknowledged')} ${new Date(plan.acknowledgedAt).toLocaleString()}` : t('Awaiting employee acknowledgment')}
                </div>
                <Btn
                  onClick={() => handleAcknowledge(plan.planID)}
                  disabled={savingId === plan.planID || plan.status === 'Acknowledged'}
                >
                  {plan.status === 'Acknowledged' ? t('Acknowledged') : savingId === plan.planID ? t('Saving...') : t('Acknowledge')}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
