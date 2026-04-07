import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrGetTickets, hrGetTicketWatch, hrUpdateTicketStatus } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const downloadTextFile = (filename, content, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const STATUS_COLORS = {
  Open: 'orange',
  'In Progress': 'accent',
  Resolved: 'green',
  Closed: 'gray',
};

const WATCH_COLORS = {
  'Escalate Now': 'red',
  'Stalled Resolution': 'orange',
  'Needs Assignment': 'yellow',
  'Pending Closure': 'accent',
  Open: 'orange',
  'In Progress': 'accent',
  Resolved: 'green',
};

const EMPTY_WATCH = {
  summary: {},
  categoryBreakdown: [],
  followUpItems: [],
};

export function HRTicketsPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [tickets, setTickets] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const [data, watchData] = await Promise.all([
        hrGetTickets(),
        hrGetTicketWatch().catch(() => EMPTY_WATCH),
      ]);
      const list = Array.isArray(data) ? data : [];
      setTickets(list);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
      const nextNotes = {};
      list.forEach((item) => {
        nextNotes[item.ticketID] = item.resolutionNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load support tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const categoryBreakdown = watch?.categoryBreakdown || [];

  const stats = useMemo(() => ({
    total: watchSummary.totalTickets ?? tickets.length,
    active: (watchSummary.openCount ?? 0) + (watchSummary.inProgressCount ?? 0) || tickets.filter((item) => ['Open', 'In Progress'].includes(item.status)).length,
    critical: watchSummary.criticalCount ?? tickets.filter((item) => item.priority === 'Critical').length,
    followUp: watchSummary.followUpCount ?? 0,
  }), [tickets, watchSummary]);

  const ticketPulseCards = useMemo(() => ([
    {
      label: t('Active Cases'),
      value: stats.active,
      note: t('Helpdesk issues still moving through assignment, diagnosis, or resolution.'),
      accent: '#E8321A',
    },
    {
      label: t('Critical Alerts'),
      value: stats.critical,
      note: t('High-priority employee requests that may require faster escalation.'),
      accent: '#DC2626',
    },
    {
      label: t('Support Categories'),
      value: categoryBreakdown.length,
      note: t('Issue categories represented across the current helpdesk queue.'),
      accent: '#2563EB',
    },
    {
      label: t('Resolution Watch'),
      value: followUpItems.length,
      note: t('Cases still needing ownership, updates, or final closure steps.'),
      accent: '#7C3AED',
    },
  ]), [categoryBreakdown.length, followUpItems.length, stats.active, stats.critical, t]);

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Tickets', watchSummary.totalTickets ?? tickets.length, ''],
        ['Summary', 'Open', watchSummary.openCount ?? 0, ''],
        ['Summary', 'In Progress', watchSummary.inProgressCount ?? 0, ''],
        ['Summary', 'Critical', watchSummary.criticalCount ?? 0, ''],
        ['Summary', 'Needs Follow-Up', watchSummary.followUpCount ?? 0, ''],
      ];

      if (categoryBreakdown.length) {
        rows.push([]);
        rows.push(['Categories', 'Category', 'Count', 'Open / Critical']);
        categoryBreakdown.forEach((item) => {
          rows.push([
            'Categories',
            item.category,
            item.count ?? 0,
            `open ${item.openCount ?? 0} | in progress ${item.inProgressCount ?? 0} | critical ${item.criticalCount ?? 0}`,
          ]);
        });
      }

      if (followUpItems.length) {
        rows.push([]);
        rows.push(['Follow-Up', 'Employee', 'State', 'Summary']);
        followUpItems.forEach((item) => {
          rows.push([
            'Follow-Up',
            item.employeeName || item.employeeID,
            item.followUpState || item.status,
            `${item.subject || ''} | ${item.category || ''} | ${item.priority || ''} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`ticket-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Support watch exported.'));
    } catch {
      toast(t('Failed to export support watch.'), 'error');
    }
  };

  const handleUpdate = async (ticketID, status) => {
    setSavingId(`${ticketID}-${status}`);
    try {
      await hrUpdateTicketStatus(ticketID, { status, note: notes[ticketID] || '' });
      toast(`Ticket marked ${status.toLowerCase()}`);
      await loadTickets();
    } catch (error) {
      toast(error.message || 'Failed to update ticket status', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'مكتب دعم الموارد البشرية' : 'HR Helpdesk'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {language === 'ar' ? 'راجع حالات الدعم المقدمة من الموظفين وتابع تقدمها حتى الحل والإغلاق.' : 'Review employee support cases and track progress through resolution and closure.'}
          </p>
        </div>
        <Btn variant="outline" onClick={handleExportWatch}>{t('Export Watch CSV')}</Btn>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>
              {t(isAdminView ? 'Admin Control Center' : 'HR Operations')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {t(isAdminView
                ? 'Oversee users, access coverage, and operational readiness across the platform.'
                : 'People operations, compliance, and service delivery.')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/dashboard'))}>{t('nav.dashboard')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('nav.approvals')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/documents'))}>{t('nav.documents')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/employees'))}>{t('nav.employees')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Tickets'), value: stats.total, color: '#111827' },
            { label: t('Active Queue'), value: stats.active, color: '#E8321A' },
            { label: t('Critical'), value: stats.critical, color: '#DC2626' },
            { label: t('Needs Follow-Up'), value: stats.followUp, color: '#F59E0B' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 24 }}>
        {ticketPulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Tickets', value: stats.total, accent: '#111827' },
          { label: 'Active Queue', value: stats.active, accent: '#E8321A' },
          { label: 'Critical', value: stats.critical, accent: '#DC2626' },
          { label: 'Needs Follow-Up', value: stats.followUp, accent: '#F59E0B' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Support Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Highlight aging, critical, or unresolved employee helpdesk cases.')}</div>
            </div>
            <Badge label={`${watchSummary.criticalCount ?? 0} ${t('critical')}`} color={(watchSummary.criticalCount ?? 0) > 0 ? 'red' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No support follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.ticketID} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Support follow-up')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.subject} · {t(item.category)} · {t(item.priority)}</div>
                    </div>
                    <Badge label={t(item.followUpState || item.status)} color={WATCH_COLORS[item.followUpState] || STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Badge label={t(item.category)} color="accent" />
                    <Badge label={t(item.priority)} color={item.priority === 'Critical' ? 'red' : item.priority === 'High' ? 'orange' : 'gray'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 4 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    {item.ageDays ?? 0} {t('days since last update')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Category Snapshot')}</div>
          {categoryBreakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No ticket summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {categoryBreakdown.map((item) => (
                <div key={item.category} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{t(item.category)}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.count ?? 0}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.openCount ?? 0} {t('open')} · {item.inProgressCount ?? 0} {t('in progress')} · {item.criticalCount ?? 0} {t('critical')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hr-table-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Support Queue')}</h3>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No support cases in the queue.')}</div>
        ) : (
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            {tickets.map((item) => (
              <div key={item.ticketID} className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{item.subject}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                      {item.employeeName || item.employeeID} • {t(item.category)} • {t(item.priority)}
                    </div>
                  </div>
                  <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                </div>

                <div style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 10 }}>
                  {item.description || t('No description provided.')}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                  <Textarea
                    label={t('Resolution Note')}
                    value={notes[item.ticketID] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.ticketID]: e.target.value }))}
                    placeholder={t('Add progress notes or final resolution')}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant="accent" onClick={() => handleUpdate(item.ticketID, 'In Progress')} disabled={savingId === `${item.ticketID}-In Progress`}>
                      {savingId === `${item.ticketID}-In Progress` ? t('Saving...') : t('In Progress')}
                    </Btn>
                    <Btn onClick={() => handleUpdate(item.ticketID, 'Resolved')} disabled={savingId === `${item.ticketID}-Resolved`}>
                      {savingId === `${item.ticketID}-Resolved` ? t('Saving...') : t('Resolve')}
                    </Btn>
                    <Btn variant="ghost" onClick={() => handleUpdate(item.ticketID, 'Closed')} disabled={savingId === `${item.ticketID}-Closed`}>
                      {savingId === `${item.ticketID}-Closed` ? t('Saving...') : t('Close')}
                    </Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
