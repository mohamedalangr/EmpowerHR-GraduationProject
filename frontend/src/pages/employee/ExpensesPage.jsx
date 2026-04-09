import { useEffect, useMemo, useState } from 'react';
import { getMyExpenses, submitExpenseClaim } from '../../api/index.js';
import { Badge, Btn, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  title: '',
  category: 'Travel',
  amount: '',
  expenseDate: '',
  description: '',
};

const STATUS_COLORS = {
  Submitted: 'orange',
  Approved: 'green',
  Rejected: 'red',
  Reimbursed: 'accent',
};

const formatMoney = (value, language = 'en') => {
  const number = Number(value || 0);
  const preferredCurrency = typeof document !== 'undefined'
    ? (document.documentElement.dataset.currencyPreference || 'EGP')
    : 'EGP';
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: preferredCurrency,
    minimumFractionDigits: 2,
  }).format(number);
};

const daysSinceDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today - date) / (1000 * 60 * 60 * 24));
};

const getExpenseTone = (item) => {
  if (item?.status === 'Submitted' && daysSinceDate(item?.expenseDate) > 14) return 'red';
  if (item?.status === 'Approved') return 'orange';
  if (item?.status === 'Reimbursed') return 'green';
  if (item?.status === 'Rejected') return 'gray';
  return STATUS_COLORS[item?.status] || 'accent';
};

const getExpenseAgeLabel = (value, t) => {
  const days = daysSinceDate(value);
  if (!Number.isFinite(days)) return t('No date recorded');
  if (days === 0) return t('Today');
  if (days === 1) return t('1 day ago');
  return `${days} ${t('days ago')}`;
};

