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

const getTicketTone = (item) => {
  if (item?.followUpState === 'Escalate Now' || item?.priority === 'Critical') return 'red';
  if (item?.followUpState === 'Stalled Resolution') return 'orange';
  if (item?.followUpState === 'Needs Assignment') return 'yellow';
  if (item?.followUpState === 'Pending Closure' || item?.status === 'Resolved') return 'accent';
  if (item?.status === 'Closed') return 'green';
  return 'accent';
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

  const escalateNowCount = followUpItems.filter((item) => item.followUpState === 'Escalate Now').length;
  const stalledResolutionCount = followUpItems.filter((item) => item.followUpState === 'Stalled Resolution').length;
  const pendingClosureCount = followUpItems.filter((item) => item.followUpState === 'Pending Closure').length;
  const averageAging = followUpItems.length
    ? followUpItems.reduce((sum, item) => sum + Number(item.ageDays || 0), 0) / followUpItems.length
    : 0;
  const escalationQueue = useMemo(() => {
    const stateRank = { 'Escalate Now': 4, 'Stalled Resolution': 3, 'Needs Assignment': 2, 'Pending Closure': 1 };
    const priorityRank = { Critical: 3, High: 2, Medium: 1, Low: 0 };
    return [...followUpItems]
      .sort((a, b) => (stateRank[b.followUpState] || 0) - (stateRank[a.followUpState] || 0)
        || (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        || Number(b.ageDays || 0) - Number(a.ageDays || 0))
      .slice(0, 4);
  }, [followUpItems]);
  const supportPressureMap = useMemo(() => {
    return [...categoryBreakdown]
      .sort((a, b) => (Number(b.criticalCount || 0) + Number(b.openCount || 0)) - (Number(a.criticalCount || 0) + Number(a.openCount || 0))
        || Number(b.inProgressCount || 0) - Number(a.inProgressCount || 0)
        || Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 4);
  }, [categoryBreakdown]);
  const supportPlaybook = useMemo(() => {
    const plays = [];

    if (escalateNowCount > 0) {
      plays.push({
        title: t('Escalate critical blockers first'),
        note: t('Start with tickets marked for immediate escalation so employee-impacting issues get ownership quickly.'),
      });
    }
    if (stalledResolutionCount > 0) {
      plays.push({
        title: t('Restart stalled cases'),
        note: t('Focus on in-progress tickets with no recent movement to keep service momentum from slipping.'),
      });
    }
    if (pendingClosureCount > 0) {
      plays.push({
        title: t('Close resolved work cleanly'),
        note: t('Pending-closure tickets are quick wins that reduce visible backlog and tidy the helpdesk queue.'),
      });
    }
    if (supportPressureMap.some((item) => Number(item.criticalCount || 0) > 0 || Number(item.openCount || 0) > 0)) {
      plays.push({
        title: t('Prioritize the busiest support lane'),
        note: t('Work the category carrying the highest open or critical pressure to reduce queue risk fastest.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Keep support flow steady'),
      note: t('The helpdesk queue looks stable, so keep current assignment and closure practices in place.'),
    }];
  }, [escalateNowCount, pendingClosureCount, stalledResolutionCount, supportPressureMap, t]);
  const strongestSignal = escalateNowCount > 0
    ? t('Some helpdesk cases need immediate escalation and should be triaged before service confidence drops.')
    : stalledResolutionCount > 0
      ? t('Several cases are stuck in progress, so the fastest operational win is restarting stalled resolutions.')
      : t('Support operations look stable; keep new cases assigned quickly so they do not age into escalations.');

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

      <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Support Triage Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring escalation risk, stalled cases, and service-lane pressure into one helpdesk decision layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={escalateNowCount > 0 ? 'red' : 'green'} label={`${t('Escalate now')} ${escalateNowCount}`} />
            <Badge color={stalledResolutionCount > 0 ? 'orange' : 'gray'} label={`${t('Stalled')} ${stalledResolutionCount}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Escalate Now'),
              value: escalateNowCount,
              note: t('Critical or aging cases that need immediate ownership and escalation.'),
              accent: escalateNowCount > 0 ? '#DC2626' : '#22C55E',
            },
            {
              label: t('Stalled Resolution'),
              value: stalledResolutionCount,
              note: t('Tickets that are active but have not moved recently enough.'),
              accent: stalledResolutionCount > 0 ? '#F59E0B' : '#22C55E',
            },
            {
              label: t('Pending Closure'),
              value: pendingClosureCount,
              note: t('Resolved cases that still need final closure and communication back to employees.'),
              accent: '#2563EB',
            },
            {
              label: t('Average Aging'),
              value: `${Number(averageAging || 0).toFixed(1)} ${t('days')}`,
              note: t('Average age across flagged follow-up tickets to help judge helpdesk speed.'),
              accent: '#7C3AED',
            },
          ].map((card) => (
            <div key={card.label} className="workspace-journey-card">
              <div className="workspace-journey-title">{card.label}</div>
              <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
              <div className="workspace-journey-note">{card.note}</div>
            </div>
          ))}
        </div>

        <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', alignItems: 'start' }}>
          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Escalation Queue')}</div>
            {escalationQueue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority support items are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {escalationQueue.map((item) => (
                  <div key={item.ticketID} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                      <Badge color={getTicketTone(item)} label={t(item.followUpState || item.status)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.subject} • {t(item.category)} • {t(item.priority)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{item.summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color={item.priority === 'Critical' ? 'red' : item.priority === 'High' ? 'orange' : 'gray'} label={t(item.priority)} />
                      <Badge color="gray" label={`${item.ageDays ?? 0} ${t('days since last update')}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Helpdesk Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {supportPlaybook.map((item) => (
                <div key={item.title} className="workspace-focus-card" style={{ background: '#fff' }}>
                  <div className="workspace-focus-label">{item.title}</div>
                  <div className="workspace-focus-note">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Category Pressure Map')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>{t('See which support categories are carrying the most open or critical pressure right now.')}</div>
          {supportPressureMap.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No ticket summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {supportPressureMap.map((item) => (
                <div key={item.category} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>{t(item.category)}</strong>
                    <Badge
                      color={Number(item.criticalCount || 0) > 0 ? 'red' : Number(item.openCount || 0) > 0 ? 'orange' : 'green'}
                      label={`${item.count ?? 0} ${t('cases')}`}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.openCount ?? 0} {t('open')} · {item.inProgressCount ?? 0} {t('in progress')} · {item.criticalCount ?? 0} {t('critical')}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 6 }}>
                    {item.resolvedCount ?? 0} {t('resolved')} · {t('focus where service pressure is highest')}
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
