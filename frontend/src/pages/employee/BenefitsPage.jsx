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

export function EmployeeBenefitsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--gray-50)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Coverage')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{item.coverageLevel || '—'}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--gray-50)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Monthly Cost')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>${Number(item.monthlyCost || 0).toFixed(2)}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--gray-50)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4 }}>{t('Your Contribution')}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>${Number(item.employeeContribution || 0).toFixed(2)}</div>
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
