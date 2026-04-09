import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrGetDocumentWatch, hrGetDocuments, hrIssueDocument } from '../../api/index.js';
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
  Pending: 'orange',
  'In Progress': 'accent',
  Issued: 'green',
  Declined: 'red',
};

const WATCH_COLORS = {
  Overdue: 'red',
  'Pending Intake': 'orange',
  'Awaiting Finalization': 'yellow',
  'In Progress': 'accent',
  Issued: 'green',
  Declined: 'red',
};

const EMPTY_WATCH = {
  summary: {},
  documentTypeBreakdown: [],
  followUpItems: [],
};

const getDocumentTone = (item) => {
  if (item?.followUpState === 'Overdue') return 'red';
  if (item?.followUpState === 'Awaiting Finalization') return 'yellow';
  if (item?.followUpState === 'Pending Intake' || item?.status === 'Pending') return 'orange';
  if (item?.status === 'Issued') return 'green';
  return 'accent';
};

export function HRDocumentsPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const [data, watchData] = await Promise.all([
        hrGetDocuments(),
        hrGetDocumentWatch().catch(() => EMPTY_WATCH),
      ]);
      const list = Array.isArray(data) ? data : [];
      setDocuments(list);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
      const nextNotes = {};
      list.forEach((item) => {
        nextNotes[item.requestID] = item.reviewNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load document requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const documentTypeBreakdown = watch?.documentTypeBreakdown || [];

  const stats = useMemo(() => ({
    total: watchSummary.totalRequests ?? documents.length,
    open: (watchSummary.pendingCount ?? 0) + (watchSummary.inProgressCount ?? 0) || documents.filter((item) => ['Pending', 'In Progress'].includes(item.status)).length,
    issued: watchSummary.issuedCount ?? documents.filter((item) => item.status === 'Issued').length,
    followUp: watchSummary.followUpCount ?? 0,
  }), [documents, watchSummary]);

  const overdueCount = watchSummary.overdueCount ?? followUpItems.filter((item) => item.followUpState === 'Overdue').length;
  const pendingIntakeCount = followUpItems.filter((item) => item.followUpState === 'Pending Intake').length;
  const awaitingFinalizationCount = followUpItems.filter((item) => item.followUpState === 'Awaiting Finalization').length;
  const averageOpenAge = followUpItems.length
    ? followUpItems.reduce((sum, item) => sum + Number(item.ageDays || 0), 0) / followUpItems.length
    : 0;
  const documentFocusQueue = useMemo(() => {
    const stateRank = { Overdue: 3, 'Awaiting Finalization': 2, 'Pending Intake': 1, 'In Progress': 0 };
    return [...followUpItems]
      .sort((a, b) => (stateRank[b.followUpState] || 0) - (stateRank[a.followUpState] || 0)
        || Number(b.ageDays || 0) - Number(a.ageDays || 0)
        || String(a.employeeName || '').localeCompare(String(b.employeeName || '')))
      .slice(0, 4);
  }, [followUpItems]);
  const documentPressureMap = useMemo(() => {
    return [...documentTypeBreakdown]
      .sort((a, b) => (Number(b.pendingCount || 0) + Number(b.inProgressCount || 0)) - (Number(a.pendingCount || 0) + Number(a.inProgressCount || 0))
        || Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 4);
  }, [documentTypeBreakdown]);
  const issuancePlaybook = useMemo(() => {
    const plays = [];

    if (overdueCount > 0) {
      plays.push({
        title: t('Clear overdue requests first'),
        note: t('Start with the oldest pending document requests so service delays do not keep stacking up.'),
      });
    }
    if (awaitingFinalizationCount > 0) {
      plays.push({
        title: t('Finish in-progress requests'),
        note: t('Push almost-complete letters and certificates over the line to reduce visible backlog quickly.'),
      });
    }
    if (pendingIntakeCount > 0) {
      plays.push({
        title: t('Protect intake response time'),
        note: t('New document requests should be acknowledged quickly so employees know their request is moving.'),
      });
    }
    if (documentPressureMap.some((item) => Number(item.pendingCount || 0) > 0 || Number(item.inProgressCount || 0) > 0)) {
      plays.push({
        title: t('Prioritize the busiest document type'),
        note: t('Focus on the document type carrying the most open work to reduce service pressure fastest.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Keep issuance service steady'),
      note: t('Document operations look stable, so keep the current intake and issuance rhythm in place.'),
    }];
  }, [awaitingFinalizationCount, documentPressureMap, overdueCount, pendingIntakeCount, t]);
  const strongestSignal = overdueCount > 0
    ? t('Some employee document requests are already overdue and should be cleared before trust in service speed drops.')
    : awaitingFinalizationCount > 0
      ? t('Several requests are close to completion, so the fastest win is pushing finalization and issuance through today.')
      : t('Document service looks stable; keep new requests acknowledged quickly so they do not age into backlog.');

  const documentPulseCards = useMemo(() => ([
    {
      label: t('Open Requests'),
      value: stats.open,
      note: t('Employee document requests currently moving through intake and issuance.'),
      accent: '#E8321A',
    },
    {
      label: t('Overdue Issuance'),
      value: watchSummary.overdueCount ?? 0,
      note: t('Requests that need faster processing or final handoff to the employee.'),
      accent: '#F59E0B',
    },
    {
      label: t('Document Mix'),
      value: documentTypeBreakdown.length,
      note: t('Types of letters and certificates represented in the current queue.'),
      accent: '#2563EB',
    },
    {
      label: t('Service Watch'),
      value: followUpItems.length,
      note: t('Requests still needing notes, approval, or pickup coordination.'),
      accent: '#7C3AED',
    },
  ]), [documentTypeBreakdown.length, followUpItems.length, stats.open, t, watchSummary.overdueCount]);

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Requests', watchSummary.totalRequests ?? documents.length, ''],
        ['Summary', 'Pending', watchSummary.pendingCount ?? 0, ''],
        ['Summary', 'In Progress', watchSummary.inProgressCount ?? 0, ''],
        ['Summary', 'Issued', watchSummary.issuedCount ?? 0, ''],
        ['Summary', 'Overdue', watchSummary.overdueCount ?? 0, ''],
      ];

      if (documentTypeBreakdown.length) {
        rows.push([]);
        rows.push(['Types', 'Document Type', 'Count', 'Pending / Issued']);
        documentTypeBreakdown.forEach((item) => {
          rows.push([
            'Types',
            item.documentType,
            item.count ?? 0,
            `pending ${item.pendingCount ?? 0} | in progress ${item.inProgressCount ?? 0} | issued ${item.issuedCount ?? 0}`,
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
            `${item.documentType || ''} | ${item.purpose || ''} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`document-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Document watch exported.'));
    } catch {
      toast(t('Failed to export document watch.'), 'error');
    }
  };

  const handleIssue = async (requestID, status) => {
    setSavingId(`${requestID}-${status}`);
    try {
      await hrIssueDocument(requestID, { status, note: notes[requestID] || '' });
      toast(`Request marked ${status.toLowerCase()}`);
      await loadDocuments();
    } catch (error) {
      toast(error.message || 'Failed to update document request', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'إصدار المستندات' : 'Document Issuance'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {language === 'ar' ? 'راجع طلبات المستندات من الموظفين وحدّث حالة الإصدار أو الإكمال.' : 'Review employee document requests and update issuance progress or completion.'}
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/policies'))}>{t('nav.policies')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/tickets'))}>{t('nav.supportTickets')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Requests'), value: stats.total, color: '#111827' },
            { label: t('Open Queue'), value: stats.open, color: '#E8321A' },
            { label: t('Issued'), value: stats.issued, color: '#10B981' },
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
        {documentPulseCards.map((card) => (
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Document Fulfillment Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring issuance delays, intake pressure, and service hotspots into one document operations review layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={overdueCount > 0 ? 'red' : 'green'} label={`${t('Overdue')} ${overdueCount}`} />
            <Badge color={pendingIntakeCount > 0 ? 'orange' : 'gray'} label={`${t('Pending intake')} ${pendingIntakeCount}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Overdue'),
              value: overdueCount,
              note: t('Requests already outside the expected service window and most likely to trigger employee follow-up.'),
              accent: overdueCount > 0 ? '#E8321A' : '#22C55E',
            },
            {
              label: t('Awaiting Finalization'),
              value: awaitingFinalizationCount,
              note: t('In-progress requests that need the last step before the employee can receive the document.'),
              accent: awaitingFinalizationCount > 0 ? '#F59E0B' : '#22C55E',
            },
            {
              label: t('Issued'),
              value: stats.issued,
              note: t('Completed document requests already delivered or ready for employee pickup.'),
              accent: '#2563EB',
            },
            {
              label: t('Average Open Age'),
              value: `${Number(averageOpenAge || 0).toFixed(1)} ${t('days')}`,
              note: t('Average aging across flagged follow-up items to help judge service speed.'),
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
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Issuance Queue')}</div>
            {documentFocusQueue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority document items are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {documentFocusQueue.map((item) => (
                  <div key={item.requestID} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                      <Badge color={getDocumentTone(item)} label={t(item.followUpState || item.status)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{t(item.documentType)} • {item.purpose}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{item.summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="accent" label={t(item.status)} />
                      <Badge color="gray" label={`${item.ageDays ?? 0} ${t('days open')}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Document Service Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {issuancePlaybook.map((item) => (
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
          { label: 'Requests', value: stats.total, accent: '#111827' },
          { label: 'Open Queue', value: stats.open, accent: '#E8321A' },
          { label: 'Issued', value: stats.issued, accent: '#10B981' },
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
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Issuance Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Highlight document requests that need faster turnaround or final issuance.')}</div>
            </div>
            <Badge label={`${watchSummary.overdueCount ?? 0} ${t('overdue')}`} color={(watchSummary.overdueCount ?? 0) > 0 ? 'red' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No document follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.requestID} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Document follow-up')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{t(item.documentType)} · {item.purpose}</div>
                    </div>
                    <Badge label={t(item.followUpState || item.status)} color={WATCH_COLORS[item.followUpState] || STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Badge label={t(item.documentType)} color="accent" />
                    <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 4 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    {item.ageDays ?? 0} {t('days open')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Document Pressure Map')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>{t('See which request types are carrying the most pending intake or finalization pressure.')}</div>
          {documentPressureMap.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No document summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {documentPressureMap.map((item) => (
                <div key={item.documentType} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>{t(item.documentType)}</strong>
                    <Badge
                      color={Number(item.pendingCount || 0) > 0 ? 'orange' : Number(item.inProgressCount || 0) > 0 ? 'yellow' : 'green'}
                      label={`${item.count ?? 0} ${t('requests')}`}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.pendingCount ?? 0} {t('pending')} · {item.inProgressCount ?? 0} {t('in progress')} · {item.issuedCount ?? 0} {t('issued')}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 6 }}>
                    {item.declinedCount ?? 0} {t('declined')} · {t('focus where open volume is highest')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hr-table-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Document Queue')}</h3>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : documents.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No document requests in the queue.')}</div>
        ) : (
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            {documents.map((item) => (
              <div key={item.requestID} className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{t(item.documentType)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                      {item.employeeName || item.employeeID} • {item.purpose}
                    </div>
                  </div>
                  <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                </div>

                <div style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 10 }}>
                  {item.notes || t('No additional notes.')}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                  <Textarea
                    label={t('HR Note')}
                    value={notes[item.requestID] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.requestID]: e.target.value }))}
                    placeholder={t('Optional note or pickup instructions')}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant="ghost" onClick={() => handleIssue(item.requestID, 'Declined')} disabled={savingId === `${item.requestID}-Declined`}>
                      {savingId === `${item.requestID}-Declined` ? t('Saving...') : t('Decline')}
                    </Btn>
                    <Btn variant="accent" onClick={() => handleIssue(item.requestID, 'In Progress')} disabled={savingId === `${item.requestID}-In Progress`}>
                      {savingId === `${item.requestID}-In Progress` ? t('Saving...') : t('In Progress')}
                    </Btn>
                    <Btn onClick={() => handleIssue(item.requestID, 'Issued')} disabled={savingId === `${item.requestID}-Issued`}>
                      {savingId === `${item.requestID}-Issued` ? t('Saving...') : t('Issue')}
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
