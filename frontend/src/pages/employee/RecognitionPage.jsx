import { useEffect, useMemo, useState } from 'react';
import { getMyRecognition } from '../../api/index.js';
import { Badge, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const CATEGORY_COLORS = {
  Achievement: 'green',
  Appreciation: 'orange',
  Innovation: 'blue',
  Teamwork: 'gray',
  Leadership: 'red',
};

export function EmployeeRecognitionPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAwards = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyRecognition(user.employee_id);
      setAwards(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(error.message || 'Failed to load recognition awards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAwards();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    totalAwards: awards.length,
    totalPoints: awards.reduce((sum, item) => sum + Number(item.points || 0), 0),
    appreciation: awards.filter((item) => item.category === 'Appreciation').length,
  }), [awards]);

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Recognition')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('See your recent awards, appreciation notes, and recognition points from leaders.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Awards'), value: stats.totalAwards, accent: '#111827' },
          { label: t('Recognition Points'), value: stats.totalPoints, accent: '#E8321A' },
          { label: t('Appreciation Notes'), value: stats.appreciation, accent: '#F59E0B' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : awards.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No recognition yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('New awards from your manager will appear here.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {awards.map((award) => (
            <div key={award.awardID} className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{award.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {award.recognitionDate || '—'} • {award.recognizedBy || t('Team Lead')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge label={t(award.category)} color={CATEGORY_COLORS[award.category] || 'gray'} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>{award.points || 0} {t('pts')}</span>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--gray-700)', margin: 0 }}>{award.message || t('Recognition shared without an additional note.')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
