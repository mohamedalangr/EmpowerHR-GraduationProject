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

const daysSinceDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today - date) / (1000 * 60 * 60 * 24));
};

const getTicketTone = (item) => {
  const age = daysSinceDate(item?.updatedAt || item?.createdAt);
  if (item?.status === 'Open' && (item?.priority === 'Critical' || age > 2)) return 'red';
  if (item?.status === 'In Progress' && (item?.priority === 'High' || item?.priority === 'Critical' || age > 3)) return 'orange';
  if (item?.status === 'Resolved') return 'green';
  if (item?.status === 'Closed') return 'gray';
  if (item?.priority === 'High') return 'orange';
  return STATUS_COLORS[item?.status] || 'gray';
};

const getTicketAgeLabel = (value, t) => {
  const days = daysSinceDate(value);
  if (!Number.isFinite(days)) return t('No date recorded');
  if (days === 0) return t('Updated today');
  if (days === 1) return t('Updated 1 day ago');
  return `${t('Updated')} ${days} ${t('days ago')}`;
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
    resolved: tickets.filter((item) => ['Resolved', 'Closed'].includes(item.status)).length,
  }), [tickets]);

  const inProgressCount = tickets.filter((item) => item.status === 'In Progress').length;
  const criticalCount = tickets.filter((item) => item.priority === 'Critical').length;
  const stalledCount = tickets.filter((item) => ['Open', 'In Progress'].includes(item.status) && daysSinceDate(item.updatedAt || item.createdAt) > 3).length;
  const recentTicketsCount = tickets.filter((item) => daysSinceDate(item.createdAt) <= 30).length;

  const ticketFocusQueue = useMemo(() => {
    const statusRank = { Open: 4, 'In Progress': 3, Resolved: 2, Closed: 1 };
    const priorityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return [...tickets]
      .sort((a, b) => (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        || (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || daysSinceDate(b.updatedAt || b.createdAt) - daysSinceDate(a.updatedAt || a.createdAt)
        || String(a.subject || '').localeCompare(String(b.subject || '')))
      .slice(0, 4);
  }, [tickets]);

  const ticketCategoryPressureMap = useMemo(() => {
    const grouped = tickets.reduce((acc, item) => {
      const key = item.category || 'General';
      if (!acc[key]) {
        acc[key] = { category: key, count: 0, openCount: 0, criticalCount: 0, resolvedCount: 0 };
      }
      acc[key].count += 1;
      if (['Open', 'In Progress'].includes(item.status)) acc[key].openCount += 1;
      if (item.priority === 'Critical') acc[key].criticalCount += 1;
      if (['Resolved', 'Closed'].includes(item.status)) acc[key].resolvedCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.openCount - a.openCount || b.criticalCount - a.criticalCount || b.count - a.count)
      .slice(0, 4);
  }, [tickets]);

  const ticketPlaybook = useMemo(() => {
    const plays = [];

    if (criticalCount > 0) {
      plays.push({
        title: t('Escalate critical blockers first'),
        note: t('Critical tickets are the clearest place to focus because they usually affect productivity or access immediately.'),
      });
    }
    if (stalledCount > 0) {
      plays.push({
        title: t('Nudge aging cases forward'),
        note: t('Tickets open for several days often just need one update or clarification to restart progress.'),
      });
    }
    if (stats.open > 0) {
      plays.push({
        title: t('Keep active cases well documented'),
        note: t('Clear descriptions and recent updates help HR move open cases to resolution faster.'),
      });
    }
    if (recentTicketsCount > 0) {
      plays.push({
        title: t('Track new requests early'),
        note: t('Recently created tickets are easier to resolve when the first response cycle stays quick and complete.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Support queue looks stable'),
      note: t('No urgent support pressure stands out right now, so keep using clear ticket notes for any new requests.'),
    }];
  }, [criticalCount, recentTicketsCount, stalledCount, stats.open, t]);

  const strongestSignal = criticalCount > 0
    ? t('One or more critical support cases are still open, making fast resolution the clearest pressure point right now.')
    : stalledCount > 0
      ? t('Some tickets have been waiting for several days, so follow-up momentum is the main signal to watch next.')
      : stats.open > 0
        ? t('There are active support cases in progress, so keeping updates clear is the best next step.')
        : t('Your support queue looks steady right now, with no major case pressure standing out.');

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
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

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Support Response Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Open Cases'), value: stats.open, color: '#E8321A', note: t('Cases still waiting for assignment, updates, or resolution.') },
                { label: t('In Progress'), value: inProgressCount, color: '#B54708', note: t('Tickets already moving through active investigation or follow-up.') },
                { label: t('Critical'), value: criticalCount, color: '#DC2626', note: t('Higher-risk requests that may need faster escalation and response.') },
                { label: t('Recent'), value: recentTicketsCount, color: '#027A48', note: t('New tickets created in the current month of support activity.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Resolution Queue')}</h3>
            </div>
            {ticketFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority support items will appear here as tickets are created.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {ticketFocusQueue.map((item) => (
                  <div key={`queue-${item.ticketID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.subject}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{t(item.category)} • {t(item.priority)} {t('priority')}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{getTicketAgeLabel(item.updatedAt || item.createdAt, t)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Badge label={t(item.priority)} color={item.priority === 'Critical' ? 'red' : item.priority === 'High' ? 'orange' : 'gray'} />
                      <Badge label={t(item.status)} color={getTicketTone(item)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Support Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {ticketPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Category Pressure')}</div>
            {ticketCategoryPressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No support category pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {ticketCategoryPressureMap.map((item) => (
                  <div key={item.category} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.category)}</div>
                      <Badge label={`${item.count} ${t('tickets')}`} color={item.openCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Open')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.openCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Critical')}</div>
                        <div style={{ fontWeight: 700, color: '#DC2626' }}>{item.criticalCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Resolved')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.resolvedCount}</div>
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
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t(item.category)} • {t(item.priority)} {t('priority')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={t(item.priority)} color={item.priority === 'Critical' ? 'red' : item.priority === 'High' ? 'orange' : 'gray'} />
                      <Badge label={t(item.status)} color={getTicketTone(item)} />
                    </div>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 8 }}>{item.description || t('No additional details provided.')}</p>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginBottom: 8 }}>{getTicketAgeLabel(item.updatedAt || item.createdAt, t)}</div>
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
