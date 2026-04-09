import { useEffect, useMemo, useState } from 'react';
import { acknowledgeMyReview, getMyReviews } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Draft: 'gray',
  Submitted: 'orange',
  Acknowledged: 'green',
};

const clampRating = (value) => Math.max(0, Math.min(5, Number(value || 0)));

const daysSinceReview = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const reviewDate = new Date(value);
  if (Number.isNaN(reviewDate.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reviewDate.setHours(0, 0, 0, 0);
  return Math.floor((today - reviewDate) / (1000 * 60 * 60 * 24));
};

const getReviewTone = (review) => {
  const age = daysSinceReview(review?.reviewDate);
  if (review?.status === 'Acknowledged') return 'green';
  if (review?.status === 'Submitted' && age > 30) return 'red';
  if (review?.status === 'Submitted') return 'orange';
  return 'gray';
};

const getReviewAgeLabel = (value, t) => {
  const age = daysSinceReview(value);
  if (!Number.isFinite(age)) return t('No review date');
  if (age === 0) return t('Today');
  if (age === 1) return t('1 day ago');
  return `${age} ${t('days ago')}`;
};

export function EmployeeReviewsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [notes, setNotes] = useState({});

  const loadReviews = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyReviews(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setReviews(list);
      const nextNotes = {};
      list.forEach((review) => {
        nextNotes[review.reviewID] = review.employeeNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load performance reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: reviews.length,
    pending: reviews.filter((review) => review.status !== 'Acknowledged').length,
    acknowledged: reviews.filter((review) => review.status === 'Acknowledged').length,
  }), [reviews]);

  const averageRating = stats.total
    ? (reviews.reduce((sum, review) => sum + clampRating(review.overallRating), 0) / stats.total).toFixed(1)
    : '—';
  const highRatingCount = reviews.filter((review) => clampRating(review.overallRating) >= 4).length;
  const developmentFocusCount = reviews.filter((review) => String(review.improvementAreas || '').trim()).length;
  const recentReviewCount = reviews.filter((review) => daysSinceReview(review.reviewDate) <= 120).length;

  const reviewFocusQueue = useMemo(() => {
    const statusRank = { Submitted: 3, Draft: 2, Acknowledged: 1 };
    return [...reviews]
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || daysSinceReview(a.reviewDate) - daysSinceReview(b.reviewDate)
        || clampRating(a.overallRating) - clampRating(b.overallRating))
      .slice(0, 4);
  }, [reviews]);

  const reviewTypePressureMap = useMemo(() => {
    const grouped = reviews.reduce((acc, review) => {
      const key = review.reviewType || 'General';
      if (!acc[key]) {
        acc[key] = { type: key, count: 0, pendingCount: 0, ratingTotal: 0 };
      }
      acc[key].count += 1;
      acc[key].ratingTotal += clampRating(review.overallRating);
      if (review.status !== 'Acknowledged') acc[key].pendingCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        averageRating: item.count ? (item.ratingTotal / item.count).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.pendingCount - a.pendingCount || b.count - a.count || Number(b.averageRating) - Number(a.averageRating))
      .slice(0, 4);
  }, [reviews]);

  const reviewPlaybook = useMemo(() => {
    const plays = [];

    if (stats.pending > 0) {
      plays.push({
        title: t('Acknowledge fresh feedback quickly'),
        note: t('Closing the loop on pending reviews keeps performance discussions current and visible.'),
      });
    }
    if (highRatingCount > 0) {
      plays.push({
        title: t('Carry strong feedback into goals'),
        note: t('High ratings and positive themes are useful evidence for your next goal or growth conversation.'),
      });
    }
    if (developmentFocusCount > 0) {
      plays.push({
        title: t('Turn improvement areas into one action'),
        note: t('Pick one development note and convert it into a concrete habit, course, or goal update.'),
      });
    }
    if (recentReviewCount === 0 && stats.total > 0) {
      plays.push({
        title: t('Reconnect with the last review cycle'),
        note: t('If the latest review is older, revisit its notes and use them to refresh your current priorities.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Your review rhythm looks healthy'),
      note: t('Keep using completed reviews as a guide for your next growth steps.'),
    }];
  }, [developmentFocusCount, highRatingCount, recentReviewCount, stats.pending, stats.total, t]);

  const strongestSignal = stats.pending > 0
    ? t('One or more reviews still need acknowledgment, so closing that loop is the clearest next action.')
    : developmentFocusCount > 0
      ? t('Your review history already points to development themes, making small follow-through actions especially valuable now.')
      : highRatingCount > 0
        ? t('Strong ratings are giving you solid proof of impact, which is useful to carry into future goals and check-ins.')
        : t('Your review history looks steady right now, with no major pressure signals standing out.');

  const handleAcknowledge = async (reviewID) => {
    setSavingId(reviewID);
    try {
      await acknowledgeMyReview(reviewID, { note: notes[reviewID] || '' });
      toast('Review acknowledged');
      await loadReviews();
    } catch (error) {
      toast(error.message || 'Failed to acknowledge review', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Performance Reviews')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('View your review history, read manager feedback, and acknowledge completed reviews.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Total Reviews'), value: stats.total, accent: '#111827' },
          { label: t('Pending Acknowledgment'), value: stats.pending, accent: '#F59E0B' },
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Review Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Pending'), value: stats.pending, color: '#E8321A', note: t('Reviews still waiting for acknowledgment or final closeout.') },
                { label: t('High Ratings'), value: highRatingCount, color: '#027A48', note: t('Reviews with stronger overall performance scores.') },
                { label: t('Avg Score'), value: averageRating === '—' ? averageRating : `${averageRating}/5`, color: '#175CD3', note: t('Average rating across your available review history.') },
                { label: t('Recent Reviews'), value: recentReviewCount, color: '#B54708', note: t('Reviews recorded within the latest review cycle.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Review Queue')}</h3>
            </div>
            {reviewFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Review follow-up items will appear here as cycles are published.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {reviewFocusQueue.map((review) => (
                  <div key={`queue-${review.reviewID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{review.reviewPeriod}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t(review.reviewType || 'General')} • {t('Rating')} {clampRating(review.overallRating)}/5
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{t('Review date:')} {review.reviewDate || '—'}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <Badge label={t(review.status)} color={getReviewTone(review)} />
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>{getReviewAgeLabel(review.reviewDate, t)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Review Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {reviewPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Review Type Pressure')}</div>
            {reviewTypePressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No review type pattern stands out yet.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {reviewTypePressureMap.map((item) => (
                  <div key={item.type} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.type)}</div>
                      <Badge label={`${item.count} ${t('reviews')}`} color={item.pendingCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Pending')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.pendingCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Avg Rating')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.averageRating}/5</div>
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
      ) : reviews.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No performance reviews yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR can publish reviews from the Reviews page.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {reviews.map((review) => {
            const rating = clampRating(review.overallRating);
            return (
              <div key={review.reviewID} className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{review.reviewPeriod}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {t(review.reviewType)} • {t('Review date:')} {review.reviewDate || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</div>
                    <Badge label={t(review.status)} color={STATUS_COLORS[review.status] || 'gray'} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Strengths')}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--gray-700)' }}>{review.strengths || t('No strengths summary added.')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Improvement Areas')}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--gray-700)' }}>{review.improvementAreas || t('No improvement areas added.')}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Goals Summary')}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--gray-700)' }}>{review.goalsSummary || t('No goal summary provided.')}</div>
                </div>

                <Textarea
                  label={t('Employee Note')}
                  value={notes[review.reviewID] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [review.reviewID]: e.target.value }))}
                  placeholder={t('Add a short acknowledgment note')}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                    Shared by {review.createdBy || 'HR'}
                    {review.acknowledgedAt ? ` • Acknowledged at ${new Date(review.acknowledgedAt).toLocaleString()}` : ''}
                  </div>
                  <Btn
                    onClick={() => handleAcknowledge(review.reviewID)}
                    disabled={savingId === review.reviewID || review.status === 'Acknowledged'}
                  >
                    {review.status === 'Acknowledged'
                      ? t('Acknowledged')
                      : savingId === review.reviewID
                        ? t('Saving...')
                        : t('Acknowledge')}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
