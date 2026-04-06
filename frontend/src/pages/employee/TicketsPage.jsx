import { useEffect, useMemo, useState } from 'react';
import { getMyTickets, submitSupportTicket } from '../../api/index.js';
import { Badge, Btn, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  subject: '',
  category: 'General',
  priority: 'Medium',
  description: '',
};

const STATUS_COLORS = {
  Open: 'orange',
  'In Progress': 'accent',
  Resolved: 'green',
  Closed: 'gray',
};

export function EmployeeTicketsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyTickets(user.employee_id);
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(error.message || 'Failed to load support tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((item) => ['Open', 'In Progress'].includes(item.status)).length,
    resolved: tickets.filter((item) => item.status === 'Resolved').length,
  }), [tickets]);

  const handleSubmit = async () => {
    if (!form.subject.trim()) {
      toast('Subject is required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitSupportTicket({
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
      });
      toast('Support ticket created');
      setForm(INITIAL_FORM);
      await loadTickets();
    } catch (error) {
      toast(error.message || 'Failed to create support ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Support Tickets')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Contact HR for payroll, policy, benefits, or IT-related support and follow the resolution progress.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Tickets'), value: stats.total, accent: '#111827' },
          { label: t('Open Cases'), value: stats.open, accent: '#E8321A' },
          { label: t('Resolved'), value: stats.resolved, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Ticket')}</h3>
          <Input label={t('Subject')} value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder={t('Laptop VPN issue')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Category')}</label>
              <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 16 }}>
                {['IT', 'Payroll', 'Benefits', 'Policy', 'General'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Priority')}</label>
              <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 16 }}>
                {['Low', 'Medium', 'High', 'Critical'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <Textarea label={t('Description')} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('Explain the issue and any steps already tried')} />

          <Btn onClick={handleSubmit} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Submitting...') : t('Create Ticket')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('My Support Cases')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No support tickets yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12, padding: 16 }}>
              {tickets.map((item) => (
                <div key={item.ticketID} className="hr-surface-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{item.subject}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{item.category} • {item.priority} priority</div>
                    </div>
                    <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 8 }}>{item.description || t('No additional details provided.')}</p>
                  {item.resolutionNote ? (
                    <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                      <strong>{t('HR update:')}</strong> {item.resolutionNote}
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
