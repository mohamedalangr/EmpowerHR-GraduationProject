import { useEffect, useMemo, useState } from 'react';
import { getPredictions, hrCreateActionPlan, hrGetActionPlans, hrGetInsights, hrGetIntelligence, hrGetRecognitionWatch, hrUpdateActionPlanStatus, runPrediction } from '../../api/index.js';
import { Spinner, Btn, useToast } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';

const RISK_COLORS = { High: '#E8321A', Medium: '#F59E0B', Low: '#22C55E' };
const RISK_BG = { High: '#FFF0ED', Medium: '#FFF7ED', Low: '#F0FDF4' };
const EMPTY_RECOGNITION_WATCH = { summary: {}, categoryBreakdown: [], followUpItems: [] };

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

export function HRDashboardPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const formatCurrency = (value) => new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
  const [predictions, setPredictions] = useState([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [hasRun, setHasRun] = useState(false);
  const [insights, setInsights] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [recognitionWatch, setRecognitionWatch] = useState(EMPTY_RECOGNITION_WATCH);
  const [actionPlans, setActionPlans] = useState([]);
  const [actionPlanSavingKey, setActionPlanSavingKey] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const loadInsights = async ({ showSuccess = false } = {}) => {
    setLoadingInsights(true);
    try {
      const [insightData, intelligenceData, recognitionData, latestPredictions, planData] = await Promise.all([
        hrGetInsights(),
        hrGetIntelligence().catch(() => null),
        hrGetRecognitionWatch().catch(() => EMPTY_RECOGNITION_WATCH),
        getPredictions().catch(() => []),
        hrGetActionPlans().catch(() => []),
      ]);
      setInsights(insightData || null);
      setIntelligence(intelligenceData || null);
      setRecognitionWatch(recognitionData && typeof recognitionData === 'object' ? recognitionData : EMPTY_RECOGNITION_WATCH);
      setActionPlans(Array.isArray(planData) ? planData : []);
      if (Array.isArray(latestPredictions) && latestPredictions.length) {
        setPredictions(latestPredictions);
        setHasRun(true);
      }
      if (showSuccess) {
        toast(t('Insights refreshed.'));
      }
    } catch (error) {
      toast(error.message || 'Failed to load workforce insights', 'error');
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const data = await runPrediction();
      if (data.error) throw new Error(data.error);
      setPredictions(data.predictions || []);
      setFormTitle(data.formTitle || '');
      setLastRun(new Date());
      setHasRun(true);
      toast(`Prediction complete -- ${data.totalProcessed} employees analysed`);
    } catch (e) {
      toast('Prediction failed: ' + e.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const sorted = [...predictions].sort((a, b) => b.riskScore - a.riskScore);
  const high = sorted.filter((p) => p.riskLevel === 'High').length;
  const medium = sorted.filter((p) => p.riskLevel === 'Medium').length;
  const low = sorted.filter((p) => p.riskLevel === 'Low').length;
  const spotlightPredictions = sorted.filter((p) => p.riskLevel !== 'Low').slice(0, 6);
  const insightCards = spotlightPredictions.length ? spotlightPredictions : sorted.slice(0, 3);
  const totals = insights?.totals || {};
  const departmentBreakdown = insights?.departmentBreakdown || [];
  const reviewSummary = insights?.reviewSummary || {};
  const goalSummary = insights?.goalSummary || {};
  const trainingSummary = insights?.trainingSummary || {};
  const successionSummary = insights?.successionSummary || {};
  const attendanceSummary = insights?.attendanceSummary || {};
  const leaveSummary = insights?.leaveSummary || {};
  const payrollSummary = insights?.payrollSummary || {};
  const expenseSummary = insights?.expenseSummary || {};
  const documentSummary = insights?.documentSummary || {};
  const ticketSummary = insights?.ticketSummary || {};
  const recognitionSummary = recognitionWatch?.summary || {};
  const recognitionCategoryBreakdown = recognitionWatch?.categoryBreakdown || [];
  const recognitionFollowUpItems = recognitionWatch?.followUpItems || [];
  const intelligenceOverview = intelligence?.overview || {};
  const intelligenceTrends = intelligence?.trends || {};
  const priorityQueue = intelligence?.priorityQueue || [];
  const openActionPlans = actionPlans.filter((item) => item.status !== 'Done');
  const openPlanEmployeeIds = useMemo(
    () => new Set(openActionPlans.map((item) => String(item.employeeID || ''))),
    [openActionPlans],
  );
  const highRiskWithoutPlans = useMemo(
    () => sorted.filter((item) => item.riskLevel === 'High' && !openPlanEmployeeIds.has(String(item.employeeID || ''))),
    [openPlanEmployeeIds, sorted],
  );

  const recognitionTone = (state) => {
    if (state === 'Recognition Gap') return { color: '#B42318', bg: '#FFF1F3' };
    if (state === 'Reignite Recognition') return { color: '#B54708', bg: '#FFFAEB' };
    if (state === 'Check-In Due') return { color: '#175CD3', bg: '#EFF8FF' };
    return { color: '#027A48', bg: '#ECFDF3' };
  };

  const buildRetentionPlanPayload = (item, sourceLabel) => {
    const fallbackTitle = `${item.fullName || item.employeeName || item.employeeID} - ${t('Retention follow-up')}`;
    const primaryAction = (item.recommendedActions || [])[0] || t('Schedule a proactive 1:1 check-in and monitor next cycle signals.');
    const driverSummary = (item.riskDrivers || []).slice(0, 2).map((driver) => t(driver.title)).join(', ');
    const riskMetric = item.riskScore != null ? `${Math.round((item.riskScore || 0) * 100)}%` : `${item.priorityScore ?? 0}`;
    return {
      employeeID: item.employeeID,
      title: primaryAction.slice(0, 150) || fallbackTitle,
      description: [
        `${t('Source')}: ${sourceLabel}`,
        `${t('Risk Level')}: ${t(item.riskLevel || 'Medium')}`,
        `${t('Priority score')}: ${riskMetric}`,
        driverSummary ? `${t('Key Drivers')}: ${driverSummary}` : null,
        item.explanationSummary || '',
      ].filter(Boolean).join(' | '),
      priority: item.riskLevel === 'High' ? 'High' : 'Medium',
      status: 'To Do',
      progress: 0,
    };
  };

  const createRetentionPlan = async (item, sourceLabel = t('Priority Queue')) => {
    if (!item?.employeeID) return;
    if (openPlanEmployeeIds.has(String(item.employeeID))) {
      toast(t('An open action plan already exists for this employee.'), 'error');
      return;
    }

    setActionPlanSavingKey(`plan-${item.employeeID}`);
    try {
      await hrCreateActionPlan(buildRetentionPlanPayload(item, sourceLabel));
      const refreshed = await hrGetActionPlans().catch(() => []);
      setActionPlans(Array.isArray(refreshed) ? refreshed : []);
      toast(t('Retention action plan created.'));
    } catch (error) {
      toast(error.message || t('Could not create action plan.'), 'error');
    } finally {
      setActionPlanSavingKey(null);
    }
  };

  const handleCreateHighRiskPlans = async () => {
    const candidates = highRiskWithoutPlans.slice(0, 5);
    if (!candidates.length) {
      toast(t('All high-risk employees already have open plans.'));
      return;
    }

    setActionPlanSavingKey('bulk-high-risk');
    try {
      await Promise.all(candidates.map((item) => hrCreateActionPlan(buildRetentionPlanPayload(item, t('Attrition Risk')))));
      const refreshed = await hrGetActionPlans().catch(() => []);
      setActionPlans(Array.isArray(refreshed) ? refreshed : []);
      toast(`${candidates.length} ${t('retention plans created.')}`);
    } catch (error) {
      toast(error.message || t('Could not create action plans.'), 'error');
    } finally {
      setActionPlanSavingKey(null);
    }
  };

  const handleCreateActionPlanFromQueue = async (item) => {
    await createRetentionPlan(item, t('Priority Queue'));
  };

  const handleUpdateActionPlan = async (plan, targetStatus) => {
    if (!plan?.taskID) return;
    setActionPlanSavingKey(`status-${plan.taskID}`);
    try {
      const payload = {
        status: targetStatus,
        progress: targetStatus === 'Done' ? 100 : targetStatus === 'In Progress' ? Math.max(plan.progress || 0, 35) : plan.progress || 0,
      };
      await hrUpdateActionPlanStatus(plan.taskID, payload);
      const refreshed = await hrGetActionPlans().catch(() => []);
      setActionPlans(Array.isArray(refreshed) ? refreshed : []);
      toast(t('Action plan updated.'));
    } catch (error) {
      toast(error.message || t('Could not update action plan.'), 'error');
    } finally {
      setActionPlanSavingKey(null);
    }
  };

  const handleExport = (format = 'csv') => {
    try {
      const dateLabel = new Date().toISOString().slice(0, 10);
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        totals,
        attendanceSummary,
        leaveSummary,
        payrollSummary,
        reviewSummary,
        goalSummary,
        trainingSummary,
        expenseSummary,
        documentSummary,
        ticketSummary,
        recognitionSummary,
        successionSummary,
        attritionPredictions: sorted,
      };

      if (format === 'json') {
        downloadTextFile(`hr-dashboard-${dateLabel}.json`, JSON.stringify(exportPayload, null, 2), 'application/json;charset=utf-8');
      } else {
        const rows = [
          ['Section', 'Metric', 'Value'],
          ['Workforce', 'Total Employees', totals.totalEmployees ?? 0],
          ['Workforce', 'Active Employees', totals.activeEmployees ?? 0],
          ['Attendance', 'Completion Rate', `${attendanceSummary.completionRate ?? 0}%`],
          ['Leave', 'Pending Requests', leaveSummary.pendingCount ?? 0],
          ['Payroll', 'Total Net Pay', payrollSummary.totalNetPay ?? 0],
          ['Reviews', 'Average Rating', reviewSummary.averageRating ?? 0],
          ['Goals', 'Average Progress', goalSummary.averageProgress ?? 0],
          ['Expenses', 'Submitted Amount', expenseSummary.submittedAmount ?? 0],
          ['Documents', 'Issued Count', documentSummary.issuedCount ?? 0],
          ['Tickets', 'Open Count', ticketSummary.openCount ?? 0],
          ['Recognition', 'Awards Shared', recognitionSummary.totalAwards ?? 0],
          ['Recognition', 'This Month', recognitionSummary.recognizedThisMonth ?? 0],
          ['Recognition', 'Employees Without Recognition', recognitionSummary.employeesWithoutRecognition ?? 0],
          ['Recognition', 'Stale Recognition', recognitionSummary.staleRecognitionCount ?? 0],
        ];

        if (recognitionFollowUpItems.length) {
          rows.push([]);
          rows.push(['Recognition Follow-Up', 'Employee', 'State', 'Summary']);
          recognitionFollowUpItems.forEach((item) => {
            rows.push([
              'Recognition Follow-Up',
              item.employeeName || item.employeeID || '—',
              item.followUpState || 'Needs Follow-Up',
              item.summary || '',
            ]);
          });
        }

        if (sorted.length) {
          rows.push([]);
          rows.push(['Attrition', 'Employee', 'Risk Level', 'Risk Score', 'AI Summary']);
          sorted.forEach((item) => {
            rows.push([
              'Attrition',
              item.fullName || item.employeeName || item.employeeID || '—',
              item.riskLevel || '—',
              Math.round((item.riskScore || 0) * 100),
              item.explanationSummary || '',
            ]);
          });
        }

        const csv = rows
          .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\n');
        downloadTextFile(`hr-dashboard-${dateLabel}.csv`, csv, 'text/csv;charset=utf-8');
      }

      toast(t('Dashboard snapshot exported.'));
    } catch (error) {
      toast(t('Could not export dashboard snapshot.'), 'error');
    }
  };

  const workforceCards = useMemo(() => ([
    { label: t('nav.employees'), value: totals.totalEmployees ?? '—', accent: '#111827', sub: `${totals.activeEmployees ?? 0} ${t('active')}` },
    { label: t('nav.attendance'), value: `${attendanceSummary.completionRate ?? 0}%`, accent: '#E8321A', sub: `${attendanceSummary.presentCount ?? 0} ${t('present')} · ${leaveSummary.pendingCount ?? 0} ${t('pending leave')}` },
    { label: t('nav.payroll'), value: payrollSummary.recordsProcessed ?? '—', accent: '#7C3AED', sub: `${payrollSummary.paidRecords ?? 0} ${t('paid')} · ${payrollSummary.draftRecords ?? 0} ${t('pending')}` },
    { label: t('nav.training'), value: `${totals.trainingCompletionRate ?? 0}%`, accent: '#10B981', sub: `${trainingSummary.completedLearners ?? 0}/${trainingSummary.assignedLearners ?? 0} ${t('learners complete')}` },
  ]), [totals, trainingSummary, attendanceSummary, leaveSummary, payrollSummary, t]);

  return (
    <div className="hr-page-shell">
      <div className="hr-page-header is-split">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.dashboard.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {t('page.dashboard.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={() => loadInsights({ showSuccess: true })}>{t('Refresh Insights')}</Btn>
          <Btn variant="outline" onClick={() => handleExport('csv')}>{t('Export CSV')}</Btn>
          <Btn variant="accent" onClick={() => handleExport('json')}>{t('Export JSON')}</Btn>
        </div>
      </div>

      {loadingInsights ? (
        <div style={{ textAlign: 'center', padding: 50 }}><Spinner /></div>
      ) : (
        <>
          <div className="hr-stats-grid">
            {workforceCards.map((card) => (
              <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.accent }}>{card.value}</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.2fr .8fr', marginBottom: 28 }}>
            <div className="hr-table-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Department Mix')}</h3>
              </div>
              {departmentBreakdown.length === 0 ? (
                <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No employee department data yet.')}</div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {departmentBreakdown.map((item) => (
                    <div key={item.department} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{t(item.department || 'Unassigned')}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{Math.round((item.count / Math.max(totals.totalEmployees || 1, 1)) * 100)}% {t('of workforce')}</div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{item.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Performance Snapshot')}</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Average Rating')}</span><strong>{reviewSummary.averageRating ?? 0}/5</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Submitted Reviews')}</span><strong>{reviewSummary.submittedReviews ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Ready Soon Successors')}</span><strong>{successionSummary.readySoon ?? 0}</strong></div>
                </div>
              </div>
              <div className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Talent Planning')}</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Active Plans')}</span><strong>{successionSummary.activePlans ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('High Risk Plans')}</span><strong>{successionSummary.highRiskPlans ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Ready Now')}</span><strong>{totals.readyNowSuccessors ?? 0}</strong></div>
                </div>
              </div>
            </div>
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 28 }}>
            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Attendance & Leave Health')}</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  { label: 'Present', value: attendanceSummary.presentCount ?? 0, color: '#16A34A' },
                  { label: 'Partial', value: attendanceSummary.partialCount ?? 0, color: '#F59E0B' },
                  { label: 'Clocked In', value: attendanceSummary.clockedInCount ?? 0, color: '#2563EB' },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12.5 }}>
                      <span>{t(item.label)}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(((item.value || 0) / Math.max(totals.totalEmployees || 1, 1)) * 100, 100)}%`, background: item.color }} />
                    </div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 4 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF7ED', color: '#9A3412' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Pending')}</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{leaveSummary.pendingCount ?? 0}</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#ECFDF3', color: '#027A48' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Approved')}</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{leaveSummary.approvedCount ?? 0}</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF1F3', color: '#BE123C' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Rejected')}</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{leaveSummary.rejectedCount ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Payroll Snapshot')}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Total Net Pay')}</span><strong>{formatCurrency(payrollSummary.totalNetPay ?? 0)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Paid This Cycle')}</span><strong>{formatCurrency(payrollSummary.paidNetPay ?? 0)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Pending Payroll')}</span><strong>{formatCurrency(payrollSummary.pendingNetPay ?? 0)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Average Net Pay')}</span><strong>{formatCurrency(payrollSummary.averageNetPay ?? 0)}</strong></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#EEF4FF', color: '#1D4ED8' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Paid Records')}</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{payrollSummary.paidRecords ?? 0}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F5F3FF', color: '#6D28D9' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Draft Records')}</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{payrollSummary.draftRecords ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 28 }}>
            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Operations Pulse')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFF7ED', color: '#C2410C' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Expense claims')}</div>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{expenseSummary.submittedCount ?? 0}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: '#EEF6FF', color: '#1D4ED8' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Document Requests')}</div>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{documentSummary.pendingCount ?? 0}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFF1F3', color: '#BE123C' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Support Queue')}</div>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{ticketSummary.openCount ?? 0}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Submitted Amount')}</span><strong>{formatCurrency(expenseSummary.submittedAmount ?? 0)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Issued Documents')}</span><strong>{documentSummary.issuedCount ?? 0}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Critical Tickets')}</span><strong>{ticketSummary.criticalOpenCount ?? 0}</strong></div>
              </div>
            </div>

            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Goal Health')}</div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12.5 }}>
                    <span>{t('Average Goal Progress')}</span>
                    <strong>{goalSummary.averageProgress ?? 0}%</strong>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(goalSummary.averageProgress ?? 0, 100)}%`, background: '#10B981' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#ECFDF3', color: '#027A48' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Completed Goals')}</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{goalSummary.completedGoals ?? 0}</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#EEF6FF', color: '#1D4ED8' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Reimbursed Amount')}</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(expenseSummary.reimbursedAmount ?? 0)}</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F5F3FF', color: '#6D28D9' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Resolved')}</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{ticketSummary.resolvedCount ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 28 }}>
            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Recognition Pulse')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Awards Shared', value: recognitionSummary.totalAwards ?? 0, color: '#4338CA', bg: '#EEF2FF' },
                  { label: 'This Month', value: recognitionSummary.recognizedThisMonth ?? 0, color: '#027A48', bg: '#ECFDF3' },
                  { label: 'Stale recognition', value: recognitionSummary.staleRecognitionCount ?? 0, color: '#B54708', bg: '#FFFAEB' },
                  { label: 'Employees without recognition', value: recognitionSummary.employeesWithoutRecognition ?? 0, color: '#B42318', bg: '#FFF1F3' },
                ].map((item) => (
                  <div key={item.label} style={{ borderRadius: 12, padding: '10px 12px', background: item.bg }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: item.color }}>{t(item.label)}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: item.color, marginTop: 6 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Employees recognized')}</span><strong>{recognitionSummary.recognizedEmployees ?? 0}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Points Granted')}</span><strong>{recognitionSummary.totalPoints ?? 0}</strong></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Category Snapshot')}</div>
                {recognitionCategoryBreakdown.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Recognition cadence is healthy this cycle.')}</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recognitionCategoryBreakdown.slice(0, 4).map((item) => (
                      <div key={item.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{t(item.category || 'Achievement')}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{item.recentCount ?? 0} {t('This Month')} · {item.employeeCount ?? 0} {t('Employee')}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>{item.count ?? 0}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{item.points ?? 0} {t('Points')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Recognition Follow-Up')}</div>
                <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{recognitionSummary.followUpCount ?? 0} {t('follow-up')}</span>
              </div>
              {recognitionFollowUpItems.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Recognition cadence is healthy this cycle.')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {recognitionFollowUpItems.slice(0, 5).map((item) => {
                    const tone = recognitionTone(item.followUpState);
                    return (
                      <div key={`${item.employeeID}-${item.followUpState}`} style={{ border: '1px solid #EEF0F3', borderRadius: 12, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{item.employeeName || item.employeeID}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{item.jobTitle || '—'} · {item.department || '—'}</div>
                          </div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11.5, fontWeight: 700 }}>
                            {t(item.followUpState || 'Needs Follow-Up')}
                          </span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--gray-600)' }}>{item.summary}</div>
                        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--gray-500)' }}>
                          {t('Awards Shared')}: {item.recognitionCount ?? 0} · {t('Points Granted')}: {item.totalPoints ?? 0}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 28 }}>
            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('People Intelligence Board')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF1F3', color: '#BE123C' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Follow-up Employees')}</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{intelligenceOverview.followUpCount ?? 0}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF7ED', color: '#B45309' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Predicted Coverage')}</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{intelligenceOverview.coveragePct ?? 0}%</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF3C7', color: '#92400E' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('High + Medium Risk')}</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{(intelligenceOverview.highRisk ?? 0) + (intelligenceOverview.mediumRisk ?? 0)}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#EEF2FF', color: '#4338CA' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase' }}>{t('Monitored Employees')}</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{intelligenceOverview.predictedEmployees ?? 0}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('Risk pressure trend')}</span>
                  <strong style={{ color: (intelligenceTrends.riskPressurePct ?? 0) > 0 ? '#B42318' : '#027A48' }}>{(intelligenceTrends.riskPressurePct ?? 0) > 0 ? '+' : ''}{intelligenceTrends.riskPressurePct ?? 0}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('Support load trend')}</span>
                  <strong style={{ color: (intelligenceTrends.supportLoadPct ?? 0) > 0 ? '#B45309' : '#027A48' }}>{(intelligenceTrends.supportLoadPct ?? 0) > 0 ? '+' : ''}{intelligenceTrends.supportLoadPct ?? 0}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('Leave pressure trend')}</span>
                  <strong style={{ color: (intelligenceTrends.leavePressurePct ?? 0) > 0 ? '#B45309' : '#027A48' }}>{(intelligenceTrends.leavePressurePct ?? 0) > 0 ? '+' : ''}{intelligenceTrends.leavePressurePct ?? 0}%</strong>
                </div>
              </div>
            </div>

            <div className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Priority Queue')}</div>
                <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{t('Top 5 employees')}</span>
              </div>
              {priorityQueue.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No priority follow-up employees right now.')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {priorityQueue.slice(0, 5).map((item) => (
                    <div key={item.employeeID} style={{ border: '1px solid #EEF0F3', borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{item.fullName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{item.jobTitle || '—'} · {item.department || '—'}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: RISK_COLORS[item.riskLevel] || 'var(--gray-500)' }}>{t(item.riskLevel)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: '#B45309', background: '#FFFBEB', borderRadius: 999, padding: '4px 8px' }}>{t('Open tickets')}: {item.openTickets ?? 0}</span>
                        <span style={{ fontSize: 11, color: '#BE123C', background: '#FFF1F3', borderRadius: 999, padding: '4px 8px' }}>{t('Pending leave')}: {item.pendingLeave ?? 0}</span>
                        <span style={{ fontSize: 11, color: '#334155', background: '#F8FAFC', borderRadius: 999, padding: '4px 8px' }}>{t('Priority score')}: {item.priorityScore ?? 0}</span>
                      </div>
                      {(item.recommendedActions || []).length > 0 && (
                        <div style={{ marginTop: 7, fontSize: 12, color: 'var(--gray-600)' }}>
                          {t(item.recommendedActions[0])}
                        </div>
                      )}
                      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                        <Btn
                          size="sm"
                          variant={openPlanEmployeeIds.has(String(item.employeeID)) ? 'ghost' : 'outline'}
                          disabled={Boolean(actionPlanSavingKey) || openPlanEmployeeIds.has(String(item.employeeID))}
                          onClick={() => handleCreateActionPlanFromQueue(item)}
                        >
                          {openPlanEmployeeIds.has(String(item.employeeID))
                            ? t('Plan Exists')
                            : actionPlanSavingKey === `plan-${item.employeeID}`
                              ? t('Creating...')
                              : t('Create Plan')}
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Action Plan Tracker')}</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{t('Track execution of follow-up actions generated from intelligence signals.')}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('Open plans')}: {openActionPlans.length}</span>
            </div>
            {actionPlans.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No action plans yet. Create one from the priority queue.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {actionPlans.slice(0, 6).map((plan) => (
                  <div key={plan.taskID} style={{ border: '1px solid #EEF0F3', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{plan.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{plan.employeeName || plan.employeeID} · {t(plan.priority || 'Medium')} · {t(plan.status || 'To Do')}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {plan.status !== 'In Progress' && plan.status !== 'Done' && (
                          <Btn size="sm" variant="ghost" disabled={Boolean(actionPlanSavingKey)} onClick={() => handleUpdateActionPlan(plan, 'In Progress')}>
                            {actionPlanSavingKey === `status-${plan.taskID}` ? t('Saving...') : t('Start')}
                          </Btn>
                        )}
                        {plan.status !== 'Done' && (
                          <Btn size="sm" variant="accent" disabled={Boolean(actionPlanSavingKey)} onClick={() => handleUpdateActionPlan(plan, 'Done')}>
                            {actionPlanSavingKey === `status-${plan.taskID}` ? t('Saving...') : t('Mark Done')}
                          </Btn>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(plan.progress || 0, 100)}%`, background: plan.status === 'Done' ? '#16A34A' : '#E8321A' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="hr-page-header is-split" style={{ marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t('Attrition Risk')}</h3>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>{t('Run predictions based on the latest completed feedback submissions.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn
            variant="outline"
            onClick={handleCreateHighRiskPlans}
            disabled={Boolean(actionPlanSavingKey) || highRiskWithoutPlans.length === 0}
            style={{ minWidth: 190 }}
          >
            {actionPlanSavingKey === 'bulk-high-risk'
              ? <><Spinner size={16} />&nbsp;{t('Creating...')}</>
              : <>{t('Create High-Risk Plans')}</>}
          </Btn>
          <Btn onClick={handleRun} disabled={running} style={{ minWidth: 160 }}>
            {running ? <><Spinner size={16} />&nbsp;{t('Running...')}</> : <>{t('Run Prediction')}</>}
          </Btn>
          {lastRun && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6, textAlign: 'right' }}>
              {t('Last run')}: {lastRun.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US')} {formTitle && `— ${formTitle}`}
            </div>
          )}
        </div>
      </div>

      <div className="hr-stats-grid">
        {[
          { label: t('High Risk'), value: high, color: 'var(--red)', bg: 'var(--red-light)' },
          { label: t('Medium Risk'), value: medium, color: '#F59E0B', bg: '#FFF7ED' },
          { label: t('Low Risk'), value: low, color: '#22C55E', bg: '#F0FDF4' },
        ].map((s) => (
          <div key={s.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{hasRun ? s.value : '—'}</div>
          </div>
        ))}
      </div>

      {!hasRun ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No attrition results yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Use Run Prediction to analyse the current workforce risk profile.')}</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No submission data available')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Complete feedback submissions are required before attrition analysis can run.')}</p>
        </div>
      ) : (
        <>
          <div className="hr-surface-card" style={{ padding: 18, marginBottom: 18, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#92400E', marginBottom: 6 }}>{t('Priority Retention Signals')}</div>
                <p style={{ margin: 0, fontSize: 13.5, color: '#78350F' }}>
                  {high > 0
                    ? t('Focus first on high-risk employees, then use the recommended actions to guide follow-up.')
                    : t('Use the AI summaries below to keep moderate-risk employees engaged before issues grow.')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '5px 10px', fontWeight: 700 }}>
                  {t('High-risk without plan')}: {highRiskWithoutPlans.length}
                </span>
                <span style={{ fontSize: 11.5, color: '#166534', background: '#ECFDF3', borderRadius: 999, padding: '5px 10px', fontWeight: 700 }}>
                  {t('Open plans')}: {openActionPlans.length}
                </span>
              </div>
            </div>
          </div>

          <div className="hr-table-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)' }}>
                  {['Employee', 'Job Title', 'Department', 'Team', 'Risk Level', 'Risk Score', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const pct = Math.round((p.riskScore || 0) * 100);
                  const color = RISK_COLORS[p.riskLevel] || 'var(--gray-500)';
                  const bg = RISK_BG[p.riskLevel] || 'var(--gray-100)';
                  return (
                    <tr key={p.predictionID || i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.fullName || p.employeeName || p.employeeID}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{p.employeeID}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 6, maxWidth: 320, lineHeight: 1.5 }}>
                          {t(p.explanationSummary || 'AI summary unavailable for this prediction.')}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{p.jobTitle || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                      <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{p.department || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                      <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{p.team || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: bg, color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                          {t(p.riskLevel)}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden', maxWidth: 120 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .8s' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <Btn
                          size="sm"
                          variant={openPlanEmployeeIds.has(String(p.employeeID)) ? 'ghost' : 'outline'}
                          disabled={Boolean(actionPlanSavingKey) || openPlanEmployeeIds.has(String(p.employeeID))}
                          onClick={() => createRetentionPlan(p, t('Attrition Risk'))}
                        >
                          {openPlanEmployeeIds.has(String(p.employeeID))
                            ? t('Plan Exists')
                            : actionPlanSavingKey === `plan-${p.employeeID}`
                              ? t('Creating...')
                              : t('Create Follow-up')}
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 18 }}>
            {insightCards.map((p, i) => {
              const pct = Math.round((p.riskScore || 0) * 100);
              const color = RISK_COLORS[p.riskLevel] || 'var(--gray-500)';
              const bg = RISK_BG[p.riskLevel] || 'var(--gray-100)';
              return (
                <div key={`insight-${p.predictionID || i}`} className="hr-surface-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.fullName || p.employeeName || p.employeeID}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p.jobTitle || '—'} • {p.department || '—'}</div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg, color }}>
                      {t(p.riskLevel)} · {pct}%
                    </span>
                  </div>

                  <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--gray-600)', lineHeight: 1.55 }}>
                    {t(p.explanationSummary || 'AI summary unavailable for this prediction.')}
                  </p>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>
                    {t(p.feedbackSummary || '')}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>{t('Key Drivers')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {(p.riskDrivers || []).length ? (p.riskDrivers || []).slice(0, 3).map((driver, index) => {
                      const driverColor = driver.severity === 'high' ? '#B42318' : driver.severity === 'medium' ? '#B54708' : '#027A48';
                      const driverBg = driver.severity === 'high' ? '#FFF1F3' : driver.severity === 'medium' ? '#FFF7ED' : '#ECFDF3';
                      return (
                        <span key={`${driver.title}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: driverBg, color: driverColor, fontSize: 12, fontWeight: 700 }}>
                          {t(driver.title)}
                        </span>
                      );
                    }) : (
                      <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No strong drivers available for this prediction yet.')}</span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>{t('Main Risk Points')}</div>
                  <ul style={{ margin: '0 0 14px', paddingInlineStart: 18, display: 'grid', gap: 6, color: 'var(--gray-700)', fontSize: 13 }}>
                    {(p.mainRiskPoints || []).length ? (p.mainRiskPoints || []).slice(0, 3).map((point, index) => (
                      <li key={`${point}-${index}`}>{t(point)}</li>
                    )) : (
                      <li>{t('No strong drivers available for this prediction yet.')}</li>
                    )}
                  </ul>

                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>{t('HR Action Plan')}</div>
                  <ul style={{ margin: '0 0 12px', paddingInlineStart: 18, display: 'grid', gap: 6, color: 'var(--gray-700)', fontSize: 13 }}>
                    {(p.hrActionPlan || p.recommendedActions || []).length ? (p.hrActionPlan || p.recommendedActions || []).slice(0, 3).map((action, index) => (
                      <li key={`hr-${action}-${index}`}>{t(action)}</li>
                    )) : (
                      <li>{t('No recommended actions generated yet.')}</li>
                    )}
                  </ul>

                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>{t('Admin Action Plan')}</div>
                  <ul style={{ margin: 0, paddingInlineStart: 18, display: 'grid', gap: 6, color: 'var(--gray-700)', fontSize: 13 }}>
                    {(p.adminActionPlan || []).length ? (p.adminActionPlan || []).slice(0, 3).map((action, index) => (
                      <li key={`admin-${action}-${index}`}>{t(action)}</li>
                    )) : (
                      <li>{t('No recommended actions generated yet.')}</li>
                    )}
                  </ul>

                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: openPlanEmployeeIds.has(String(p.employeeID)) ? '#027A48' : 'var(--gray-500)', fontWeight: 600 }}>
                      {openPlanEmployeeIds.has(String(p.employeeID)) ? t('Open retention plan already active') : t('Ready for follow-up automation')}
                    </span>
                    <Btn
                      size="sm"
                      variant={openPlanEmployeeIds.has(String(p.employeeID)) ? 'ghost' : 'outline'}
                      disabled={Boolean(actionPlanSavingKey) || openPlanEmployeeIds.has(String(p.employeeID))}
                      onClick={() => createRetentionPlan(p, t('Attrition Risk'))}
                    >
                      {openPlanEmployeeIds.has(String(p.employeeID))
                        ? t('Plan Exists')
                        : actionPlanSavingKey === `plan-${p.employeeID}`
                          ? t('Creating...')
                          : t('Create Follow-up Plan')}
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
