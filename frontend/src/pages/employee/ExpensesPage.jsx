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

export function EmployeeExpensesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Claims'), value: stats.total, accent: '#111827' },
          { label: t('Pending Review'), value: stats.pending, accent: '#E8321A' },
          { label: t('Approved Value'), value: `$${stats.approvedAmount.toFixed(2)}`, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
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
                      <div style={{ fontWeight: 800, color: 'var(--red)' }}>${Number(item.amount || 0).toFixed(2)}</div>
                      <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
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