export function EmployeeExpensesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, language } = useLanguage();
  const [claims, setClaims] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadClaims = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyExpenses(user.employee_id);
      setClaims(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(error.message || 'Failed to load expense claims', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: claims.length,
    pending: claims.filter((item) => item.status === 'Submitted').length,
    approvedAmount: claims
      .filter((item) => ['Approved', 'Reimbursed'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }), [claims]);

  const pendingValue = claims
    .filter((item) => ['Submitted', 'Approved'].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const reimbursedCount = claims.filter((item) => item.status === 'Reimbursed').length;
  const highValueCount = claims.filter((item) => Number(item.amount || 0) >= 150).length;
  const recentClaimsCount = claims.filter((item) => daysSinceDate(item.expenseDate) <= 30).length;
  const reimbursementMomentum = stats.total ? Math.round((reimbursedCount / stats.total) * 100) : 0;

  const expenseFocusQueue = useMemo(() => {
    const statusRank = { Submitted: 4, Approved: 3, Reimbursed: 2, Rejected: 1 };
    return [...claims]
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || Number(b.amount || 0) - Number(a.amount || 0)
        || daysSinceDate(a.expenseDate) - daysSinceDate(b.expenseDate)
        || String(a.title || '').localeCompare(String(b.title || '')))
      .slice(0, 4);
  }, [claims]);

  const categoryPressureMap = useMemo(() => {
    const grouped = claims.reduce((acc, item) => {
      const key = item.category || 'Other';
      if (!acc[key]) {
        acc[key] = { category: key, count: 0, pendingCount: 0, totalAmount: 0 };
      }
      acc[key].count += 1;
      acc[key].totalAmount += Number(item.amount || 0);
      if (['Submitted', 'Approved'].includes(item.status)) acc[key].pendingCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.pendingCount - a.pendingCount || b.totalAmount - a.totalAmount || b.count - a.count)
      .slice(0, 4);
  }, [claims]);

  const expensePlaybook = useMemo(() => {
    const plays = [];

    if (stats.pending > 0) {
      plays.push({
        title: t('Watch newly submitted claims'),
        note: t('Pending claims are the clearest place to monitor reimbursement timing and approval follow-through.'),
      });
    }
    if (pendingValue > 0) {
      plays.push({
        title: t('Track unreimbursed value'),
        note: t('Open claim value is worth keeping visible so nothing meaningful gets lost in the queue.'),
      });
    }
    if (highValueCount > 0) {
      plays.push({
        title: t('Double-check higher-value expenses'),
        note: t('Larger claims benefit from clear notes and clean documentation for faster review.'),
      });
    }
    if (recentClaimsCount > 0) {
      plays.push({
        title: t('Keep recent submissions organized'),
        note: t('A short review of newer claims helps maintain a steady reimbursement rhythm.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Expense flow looks stable'),
      note: t('Your reimbursement activity is currently light, so keep the same clear-claim habits going.'),
    }];
  }, [highValueCount, pendingValue, recentClaimsCount, stats.pending, t]);

  const strongestSignal = stats.pending > 0
    ? t('Some claims are still waiting for review, so reimbursement timing is the clearest thing to watch next.')
    : pendingValue > 0
      ? t('Open approved value is still sitting in the queue, making payout follow-through the key signal right now.')
      : highValueCount > 0
        ? t('A few higher-value claims stand out, so keeping their context clear will help later review and tracking.')
        : t('Your expense activity looks steady right now, with no major reimbursement pressure standing out.');

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.amount || !form.expenseDate) {
      toast('Title, amount, and expense date are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitExpenseClaim({
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        description: form.description.trim(),
      });
      toast('Expense claim submitted');
      setForm(INITIAL_FORM);
      await loadClaims();
    } catch (error) {
      toast(error.message || 'Failed to submit expense claim', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Expense Claims')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Submit work-related expenses and follow your approval and reimbursement status.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Claims'), value: stats.total, accent: '#111827' },
          { label: t('Pending Review'), value: stats.pending, accent: '#E8321A' },
          { label: t('Approved Value'), value: formatMoney(stats.approvedAmount, language), accent: '#10B981' },
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Expense Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Pending Claims'), value: stats.pending, color: '#E8321A', note: t('Submitted expense items still waiting for review.') },
                { label: t('Open Value'), value: formatMoney(pendingValue, language), color: '#B54708', note: t('Claim value still moving through approval or reimbursement.') },
                { label: t('High Value'), value: highValueCount, color: '#175CD3', note: t('Claims with higher reimbursement value that deserve extra clarity.') },
                { label: t('Momentum'), value: `${reimbursementMomentum}%`, color: '#027A48', note: t('Share of claims that have already reached reimbursement.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Reimbursement Queue')}</h3>
            </div>
            {expenseFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority expense follow-up items will appear here as claims are submitted.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {expenseFocusQueue.map((item) => (
                  <div key={`queue-${item.claimID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t(item.category)} • {formatMoney(item.amount, language)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{getExpenseAgeLabel(item.expenseDate, t)}</div>
                    </div>
                    <Badge label={t(item.status)} color={getExpenseTone(item)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Expense Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {expensePlaybook.map((item) => (
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
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No expense category pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {categoryPressureMap.map((item) => (
                  <div key={item.category} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.category)}</div>
                      <Badge label={`${item.count} ${t('claims')}`} color={item.pendingCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Pending')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.pendingCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Value')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{formatMoney(item.totalAmount, language)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Submit Claim')}</h3>
          <Input label={t('Title')} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('Airport transfer for client meeting')} />

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Category')}</label>
            <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 16 }}>
              {['Travel', 'Meals', 'Supplies', 'Training', 'Other'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Amount')} type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
            <Input label={t('Expense Date')} type="date" value={form.expenseDate} onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))} />
          </div>

          <Textarea label={t('Description')} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('Add a short explanation for the reimbursement request')} />

          <Btn onClick={handleSubmit} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Submitting...') : t('Submit Claim')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('My Claims')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : claims.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No expense claims submitted yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12, padding: 16 }}>
              {claims.map((item) => (
                <div key={item.claimID} className="hr-surface-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{item.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{item.category} • {item.expenseDate}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontWeight: 800, color: 'var(--red)' }}>{formatMoney(item.amount, language)}</div>
                      <Badge label={t(item.status)} color={getExpenseTone(item)} />
                    </div>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 8 }}>{item.description || t('No description provided.')}</p>
                  {item.reviewNote ? (
                    <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                      <strong>{t('HR note:')}</strong> {item.reviewNote}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
