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

const daysSinceRecognition = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const recognitionDate = new Date(value);
  if (Number.isNaN(recognitionDate.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  recognitionDate.setHours(0, 0, 0, 0);
  return Math.floor((today - recognitionDate) / (1000 * 60 * 60 * 24));
};

const getRecognitionAgeLabel = (value, t) => {
  const age = daysSinceRecognition(value);
  if (!Number.isFinite(age)) return t('No date recorded');
  if (age === 0) return t('Today');
  if (age === 1) return t('1 day ago');
  return `${age} ${t('days ago')}`;
};

const getMomentumTone = (award) => {
  const age = daysSinceRecognition(award?.recognitionDate);
  if (age >= 45) return 'red';
  if (age >= 20) return 'orange';
  return CATEGORY_COLORS[award?.category] || 'accent';
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

  const recentAwardsCount = awards.filter((item) => daysSinceRecognition(item.recognitionDate) <= 30).length;
  const spotlightPoints = awards.filter((item) => Number(item.points || 0) >= 20).length;
  const momentumGapCount = awards.length > 0 ? awards.filter((item) => daysSinceRecognition(item.recognitionDate) >= 45).length : 0;
  const topCategory = useMemo(() => {
    const grouped = awards.reduce((acc, award) => {
      const key = award.category || 'Appreciation';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const [category] = Object.entries(grouped).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
    return category || null;
  }, [awards]);

  const recognitionSpotlightQueue = useMemo(() => {
    return [...awards]
      .sort((a, b) => Number(b.points || 0) - Number(a.points || 0)
        || daysSinceRecognition(a.recognitionDate) - daysSinceRecognition(b.recognitionDate)
        || String(a.title || '').localeCompare(String(b.title || '')))
      .slice(0, 4);
  }, [awards]);

  const categoryPressureMap = useMemo(() => {
    const grouped = awards.reduce((acc, award) => {
      const key = award.category || 'Appreciation';
      if (!acc[key]) {
        acc[key] = { category: key, count: 0, points: 0, recentCount: 0 };
      }
      acc[key].count += 1;
      acc[key].points += Number(award.points || 0);
      if (daysSinceRecognition(award.recognitionDate) <= 30) acc[key].recentCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.points - a.points || b.count - a.count || a.category.localeCompare(b.category))
      .slice(0, 4);
  }, [awards]);

  const recognitionPlaybook = useMemo(() => {
    const plays = [];

    if (recentAwardsCount > 0) {
      plays.push({
        title: t('Reuse recent momentum'),
        note: t('Recent recognition is a strong signal to carry into reviews, check-ins, or growth discussions.'),
      });
    }
    if (spotlightPoints > 0) {
      plays.push({
        title: t('Highlight your biggest wins'),
        note: t('Higher-point awards are strong evidence for impact stories and performance conversations.'),
      });
    }
    if (topCategory) {
      plays.push({
        title: t('Lean into your strongest recognition theme'),
        note: t('Your most frequent recognition category can guide where to keep building visible strengths.'),
      });
    }
    if (momentumGapCount > 0) {
      plays.push({
        title: t('Refresh recognition visibility'),
        note: t('If recognition has gone quiet for a while, use recent work updates to keep impact visible.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Recognition is still building'),
      note: t('As new awards come in, this page will help you track patterns and momentum over time.'),
    }];
  }, [momentumGapCount, recentAwardsCount, spotlightPoints, t, topCategory]);

  const strongestSignal = awards.length === 0
    ? t('Recognition has not started yet, so the next awards will set the first momentum signal.')
    : recentAwardsCount > 0
      ? t('Recent recognition is giving you clear momentum, and those wins are worth carrying into future conversations.')
      : momentumGapCount > 0
        ? t('Recognition has been quiet for a while, so making current impact visible is the next best step.')
        : t('Your recognition history is steady, with a useful pattern of impact already visible.');

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Recognition')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('See your recent awards, appreciation notes, and recognition points from leaders.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
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

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Recognition Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Recent Awards'), value: recentAwardsCount, color: '#027A48', note: t('Recognition received in the last 30 days.') },
                { label: t('Spotlight Wins'), value: spotlightPoints, color: '#E8321A', note: t('Higher-point awards that stand out most strongly.') },
                { label: t('Recognition Gaps'), value: momentumGapCount, color: '#B54708', note: t('Awards that are now more distant in time.') },
                { label: t('Top Theme'), value: topCategory ? t(topCategory) : t('None'), color: '#175CD3', note: t('The most common recognition category in your history.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Recognition Spotlight Queue')}</h3>
            </div>
            {recognitionSpotlightQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Recognition highlights will appear here as awards come in.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {recognitionSpotlightQueue.map((award) => (
                  <div key={`queue-${award.awardID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{award.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t(award.category)} • {award.points || 0} {t('pts')} • {award.recognizedBy || t('Team Lead')}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>
                        {award.recognitionDate || '—'}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <Badge label={t(award.category)} color={getMomentumTone(award)} />
                      <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{getRecognitionAgeLabel(award.recognitionDate, t)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Recognition Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {recognitionPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Category Pressure')}</div>
            {categoryPressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No recognition category pattern is visible yet.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {categoryPressureMap.map((item) => (
                  <div key={item.category} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.category)}</div>
                      <Badge label={`${item.count} ${t('awards')}`} color={CATEGORY_COLORS[item.category] || 'gray'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Points')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.points}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Recent')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.recentCount}</div>
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
