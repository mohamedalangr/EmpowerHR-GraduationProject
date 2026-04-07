import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrGetExpenseWatch, hrGetExpenses, hrReviewExpenseClaim } from '../../api/index.js';
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
  Submitted: 'orange',
  Approved: 'green',
  Rejected: 'red',
  Reimbursed: 'accent',
};

const WATCH_COLORS = {
  'Overdue Review': 'red',
  'Needs Review': 'orange',
  'Awaiting Reimbursement': 'yellow',
  Approved: 'green',
  Reimbursed: 'accent',
};

const EMPTY_WATCH = {
  summary: {},
  categoryBreakdown: [],
  followUpItems: [],
};

export function HRExpensesPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [claims, setClaims] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const [data, watchData] = await Promise.all([
        hrGetExpenses(),
        hrGetExpenseWatch().catch(() => EMPTY_WATCH),
      ]);
      const list = Array.isArray(data) ? data : [];
      setClaims(list);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
      const nextNotes = {};
      list.forEach((item) => {
        nextNotes[item.claimID] = item.reviewNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load expense claims', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const categoryBreakdown = watch?.categoryBreakdown || [];

  const stats = useMemo(() => ({
    total: watchSummary.totalClaims ?? claims.length,
    submitted: watchSummary.submittedCount ?? claims.filter((item) => item.status === 'Submitted').length,
    approvedAmount: claims
      .filter((item) => ['Approved', 'Reimbursed'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    followUp: watchSummary.followUpCount ?? 0,
  }), [claims, watchSummary]);

  const expensePulseCards = useMemo(() => ([
    {
      label: t('Review Queue'),
      value: stats.submitted,
      note: t('Claims waiting for a decision before reimbursement can move forward.'),
      accent: '#E8321A',
    },
    {
      label: t('Overdue Reviews'),
      value: watchSummary.overdueCount ?? 0,
      note: t('Submissions that have stayed open longer than the expected SLA.'),
      accent: '#F59E0B',
    },
    {
      label: t('Spend Categories'),
      value: categoryBreakdown.length,
      note: t('Expense categories represented in the current reimbursement queue.'),
      accent: '#2563EB',
    },
    {
      label: t('Reimbursement Watch'),
      value: followUpItems.length,
      note: t('Claims that still need review notes, action, or final payout handling.'),
      accent: '#7C3AED',
    },
  ]), [categoryBreakdown.length, followUpItems.length, stats.submitted, t, watchSummary.overdueCount]);

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Claims', watchSummary.totalClaims ?? claims.length, ''],
        ['Summary', 'Submitted', watchSummary.submittedCount ?? 0, ''],
        ['Summary', 'Approved', watchSummary.approvedCount ?? 0, ''],
        ['Summary', 'Reimbursed', watchSummary.reimbursedCount ?? 0, ''],
        ['Summary', 'Overdue Review', watchSummary.overdueCount ?? 0, ''],
      ];

      if (categoryBreakdown.length) {
        rows.push([]);
        rows.push(['Categories', 'Category', 'Count', 'Submitted / Amount']);
        categoryBreakdown.forEach((item) => {
          rows.push([
            'Categories',
            item.category,
            item.count ?? 0,
            `submitted ${item.submittedCount ?? 0} | approved ${item.approvedCount ?? 0} | amount ${item.amount ?? 0}`,
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
            `${item.title || ''} | ${item.category || ''} | ${item.amount ?? 0} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`expense-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Expense watch exported.'));
    } catch {
      toast(t('Failed to export expense watch.'), 'error');
    }
  };

  const handleReview = async (claimID, status) => {
    setSavingId(`${claimID}-${status}`);
    try {
      await hrReviewExpenseClaim(claimID, { status, note: notes[claimID] || '' });
      toast(`Claim ${status.toLowerCase()}`);
      await loadClaims();
    } catch (error) {
      toast(error.message || 'Failed to update expense claim', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'تعويضات المصروفات' : 'Expense Reimbursements'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {language === 'ar' ? 'راجع طلبات المصروفات المقدمة من الموظفين وأدر قرارات الموافقة أو التعويض.' : 'Review employee expense submissions and manage approval or reimbursement decisions.'}
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/benefits'))}>{t('nav.benefits')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/payroll'))}>{t('nav.payroll')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Claims'), value: stats.total, color: '#111827' },
            { label: t('Awaiting Review'), value: stats.submitted, color: '#E8321A' },
            { label: t('Approved Value'), value: `$${stats.approvedAmount.toFixed(2)}`, color: '#10B981' },
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
        {expensePulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Claims', value: stats.total, accent: '#111827' },
          { label: 'Awaiting Review', value: stats.submitted, accent: '#E8321A' },
          { label: 'Approved Value', value: `$${stats.approvedAmount.toFixed(2)}`, accent: '#10B981' },
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
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Expense Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Highlight claims waiting too long for review or reimbursement.')}</div>
            </div>
            <Badge label={`${watchSummary.overdueCount ?? 0} ${t('overdue')}`} color={(watchSummary.overdueCount ?? 0) > 0 ? 'red' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No expense follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.claimID} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Expense follow-up')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.title} · {t(item.category)}</div>
                    </div>
                    <Badge label={t(item.followUpState || item.status)} color={WATCH_COLORS[item.followUpState] || STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Badge label={t(item.category)} color="accent" />
                    <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 4 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    ${Number(item.amount || 0).toFixed(2)} · {item.ageDays ?? 0} {t('days open')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Category Snapshot')}</div>
          {categoryBreakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No expense summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {categoryBreakdown.map((item) => (
                <div key={item.category} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{t(item.category)}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.count ?? 0}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.submittedCount ?? 0} {t('submitted')} · {item.approvedCount ?? 0} {t('approved')} · ${Number(item.amount ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hr-table-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Expense Queue')}</h3>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : claims.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No expense claims in the queue.')}</div>
        ) : (
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            {claims.map((item) => (
              <div key={item.claimID} className="hr-surface-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                      {item.employeeName || item.employeeID} • {item.department || '—'} • {t(item.category)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 800, color: 'var(--red)' }}>${Number(item.amount || 0).toFixed(2)}</div>
                    <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                </div>

                <div style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 10 }}>
                  {item.description || t('No additional description.')}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                  <Textarea
                    label={t('Review Note')}
                    value={notes[item.claimID] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.claimID]: e.target.value }))}
                    placeholder={t('Optional note for the employee')}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant="ghost" onClick={() => handleReview(item.claimID, 'Rejected')} disabled={savingId === `${item.claimID}-Rejected`}>
                      {savingId === `${item.claimID}-Rejected` ? t('Saving...') : t('Reject')}
                    </Btn>
                    <Btn variant="accent" onClick={() => handleReview(item.claimID, 'Reimbursed')} disabled={savingId === `${item.claimID}-Reimbursed`}>
                      {savingId === `${item.claimID}-Reimbursed` ? t('Saving...') : t('Reimbursed')}
                    </Btn>
                    <Btn onClick={() => handleReview(item.claimID, 'Approved')} disabled={savingId === `${item.claimID}-Approved`}>
                      {savingId === `${item.claimID}-Approved` ? t('Saving...') : t('Approve')}
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
