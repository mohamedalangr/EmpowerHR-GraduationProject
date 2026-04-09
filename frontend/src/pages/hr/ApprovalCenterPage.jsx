import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hrGetApprovalSnapshot,
  hrGetDocuments,
  hrGetExpenses,
  hrGetLeaveRequests,
  hrGetTickets,
  hrIssueDocument,
  hrReviewExpenseClaim,
  hrReviewLeaveRequest,
  hrUpdateTicketStatus,
} from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Pending: 'orange',
  Submitted: 'orange',
  Open: 'orange',
  Approved: 'green',
  Reimbursed: 'accent',
  Resolved: 'green',
  Issued: 'green',
  'In Progress': 'accent',
  Closed: 'gray',
  Rejected: 'red',
  Declined: 'red',
};

function formatAmount(value) {
  const preferredCurrency = typeof document !== 'undefined'
    ? (document.documentElement.dataset.currencyPreference || 'EGP')
    : 'EGP';
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar-EG' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: preferredCurrency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

const downloadTextFile = (filename, content, mimeType = 'text/csv;charset=utf-8') => {
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

export function HRApprovalCenterPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, resolvePath } = useAuth();
  const isAdminView = user?.role === 'Admin';

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [expenseClaims, setExpenseClaims] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [notes, setNotes] = useState({});
  const [selectedItems, setSelectedItems] = useState({
    leave: [],
    expense: [],
    document: [],
    ticket: [],
  });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [approvalSnapshot, setApprovalSnapshot] = useState({
    totals: {},
    slaSummary: {},
    followUpItems: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [leaveData, expenseData, documentData, ticketData, snapshotData] = await Promise.all([
        hrGetLeaveRequests(),
        hrGetExpenses(),
        hrGetDocuments(),
        hrGetTickets(),
        hrGetApprovalSnapshot().catch(() => null),
      ]);

      const leaveList = Array.isArray(leaveData) ? leaveData : [];
      const expenseList = Array.isArray(expenseData) ? expenseData : [];
      const documentList = Array.isArray(documentData) ? documentData : [];
      const ticketList = Array.isArray(ticketData) ? ticketData : [];

      setLeaveRequests(leaveList);
      setExpenseClaims(expenseList);
      setDocuments(documentList);
      setTickets(ticketList);
      setApprovalSnapshot(snapshotData && typeof snapshotData === 'object'
        ? snapshotData
        : { totals: {}, slaSummary: {}, followUpItems: [] });

      const nextNotes = {};
      leaveList.forEach((item) => {
        nextNotes[`leave-${item.leaveRequestID}`] = item.reviewNotes || '';
      });
      expenseList.forEach((item) => {
        nextNotes[`expense-${item.claimID}`] = item.reviewNote || '';
      });
      documentList.forEach((item) => {
        nextNotes[`document-${item.requestID}`] = item.reviewNote || '';
      });
      ticketList.forEach((item) => {
        nextNotes[`ticket-${item.ticketID}`] = item.resolutionNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load approval center data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((item) => item.status === 'Pending'),
    [leaveRequests],
  );
  const pendingExpenses = useMemo(
    () => expenseClaims.filter((item) => item.status === 'Submitted'),
    [expenseClaims],
  );
  const pendingDocuments = useMemo(
    () => documents.filter((item) => ['Pending', 'In Progress'].includes(item.status)),
    [documents],
  );
  const activeTickets = useMemo(
    () => tickets.filter((item) => ['Open', 'In Progress'].includes(item.status)),
    [tickets],
  );

  const stats = useMemo(
    () => ({
      totalPending: pendingLeaves.length + pendingExpenses.length + pendingDocuments.length + activeTickets.length,
      leaves: pendingLeaves.length,
      expenses: pendingExpenses.length,
      documents: pendingDocuments.length,
      tickets: activeTickets.length,
    }),
    [activeTickets.length, pendingDocuments.length, pendingExpenses.length, pendingLeaves.length],
  );

  const triageItems = approvalSnapshot?.followUpItems || [];
  const servicePressureCards = useMemo(() => ([
    {
      label: t('Leave approvals'),
      value: stats.leaves,
      note: t('Pending time-off decisions still waiting for action.'),
      accent: '#F59E0B',
      path: resolvePath('/hr/attendance'),
    },
    {
      label: t('Expense reviews'),
      value: stats.expenses,
      note: t('Claims still moving through financial review.'),
      accent: '#8B5CF6',
      path: resolvePath('/hr/expenses'),
    },
    {
      label: t('Document updates'),
      value: stats.documents,
      note: t('Requests that still need issuance or follow-up.'),
      accent: '#16A34A',
      path: resolvePath('/hr/documents'),
    },
    {
      label: t('Support follow-up'),
      value: stats.tickets,
      note: t('Open employee support cases still in motion.'),
      accent: '#0EA5E9',
      path: resolvePath('/hr/tickets'),
    },
  ]), [resolvePath, stats.documents, stats.expenses, stats.leaves, stats.tickets, t]);

  const triagePlaybook = useMemo(() => {
    const plays = [];

    if ((approvalSnapshot?.slaSummary?.overdueCount ?? 0) > 0) {
      plays.push({
        title: t('Resolve overdue cases first'),
        note: t('Clear the oldest items first so service SLAs recover quickly and backlog pressure starts dropping.'),
      });
    }
    if (stats.expenses > 0) {
      plays.push({
        title: t('Unblock finance review'),
        note: t('Move submitted claims forward so reimbursements do not create avoidable employee friction.'),
      });
    }
    if (stats.tickets > 0) {
      plays.push({
        title: t('Protect the employee experience'),
        note: t('Respond to open support issues quickly, especially when the queue includes critical or aging cases.'),
      });
    }
    if (stats.documents > 0) {
      plays.push({
        title: t('Keep document turnaround predictable'),
        note: t('Issue routine letters and confirmations before pending requests start slipping past expectations.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Maintain the current approval rhythm'),
      note: t('Approval queues are currently healthy. Keep the same daily review cadence in place.'),
    }];
  }, [approvalSnapshot?.slaSummary?.overdueCount, stats.documents, stats.expenses, stats.tickets, t]);

  const selectedCounts = useMemo(() => ({
    leave: selectedItems.leave.length,
    expense: selectedItems.expense.length,
    document: selectedItems.document.length,
    ticket: selectedItems.ticket.length,
  }), [selectedItems]);

  const setNoteValue = (key, value) => {
    setNotes((prev) => ({ ...prev, [key]: value }));
  };

  const toggleItemSelection = (section, itemId) => {
    setSelectedItems((prev) => ({
      ...prev,
      [section]: prev[section].includes(itemId)
        ? prev[section].filter((id) => id !== itemId)
        : [...prev[section], itemId],
    }));
  };

  const selectAllForSection = (section, items, idKey) => {
    setSelectedItems((prev) => ({
      ...prev,
      [section]: items.map((item) => item[idKey]).filter(Boolean),
    }));
  };

  const clearSelection = (section) => {
    setSelectedItems((prev) => ({ ...prev, [section]: [] }));
  };

  const requireNoteForStatus = (key, status) => {
    const noteValue = (notes[key] || '').trim();
    if (['Rejected', 'Declined', 'Resolved', 'Closed'].includes(status) && !noteValue) {
      toast(t('approval.noteRequired'), 'error');
      return null;
    }
    return noteValue;
  };

  const handleLeaveReview = async (leaveRequestID, status) => {
    const noteKey = `leave-${leaveRequestID}`;
    const requiredNote = requireNoteForStatus(noteKey, status);
    if (['Rejected', 'Declined', 'Resolved', 'Closed'].includes(status) && requiredNote === null) return;

    setSavingId(`leave-${leaveRequestID}-${status}`);
    try {
      await hrReviewLeaveRequest(leaveRequestID, {
        status,
        reviewNotes: status === 'Approved'
          ? (requiredNote || t('Approved in Approval Center.'))
          : requiredNote,
      });
      toast(t(status === 'Approved' ? 'Leave request approved' : 'Leave request rejected'));
      await loadData();
    } catch (error) {
      toast(error.message || 'Review action failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleExpenseReview = async (claimID, status) => {
    const noteValue = requireNoteForStatus(`expense-${claimID}`, status);
    if (['Rejected', 'Declined', 'Resolved', 'Closed'].includes(status) && noteValue === null) return;

    setSavingId(`expense-${claimID}-${status}`);
    try {
      await hrReviewExpenseClaim(claimID, {
        status,
        note: noteValue || '',
      });
      toast(t('Expense claim updated'));
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to update expense claim', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDocumentUpdate = async (requestID, status) => {
    const noteValue = requireNoteForStatus(`document-${requestID}`, status);
    if (['Rejected', 'Declined', 'Resolved', 'Closed'].includes(status) && noteValue === null) return;

    setSavingId(`document-${requestID}-${status}`);
    try {
      await hrIssueDocument(requestID, {
        status,
        note: noteValue || '',
      });
      toast(t('Document request updated'));
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to update document request', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleTicketUpdate = async (ticketID, status) => {
    const noteValue = requireNoteForStatus(`ticket-${ticketID}`, status);
    if (['Rejected', 'Declined', 'Resolved', 'Closed'].includes(status) && noteValue === null) return;

    setSavingId(`ticket-${ticketID}-${status}`);
    try {
      await hrUpdateTicketStatus(ticketID, {
        status,
        note: noteValue || '',
      });
      toast(t('Support ticket updated'));
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to update ticket status', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkAction = async (section, status) => {
    const ids = selectedItems[section] || [];
    if (!ids.length) {
      toast('Select at least one item first', 'error');
      return;
    }

    setSavingId(`bulk-${section}-${status}`);
    try {
      await Promise.all(ids.map((id) => {
        if (section === 'leave') {
          const noteKey = `leave-${id}`;
          const noteValue = (notes[noteKey] || '').trim();
          return hrReviewLeaveRequest(id, {
            status,
            reviewNotes: status === 'Approved' ? (noteValue || t('Approved in Approval Center.')) : noteValue,
          });
        }
        if (section === 'expense') {
          return hrReviewExpenseClaim(id, {
            status,
            note: (notes[`expense-${id}`] || '').trim(),
          });
        }
        if (section === 'document') {
          return hrIssueDocument(id, {
            status,
            note: (notes[`document-${id}`] || '').trim(),
          });
        }
        return hrUpdateTicketStatus(id, {
          status,
          note: (notes[`ticket-${id}`] || '').trim(),
        });
      }));

      toast(`${ids.length} item(s) updated.`);
      clearSelection(section);
      await loadData();
    } catch (error) {
      toast(error.message || 'Bulk action failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleExportTriage = () => {
    const rows = [
      ['Type', 'Employee', 'Summary', 'Status', 'Waiting Days', 'SLA State', 'Path'],
      ...triageItems.map((item) => [
        item.type || '',
        item.employeeName || '',
        item.summary || '',
        item.status || '',
        item.waitingDays ?? '',
        item.slaState || '',
        item.path || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadTextFile('approval-triage-watch.csv', csv);
  };

  const renderBulkToolbar = (section, items, idKey, actions = []) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Selected: {selectedCounts[section] || 0}</span>
      <Btn size="sm" variant="ghost" onClick={() => selectAllForSection(section, items, idKey)} disabled={!items.length}>
        Select All
      </Btn>
      <Btn size="sm" variant="outline" onClick={() => clearSelection(section)} disabled={!selectedCounts[section]}>
        Clear
      </Btn>
      {actions.map((action) => (
        <Btn
          key={`${section}-${action.status}`}
          size="sm"
          variant={action.variant || 'primary'}
          disabled={!selectedCounts[section] || savingId === `bulk-${section}-${action.status}`}
          onClick={() => handleBulkAction(section, action.status)}
        >
          {savingId === `bulk-${section}-${action.status}` ? t('Saving...') : action.label}
        </Btn>
      ))}
    </div>
  );

  const getSlaTone = (state) => {
    if (state === 'Overdue') return 'red';
    if (state === 'At Risk') return 'yellow';
    return 'green';
  };

  const renderSectionEmpty = (message) => (
    <div className="hr-soft-empty" style={{ padding: '20px 18px', textAlign: 'center' }}>
      <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t(message)}</p>
    </div>
  );

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.approvals.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>{t('page.approvals.subtitle')}</p>
        </div>
        <Btn variant="ghost" onClick={loadData}>{t('Refresh data')}</Btn>
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/forms'))}>{t('nav.forms')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/reviews'))}>{t('nav.reviews')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Pending Actions'), value: stats.totalPending, color: '#E8321A' },
            { label: t('Overdue'), value: approvalSnapshot?.slaSummary?.overdueCount ?? 0, color: '#B42318' },
            { label: t('At Risk'), value: approvalSnapshot?.slaSummary?.atRiskCount ?? 0, color: '#F59E0B' },
            { label: t('Support follow-up'), value: stats.tickets, color: '#0EA5E9' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hr-stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Pending Actions', value: stats.totalPending, color: '#E8321A' },
          { label: 'Leave approvals', value: stats.leaves, color: '#F59E0B' },
          { label: 'Expense reviews', value: stats.expenses, color: '#8B5CF6' },
          { label: 'Document updates', value: stats.documents, color: '#16A34A' },
          { label: 'Support follow-up', value: stats.tickets, color: '#0EA5E9' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {!loading && (
        <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Approval Triage Radar')}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('See where approval pressure is building and what should be handled next across HR service lanes.')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge label={`${t('Overdue')} ${approvalSnapshot?.slaSummary?.overdueCount ?? 0}`} color={(approvalSnapshot?.slaSummary?.overdueCount ?? 0) > 0 ? 'red' : 'green'} />
              <Badge label={`${t('Oldest open (days)')} ${approvalSnapshot?.slaSummary?.oldestOpenDays ?? 0}`} color={(approvalSnapshot?.slaSummary?.oldestOpenDays ?? 0) > 2 ? 'orange' : 'green'} />
              <Btn size="sm" variant="ghost" onClick={handleExportTriage} disabled={!triageItems.length}>{t('Export triage CSV')}</Btn>
            </div>
          </div>

          <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
            {servicePressureCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => navigate(card.path)}
                className="workspace-journey-card"
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <div className="workspace-journey-title">{card.label}</div>
                <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
                <div className="workspace-journey-note">{card.note}</div>
              </button>
            ))}
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr' }}>
            <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Immediate Decision Queue')}</div>
              {triageItems.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No approval escalations are currently outside the expected response window.')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {triageItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="workspace-action-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                        <Badge color={getSlaTone(item.slaState)} label={t(item.slaState)} />
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{t(item.type)} • {item.summary}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{t('Waiting')} {item.waitingDays} {t('days')} • {t('Status')}: {t(item.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Approver Playbook')}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {triagePlaybook.map((item) => (
                  <div key={item.title} className="workspace-focus-card" style={{ background: '#fff' }}>
                    <div className="workspace-focus-label">{item.title}</div>
                    <div className="workspace-focus-note">{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.2fr .8fr', marginBottom: 24, alignItems: 'start' }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Escalation Watch')}</div>
                <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>{t('Monitor approvals that need same-day or near-term HR follow-up.')}</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('Open full queue')}</Btn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Overdue', value: approvalSnapshot?.slaSummary?.overdueCount ?? 0, color: '#B42318', bg: '#FFF1F3' },
                { label: 'At Risk', value: approvalSnapshot?.slaSummary?.atRiskCount ?? 0, color: '#B54708', bg: '#FFFAEB' },
                { label: 'Critical tickets', value: approvalSnapshot?.slaSummary?.criticalTickets ?? 0, color: '#175CD3', bg: '#EFF8FF' },
                { label: 'Oldest open (days)', value: approvalSnapshot?.slaSummary?.oldestOpenDays ?? 0, color: '#344054', bg: '#F8FAFC' },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: 16, padding: '12px 14px', background: item.bg }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>{t(item.label)}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {(approvalSnapshot?.followUpItems || []).length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('All approval queues are currently within the expected response window.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {(approvalSnapshot?.followUpItems || []).map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 14, border: '1px solid #E7EAEE', background: '#fff' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                        <Badge color={getSlaTone(item.slaState)} label={t(item.slaState)} />
                        <Badge color="slate" label={t(item.type)} />
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-600)' }}>{item.summary} • {t('Waiting')} {item.waitingDays} {t('days')}</div>
                    </div>
                    <Btn size="sm" variant="outline" onClick={() => navigate(resolvePath(item.path || '/hr/approvals'))}>{t('Review')}</Btn>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Approval Matrix & SLAs')}</div>
            <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 12 }}>{t('Use a consistent service standard so approvals stay compliant and predictable.')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['Leave Request', 'Approve before the leave start date or within 24 hours.'],
                ['Expense Claim', 'Review within 2 business days and reimburse quickly after approval.'],
                ['Document Request', 'Issue standard letters within 3 business days.'],
                ['Support Ticket', 'Respond same day for critical issues and within 48 hours for high priority.'],
              ].map(([label, rule]) => (
                <div key={label} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{t(label)}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', lineHeight: 1.5 }}>{t(rule)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center' }}><Spinner /></div>
      ) : (
        <div className="hr-panel-grid" style={{ alignItems: 'start' }}>
          <div className="hr-table-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Leave requests')}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {renderBulkToolbar('leave', pendingLeaves, 'leaveRequestID', [
                  { status: 'Approved', label: 'Bulk Approve' },
                ])}
                <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/attendance'))}>{t('Open full queue')}</Btn>
              </div>
            </div>
            {pendingLeaves.length === 0 ? renderSectionEmpty('No pending leave requests.') : (
              <div style={{ display: 'grid', gap: 10 }}>
                {pendingLeaves.slice(0, 4).map((request) => (
                  <div key={request.leaveRequestID} className="hr-surface-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.leave.includes(request.leaveRequestID)}
                          onChange={() => toggleItemSelection('leave', request.leaveRequestID)}
                          style={{ marginTop: 4 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{request.employeeName || `Employee #${request.employeeID}`}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t(request.leaveType)} • {request.startDate} → {request.endDate}</div>
                        </div>
                      </div>
                      <Badge label={t(request.status)} color={STATUS_COLORS[request.status] || 'gray'} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 10 }}>{request.reason}</div>
                    <Textarea
                      label={t('Review Note')}
                      value={notes[`leave-${request.leaveRequestID}`] || ''}
                      onChange={(e) => setNoteValue(`leave-${request.leaveRequestID}`, e.target.value)}
                      placeholder={t('approval.rejectHint')}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn onClick={() => handleLeaveReview(request.leaveRequestID, 'Approved')} disabled={savingId === `leave-${request.leaveRequestID}-Approved`}>
                        {savingId === `leave-${request.leaveRequestID}-Approved` ? t('Saving...') : t('Approve')}
                      </Btn>
                      <Btn variant="ghost" onClick={() => handleLeaveReview(request.leaveRequestID, 'Rejected')} disabled={savingId === `leave-${request.leaveRequestID}-Rejected`}>
                        {savingId === `leave-${request.leaveRequestID}-Rejected` ? t('Saving...') : t('Reject')}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-table-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Expense claims')}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {renderBulkToolbar('expense', pendingExpenses, 'claimID', [
                  { status: 'Approved', label: 'Bulk Approve' },
                  { status: 'Reimbursed', label: 'Bulk Reimburse', variant: 'accent' },
                ])}
                <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/expenses'))}>{t('Open full queue')}</Btn>
              </div>
            </div>
            {pendingExpenses.length === 0 ? renderSectionEmpty('No submitted expense claims waiting for review.') : (
              <div style={{ display: 'grid', gap: 10 }}>
                {pendingExpenses.slice(0, 4).map((item) => (
                  <div key={item.claimID} className="hr-surface-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.expense.includes(item.claimID)}
                          onChange={() => toggleItemSelection('expense', item.claimID)}
                          style={{ marginTop: 4 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{item.employeeName || item.employeeID} • {t(item.category)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <strong style={{ color: 'var(--red)' }}>{formatAmount(item.amount)}</strong>
                        <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 10 }}>{item.description || t('No additional description.')}</div>
                    <Textarea
                      label={t('Review Note')}
                      value={notes[`expense-${item.claimID}`] || ''}
                      onChange={(e) => setNoteValue(`expense-${item.claimID}`, e.target.value)}
                      placeholder={t('approval.rejectHint')}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn variant="ghost" onClick={() => handleExpenseReview(item.claimID, 'Rejected')} disabled={savingId === `expense-${item.claimID}-Rejected`}>
                        {savingId === `expense-${item.claimID}-Rejected` ? t('Saving...') : t('Reject')}
                      </Btn>
                      <Btn variant="accent" onClick={() => handleExpenseReview(item.claimID, 'Reimbursed')} disabled={savingId === `expense-${item.claimID}-Reimbursed`}>
                        {savingId === `expense-${item.claimID}-Reimbursed` ? t('Saving...') : t('Reimbursed')}
                      </Btn>
                      <Btn onClick={() => handleExpenseReview(item.claimID, 'Approved')} disabled={savingId === `expense-${item.claimID}-Approved`}>
                        {savingId === `expense-${item.claimID}-Approved` ? t('Saving...') : t('Approve')}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-table-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Document requests')}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {renderBulkToolbar('document', pendingDocuments, 'requestID', [
                  { status: 'In Progress', label: 'Mark In Progress', variant: 'accent' },
                  { status: 'Issued', label: 'Bulk Issue' },
                ])}
                <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/documents'))}>{t('Open full queue')}</Btn>
              </div>
            </div>
            {pendingDocuments.length === 0 ? renderSectionEmpty('No document requests need action right now.') : (
              <div style={{ display: 'grid', gap: 10 }}>
                {pendingDocuments.slice(0, 4).map((item) => (
                  <div key={item.requestID} className="hr-surface-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.document.includes(item.requestID)}
                          onChange={() => toggleItemSelection('document', item.requestID)}
                          style={{ marginTop: 4 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{t(item.documentType)}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{item.employeeName || item.employeeID} • {item.purpose}</div>
                        </div>
                      </div>
                      <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                    </div>
                    <Textarea
                      label={t('HR Note')}
                      value={notes[`document-${item.requestID}`] || ''}
                      onChange={(e) => setNoteValue(`document-${item.requestID}`, e.target.value)}
                      placeholder={t('approval.rejectHint')}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn variant="ghost" onClick={() => handleDocumentUpdate(item.requestID, 'Declined')} disabled={savingId === `document-${item.requestID}-Declined`}>
                        {savingId === `document-${item.requestID}-Declined` ? t('Saving...') : t('Decline')}
                      </Btn>
                      <Btn variant="accent" onClick={() => handleDocumentUpdate(item.requestID, 'In Progress')} disabled={savingId === `document-${item.requestID}-In Progress`}>
                        {savingId === `document-${item.requestID}-In Progress` ? t('Saving...') : t('In Progress')}
                      </Btn>
                      <Btn onClick={() => handleDocumentUpdate(item.requestID, 'Issued')} disabled={savingId === `document-${item.requestID}-Issued`}>
                        {savingId === `document-${item.requestID}-Issued` ? t('Saving...') : t('Issue')}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-table-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Active tickets')}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {renderBulkToolbar('ticket', activeTickets, 'ticketID', [
                  { status: 'In Progress', label: 'Mark In Progress', variant: 'accent' },
                ])}
                <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/tickets'))}>{t('Open full queue')}</Btn>
              </div>
            </div>
            {activeTickets.length === 0 ? renderSectionEmpty('No active support tickets right now.') : (
              <div style={{ display: 'grid', gap: 10 }}>
                {activeTickets.slice(0, 4).map((item) => (
                  <div key={item.ticketID} className="hr-surface-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.ticket.includes(item.ticketID)}
                          onChange={() => toggleItemSelection('ticket', item.ticketID)}
                          style={{ marginTop: 4 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.subject}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{item.employeeName || item.employeeID} • {t(item.priority)}</div>
                        </div>
                      </div>
                      <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 10 }}>{item.description || t('No description provided.')}</div>
                    <Textarea
                      label={t('Resolution Note')}
                      value={notes[`ticket-${item.ticketID}`] || ''}
                      onChange={(e) => setNoteValue(`ticket-${item.ticketID}`, e.target.value)}
                      placeholder={t('Add progress notes or final resolution')}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn variant="accent" onClick={() => handleTicketUpdate(item.ticketID, 'In Progress')} disabled={savingId === `ticket-${item.ticketID}-In Progress`}>
                        {savingId === `ticket-${item.ticketID}-In Progress` ? t('Saving...') : t('In Progress')}
                      </Btn>
                      <Btn onClick={() => handleTicketUpdate(item.ticketID, 'Resolved')} disabled={savingId === `ticket-${item.ticketID}-Resolved`}>
                        {savingId === `ticket-${item.ticketID}-Resolved` ? t('Saving...') : t('Resolve')}
                      </Btn>
                      <Btn variant="ghost" onClick={() => handleTicketUpdate(item.ticketID, 'Closed')} disabled={savingId === `ticket-${item.ticketID}-Closed`}>
                        {savingId === `ticket-${item.ticketID}-Closed` ? t('Saving...') : t('Close')}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
