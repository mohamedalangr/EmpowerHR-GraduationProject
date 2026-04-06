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

const clampRating = (value) => Math.max(1, Math.min(5, Number(value || 0)));

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
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
