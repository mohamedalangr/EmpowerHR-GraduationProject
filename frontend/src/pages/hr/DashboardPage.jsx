import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPredictions,
  hrCreateActionPlan,
  hrGetActionPlans,
  hrGetApprovalSnapshot,
  hrGetAttendanceWatch,
  hrGetBenefitWatch,
  hrGetDocumentWatch,
  hrGetExpenseWatch,
  hrGetInsights,
  hrGetIntelligence,
  hrGetJobPipelineHealth,
  hrGetOnboardingWatch,
  hrGetPayrollWatch,
  hrGetPolicyCompliance,
  hrGetRecognitionWatch,
  hrGetSuccessionWatch,
  hrGetTicketWatch,
  hrGetTrainingCompliance,
  hrUpdateActionPlanStatus,
  runPrediction,
} from '../../api/index.js';
import { Spinner, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const RISK_COLORS = { High: '#E8321A', Medium: '#F59E0B', Low: '#22C55E' };
const RISK_BG = { High: '#FFF0ED', Medium: '#FFF7ED', Low: '#F0FDF4' };
const EMPTY_RECOGNITION_WATCH = { summary: {}, categoryBreakdown: [], followUpItems: [] };
const EMPTY_FOLLOW_UP_WATCH = { summary: {}, followUpItems: [] };
const EMPTY_OPERATION_WATCHES = {
  approvals: { summary: {}, followUpItems: [] },
  attendance: EMPTY_FOLLOW_UP_WATCH,
  payroll: EMPTY_FOLLOW_UP_WATCH,
  benefits: EMPTY_FOLLOW_UP_WATCH,
  expenses: EMPTY_FOLLOW_UP_WATCH,
  documents: EMPTY_FOLLOW_UP_WATCH,
  tickets: EMPTY_FOLLOW_UP_WATCH,
  training: EMPTY_FOLLOW_UP_WATCH,
  succession: EMPTY_FOLLOW_UP_WATCH,
  onboarding: EMPTY_FOLLOW_UP_WATCH,
  recruitment: { totals: {}, followUpItems: [] },
  policy: { summary: {}, followUpItems: [] },
};

const getFollowUpItems = (data) => {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.followUpItems)) return data.followUpItems;
  if (Array.isArray(data.escalationItems)) return data.escalationItems;
  if (Array.isArray(data.priorityItems)) return data.priorityItems;
  return [];
};

const getActionStateTone = (value = '') => {
  const normalized = String(value || '').toLowerCase();
  if (/(critical|overdue|stale|high|blocked|escalated)/.test(normalized)) return 'red';
  if (/(pending|due soon|at risk|open shift|waiting|follow up)/.test(normalized)) return 'yellow';
  if (/(active|interview|in progress|scheduled)/.test(normalized)) return 'accent';
  if (/(healthy|on track|approved|done|resolved|enrolled|complete)/.test(normalized)) return 'green';
  return 'gray';
};

const getActionPriority = (item = {}) => {
  const normalized = [
    item.followUpState,
    item.dueState,
    item.status,
    item.slaState,
    item.priority,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(critical|overdue|stale|high|blocked|escalated)/.test(normalized)) return 4;
  if (/(pending|due soon|at risk|open|waiting|follow up)/.test(normalized)) return 3;
  if (/(active|interview|in progress|scheduled)/.test(normalized)) return 2;
  return 1;
};

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
  const { resolvePath } = useAuth();
  const navigate = useNavigate();
  const formatCurrency = (value) => {
    const preferredCurrency = typeof document !== 'undefined'
      ? (document.documentElement.dataset.currencyPreference || 'EGP')
      : 'EGP';
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: preferredCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  };
  const [predictions, setPredictions] = useState([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [hasRun, setHasRun] = useState(false);
  const [insights, setInsights] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [recognitionWatch, setRecognitionWatch] = useState(EMPTY_RECOGNITION_WATCH);
  const [operationsWatches, setOperationsWatches] = useState(EMPTY_OPERATION_WATCHES);
  const [actionPlans, setActionPlans] = useState([]);
  const [actionPlanSavingKey, setActionPlanSavingKey] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const loadInsights = async ({ showSuccess = false } = {}) => {
    setLoadingInsights(true);
    try {
      const [
        insightData,
        intelligenceData,
        recognitionData,
        latestPredictions,
        planData,
        approvalData,
        attendanceWatchData,
        payrollWatchData,
        benefitWatchData,
        expenseWatchData,
        documentWatchData,
        ticketWatchData,
        trainingComplianceData,
        successionWatchData,
        onboardingWatchData,
        recruitmentHealthData,
        policyComplianceData,
      ] = await Promise.all([
        hrGetInsights(),
        hrGetIntelligence().catch(() => null),
        hrGetRecognitionWatch().catch(() => EMPTY_RECOGNITION_WATCH),
        getPredictions().catch(() => []),
        hrGetActionPlans().catch(() => []),
        hrGetApprovalSnapshot().catch(() => EMPTY_OPERATION_WATCHES.approvals),
        hrGetAttendanceWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetPayrollWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetBenefitWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetExpenseWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetDocumentWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetTicketWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetTrainingCompliance().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetSuccessionWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetOnboardingWatch().catch(() => EMPTY_FOLLOW_UP_WATCH),
        hrGetJobPipelineHealth().catch(() => EMPTY_OPERATION_WATCHES.recruitment),
        hrGetPolicyCompliance().catch(() => EMPTY_OPERATION_WATCHES.policy),
      ]);
      setInsights(insightData || null);
      setIntelligence(intelligenceData || null);
      setRecognitionWatch(recognitionData && typeof recognitionData === 'object' ? recognitionData : EMPTY_RECOGNITION_WATCH);
      setOperationsWatches({
        approvals: approvalData && typeof approvalData === 'object' ? approvalData : EMPTY_OPERATION_WATCHES.approvals,
        attendance: attendanceWatchData && typeof attendanceWatchData === 'object' ? attendanceWatchData : EMPTY_FOLLOW_UP_WATCH,
        payroll: payrollWatchData && typeof payrollWatchData === 'object' ? payrollWatchData : EMPTY_FOLLOW_UP_WATCH,
        benefits: benefitWatchData && typeof benefitWatchData === 'object' ? benefitWatchData : EMPTY_FOLLOW_UP_WATCH,
        expenses: expenseWatchData && typeof expenseWatchData === 'object' ? expenseWatchData : EMPTY_FOLLOW_UP_WATCH,
        documents: documentWatchData && typeof documentWatchData === 'object' ? documentWatchData : EMPTY_FOLLOW_UP_WATCH,
        tickets: ticketWatchData && typeof ticketWatchData === 'object' ? ticketWatchData : EMPTY_FOLLOW_UP_WATCH,
        training: trainingComplianceData && typeof trainingComplianceData === 'object' ? trainingComplianceData : EMPTY_FOLLOW_UP_WATCH,
        succession: successionWatchData && typeof successionWatchData === 'object' ? successionWatchData : EMPTY_FOLLOW_UP_WATCH,
        onboarding: onboardingWatchData && typeof onboardingWatchData === 'object' ? onboardingWatchData : EMPTY_FOLLOW_UP_WATCH,
        recruitment: recruitmentHealthData && typeof recruitmentHealthData === 'object' ? recruitmentHealthData : EMPTY_OPERATION_WATCHES.recruitment,
        policy: policyComplianceData && typeof policyComplianceData === 'object' ? policyComplianceData : EMPTY_OPERATION_WATCHES.policy,
      });
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
  const recognitionGapCount = recognitionSummary.employeesWithoutRecognition ?? recognitionFollowUpItems.filter((item) => item.followUpState === 'Recognition Gap').length;
  const reigniteCount = recognitionFollowUpItems.filter((item) => item.followUpState === 'Reignite Recognition').length;
  const checkInDueCount = recognitionFollowUpItems.filter((item) => item.followUpState === 'Check-In Due').length;
  const recognitionSpotlights = useMemo(() => {
    const stateRank = { 'Recognition Gap': 3, 'Reignite Recognition': 2, 'Check-In Due': 1 };
    return [...recognitionFollowUpItems]
      .sort((a, b) => (stateRank[b.followUpState] || 0) - (stateRank[a.followUpState] || 0)
        || Number(b.daysSinceRecognition || 0) - Number(a.daysSinceRecognition || 0)
        || String(a.employeeName || '').localeCompare(String(b.employeeName || '')))
      .slice(0, 4);
  }, [recognitionFollowUpItems]);
  const recognitionMomentumMap = useMemo(() => {
    return [...recognitionCategoryBreakdown]
      .sort((a, b) => Number(b.recentCount || 0) - Number(a.recentCount || 0)
        || Number(b.points || 0) - Number(a.points || 0)
        || Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 4);
  }, [recognitionCategoryBreakdown]);
  const recognitionPlaybook = useMemo(() => {
    const plays = [];

    if (recognitionGapCount > 0) {
      plays.push({
        title: t('Spotlight employees with no recognition history'),
        note: t('Start with employees who have never been recognized so the recognition program feels inclusive across the workforce.'),
      });
    }
    if ((recognitionSummary.staleRecognitionCount ?? 0) > 0 || reigniteCount > 0) {
      plays.push({
        title: t('Reignite stale appreciation'),
        note: t('Teams with recognition silence should get fresh shout-outs or manager check-ins before momentum fades further.'),
      });
    }
    if (checkInDueCount > 0) {
      plays.push({
        title: t('Schedule quick recognition check-ins'),
        note: t('Employees who have gone quiet recently are good candidates for a timely thank-you or coaching conversation.'),
      });
    }
    if (recognitionMomentumMap.length > 0) {
      plays.push({
        title: t('Reuse the strongest recognition themes'),
        note: t('Lift the recognition categories with the best recent momentum and share those examples with managers.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Keep recognition momentum steady'),
      note: t('Recognition activity looks healthy, so keep the current peer and manager appreciation rhythm in place.'),
    }];
  }, [checkInDueCount, recognitionGapCount, recognitionMomentumMap, recognitionSummary.staleRecognitionCount, reigniteCount, t]);
  const recognitionStrongestSignal = recognitionGapCount > 0
    ? t('Some employees still have no recognition history, so the fastest culture win is widening appreciation coverage.')
    : (recognitionSummary.staleRecognitionCount ?? 0) > 0
      ? t('Recognition has gone stale for part of the workforce, so fresh manager shout-outs should be the next action.')
      : t('Recognition momentum looks healthy; keep consistent appreciation visible across teams to sustain it.');
  const intelligenceOverview = intelligence?.overview || {};
  const intelligenceTrends = intelligence?.trends || {};
  const priorityQueue = intelligence?.priorityQueue || [];
  const openActionPlans = actionPlans.filter((item) => item.status !== 'Done');
  const actionCenterServices = useMemo(() => ([
    {
      key: 'approvals',
      label: t('Approvals'),
      path: resolvePath('/hr/approvals'),
      accent: '#E8321A',
      note: t('Leave, payroll, and reimbursement decisions waiting for sign-off.'),
      count: operationsWatches.approvals?.summary?.pendingCount
        ?? operationsWatches.approvals?.summary?.pendingApprovals
        ?? getFollowUpItems(operationsWatches.approvals).length,
      items: getFollowUpItems(operationsWatches.approvals),
    },
    {
      key: 'attendance',
      label: t('Attendance'),
      path: resolvePath('/hr/attendance'),
      accent: '#F59E0B',
      note: t('Open shifts, partial days, and leave cases that still need action.'),
      count: operationsWatches.attendance?.summary?.followUpCount ?? getFollowUpItems(operationsWatches.attendance).length,
      items: getFollowUpItems(operationsWatches.attendance),
    },
    {
      key: 'recruitment',
      label: t('Recruitment'),
      path: resolvePath('/hr/jobs'),
      accent: '#2563EB',
      note: t('Stale candidates or hiring bottlenecks across live roles.'),
      count: operationsWatches.recruitment?.totals?.staleCandidates ?? getFollowUpItems(operationsWatches.recruitment).length,
      items: getFollowUpItems(operationsWatches.recruitment),
    },
    {
      key: 'payroll',
      label: t('Payroll'),
      path: resolvePath('/hr/payroll'),
      accent: '#7C3AED',
      note: t('Draft or overdue payroll items waiting for release checks.'),
      count: operationsWatches.payroll?.summary?.followUpCount ?? operationsWatches.payroll?.summary?.draftCount ?? getFollowUpItems(operationsWatches.payroll).length,
      items: getFollowUpItems(operationsWatches.payroll),
    },
    {
      key: 'benefits',
      label: t('Benefits'),
      path: resolvePath('/hr/benefits'),
      accent: '#0F766E',
      note: t('Enrollments, renewals, or coverage updates needing HR follow-up.'),
      count: operationsWatches.benefits?.summary?.followUpCount ?? getFollowUpItems(operationsWatches.benefits).length,
      items: getFollowUpItems(operationsWatches.benefits),
    },
    {
      key: 'expenses',
      label: t('Expenses'),
      path: resolvePath('/hr/expenses'),
      accent: '#C2410C',
      note: t('Claims and reimbursements still waiting for review or payout.'),
      count: operationsWatches.expenses?.summary?.followUpCount ?? getFollowUpItems(operationsWatches.expenses).length,
      items: getFollowUpItems(operationsWatches.expenses),
    },
    {
      key: 'documents',
      label: t('Documents'),
      path: resolvePath('/hr/documents'),
      accent: '#1D4ED8',
      note: t('Issuance requests that are delayed or still in progress.'),
      count: operationsWatches.documents?.summary?.followUpCount ?? getFollowUpItems(operationsWatches.documents).length,
      items: getFollowUpItems(operationsWatches.documents),
    },
    {
      key: 'tickets',
      label: t('Support Tickets'),
      path: resolvePath('/hr/tickets'),
      accent: '#BE123C',
      note: t('Critical support issues or aging employee requests needing attention.'),
      count: operationsWatches.tickets?.summary?.followUpCount ?? getFollowUpItems(operationsWatches.tickets).length,
      items: getFollowUpItems(operationsWatches.tickets),
    },
    {
      key: 'training',
      label: t('Training'),
      path: resolvePath('/hr/training'),
      accent: '#15803D',
      note: t('Mandatory learning items at risk or already overdue.'),
      count: operationsWatches.training?.summary?.atRiskAssignments ?? getFollowUpItems(operationsWatches.training).length,
      items: getFollowUpItems(operationsWatches.training),
    },
    {
      key: 'succession',
      label: t('Succession'),
      path: resolvePath('/hr/succession'),
      accent: '#9333EA',
      note: t('Succession or retention readiness items needing a decision.'),
      count: operationsWatches.succession?.summary?.followUpCount ?? getFollowUpItems(operationsWatches.succession).length,
      items: getFollowUpItems(operationsWatches.succession),
    },
    {
      key: 'onboarding',
      label: t('Onboarding'),
      path: resolvePath('/hr/onboarding'),
      accent: '#0891B2',
      note: t('New-hire onboarding plans that are blocked or behind schedule.'),
      count: operationsWatches.onboarding?.summary?.followUpCount ?? getFollowUpItems(operationsWatches.onboarding).length,
      items: getFollowUpItems(operationsWatches.onboarding),
    },
    {
      key: 'policy',
      label: t('Policies'),
      path: resolvePath('/hr/policies'),
      accent: '#475467',
      note: t('Outstanding acknowledgements or compliance reminders needing outreach.'),
      count: operationsWatches.policy?.summary?.pendingAcknowledgements ?? getFollowUpItems(operationsWatches.policy).length,
      items: getFollowUpItems(operationsWatches.policy),
    },
  ]), [operationsWatches, resolvePath, t]);
  const actionCenterItems = useMemo(() => (
    actionCenterServices
      .flatMap((service) => service.items.slice(0, 4).map((item, index) => {
        const state = item.followUpState || item.dueState || item.status || item.slaState || item.priority || t('Needs review');
        const waitingLabel = Number.isFinite(Number(item.waitingDays)) ? `${item.waitingDays} ${t('days waiting')}` : null;
        const meta = [
          item.department,
          item.jobTitle,
          item.category,
          item.benefitName,
          item.documentType,
          item.reviewStage,
          item.date,
          item.dueDate,
          waitingLabel,
        ].filter(Boolean).slice(0, 3).join(' · ');

        return {
          id: `${service.key}-${item.employeeID || item.employeeName || item.jobID || item.jobTitle || item.ticketID || item.requestID || item.courseID || index}`,
          serviceLabel: service.label,
          path: service.path,
          title: item.employeeName || item.candidateName || item.jobTitle || item.title || item.benefitName || item.documentType || item.policyTitle || t('Follow-up item'),
          summary: item.summary || item.recommendedAction || item.recommendedActions?.[0] || t('Review this item and follow up from the linked workspace.'),
          state,
          meta,
          priority: getActionPriority(item),
        };
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8)
  ), [actionCenterServices, t]);
  const urgentActionCount = actionCenterItems.filter((item) => item.priority >= 3).length;
  const activeQueueCount = actionCenterServices.filter((item) => Number(item.count || 0) > 0 || item.items.length > 0).length;
  const reviewOrderServices = useMemo(
    () => [...actionCenterServices].sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 5),
    [actionCenterServices],
  );
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

  const handleExportActionCenter = () => {
    if (!actionCenterItems.length) {
      toast(t('No operations alerts to export.'), 'error');
      return;
    }

    try {
      const dateLabel = new Date().toISOString().slice(0, 10);
      const rows = [
        ['Service', 'Title', 'State', 'Details', 'Path'],
        ...actionCenterItems.map((item) => ([
          item.serviceLabel,
          item.title,
          item.state,
          `${item.meta || ''} | ${item.summary || ''}`.trim(),
          item.path,
        ])),
      ];

      const csv = rows
        .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      downloadTextFile(`hr-operations-command-center-${dateLabel}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Operations queue exported.'));
    } catch {
      toast(t('Could not export the operations queue.'), 'error');
    }
  };

  const workforceCards = useMemo(() => ([
    { label: t('nav.employees'), value: totals.totalEmployees ?? '—', accent: '#111827', sub: `${totals.activeEmployees ?? 0} ${t('active')}` },
    { label: t('nav.attendance'), value: `${attendanceSummary.completionRate ?? 0}%`, accent: '#E8321A', sub: `${attendanceSummary.presentCount ?? 0} ${t('present')} · ${leaveSummary.pendingCount ?? 0} ${t('pending leave')}` },
    { label: t('nav.payroll'), value: payrollSummary.recordsProcessed ?? '—', accent: '#7C3AED', sub: `${payrollSummary.paidRecords ?? 0} ${t('paid')} · ${payrollSummary.draftRecords ?? 0} ${t('pending')}` },
    { label: t('nav.training'), value: `${totals.trainingCompletionRate ?? 0}%`, accent: '#10B981', sub: `${trainingSummary.completedLearners ?? 0}/${trainingSummary.assignedLearners ?? 0} ${t('learners complete')}` },
  ]), [totals, trainingSummary, attendanceSummary, leaveSummary, payrollSummary, t]);

  const dashboardPulseCards = useMemo(() => ([
    {
      label: t('Urgent Alerts'),
      value: urgentActionCount,
      note: `${activeQueueCount} ${t('service queues currently need attention')}`,
      accent: '#B42318',
    },
    {
      label: t('Open Action Plans'),
      value: openActionPlans.length,
      note: `${highRiskWithoutPlans.length} ${t('high-risk employees still need a plan')}`,
      accent: '#E8321A',
    },
    {
      label: t('Priority Queue'),
      value: priorityQueue.length,
      note: t('AI-suggested follow-up items ready for review.'),
      accent: '#7C3AED',
    },
    {
      label: t('Recognition Coverage'),
      value: recognitionSummary.recognizedThisMonth ?? 0,
      note: `${recognitionSummary.employeesWithoutRecognition ?? 0} ${t('employees without recent recognition')}`,
      accent: '#2563EB',
    },
  ]), [activeQueueCount, highRiskWithoutPlans.length, openActionPlans.length, priorityQueue.length, recognitionSummary.employeesWithoutRecognition, recognitionSummary.recognizedThisMonth, t, urgentActionCount]);

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
          <div className="workspace-journey-strip">
            {dashboardPulseCards.map((card) => (
              <div key={card.label} className="workspace-journey-card">
                <div className="workspace-journey-title">{card.label}</div>
                <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
                <div className="workspace-journey-note">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="hr-stats-grid">
            {workforceCards.map((card) => (
              <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.accent }}>{card.value}</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="hr-surface-card" style={{ padding: 20, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Recognition Momentum Radar')}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring recognition gaps, stale appreciation, and category momentum into one engagement review layer for HR leaders.')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge color={recognitionGapCount > 0 ? 'red' : 'green'} label={`${t('Recognition gaps')} ${recognitionGapCount}`} />
                <Badge color={(recognitionSummary.staleRecognitionCount ?? 0) > 0 ? 'orange' : 'gray'} label={`${t('Stale recognition')} ${recognitionSummary.staleRecognitionCount ?? 0}`} />
              </div>
            </div>

            <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
              {[
                {
                  label: t('Recognition Gaps'),
                  value: recognitionGapCount,
                  note: t('Employees with no recognition history who should be visible in the next appreciation cycle.'),
                  accent: recognitionGapCount > 0 ? '#B42318' : '#22C55E',
                },
                {
                  label: t('Reignite Recognition'),
                  value: reigniteCount,
                  note: t('Employees whose recognition momentum has gone stale and may need a fresh thank-you.'),
                  accent: reigniteCount > 0 ? '#F59E0B' : '#22C55E',
                },
                {
                  label: t('This Month'),
                  value: recognitionSummary.recognizedThisMonth ?? 0,
                  note: t('Recognition activity already recorded this month across the organization.'),
                  accent: '#2563EB',
                },
                {
                  label: t('Points Granted'),
                  value: recognitionSummary.totalPoints ?? 0,
                  note: t('Current points shared through the recognition program so far.'),
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

            <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 0 }}>
              <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Recognition Spotlight Queue')}</div>
                  <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{recognitionSpotlights.length} {t('items')}</span>
                </div>
                {recognitionSpotlights.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Recognition cadence is healthy this cycle.')}</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {recognitionSpotlights.map((item) => {
                      const tone = recognitionTone(item.followUpState);
                      return (
                        <div key={`radar-${item.employeeID}-${item.followUpState}`} className="workspace-action-card">
                          <div className="workspace-action-eyebrow">{t('Recognition spotlight')}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{item.employeeName || item.employeeID}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{item.jobTitle || '—'} · {item.department || '—'}</div>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11.5, fontWeight: 700 }}>
                              {t(item.followUpState || 'Needs Follow-Up')}
                            </span>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--gray-700)' }}>{item.summary}</div>
                          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--gray-500)' }}>
                            {t('Awards Shared')}: {item.recognitionCount ?? 0} · {t('Points Granted')}: {item.totalPoints ?? 0}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Recognition Playbook')}</div>
                  <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
                    <div className="workspace-focus-label">{t('Strongest Signal')}</div>
                    <div className="workspace-focus-note">{recognitionStrongestSignal}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {recognitionPlaybook.map((item) => (
                      <div key={item.title} className="workspace-focus-card" style={{ background: '#fff' }}>
                        <div className="workspace-focus-label">{item.title}</div>
                        <div className="workspace-focus-note">{item.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Recognition Momentum Map')}</div>
                  {recognitionMomentumMap.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Recognition cadence is healthy this cycle.')}</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {recognitionMomentumMap.map((item) => (
                        <div key={`momentum-${item.category}`} style={{ padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid #E4E7EC' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <strong>{t(item.category || 'Achievement')}</strong>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{item.count ?? 0}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.recentCount ?? 0} {t('This Month')} · {item.employeeCount ?? 0} {t('Employee')}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--gray-700)', marginTop: 4 }}>{item.points ?? 0} {t('Points')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Operations Command Center')}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', maxWidth: 760 }}>
                  {t('Review the highest-priority HR queues from one place and jump straight into the right workspace for action.')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge color={urgentActionCount > 0 ? 'red' : 'green'} label={`${urgentActionCount} ${t('urgent alerts')}`} />
                <Btn size="sm" variant="ghost" onClick={handleExportActionCenter}>{t('Export Queue CSV')}</Btn>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
              {actionCenterServices.slice(0, 8).map((service) => (
                <button
                  key={service.key}
                  type="button"
                  onClick={() => navigate(service.path)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid #E4E7EC',
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{service.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: service.accent, margin: '6px 0 4px' }}>{service.count ?? 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.45 }}>{service.note}</div>
                </button>
              ))}
            </div>

            <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 0 }}>
              <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Priority Follow-Ups')}</div>
                  <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{actionCenterItems.length} {t('items')}</span>
                </div>
                {actionCenterItems.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No cross-service alerts are active right now.')}</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {actionCenterItems.map((item) => (
                      <div key={item.id} className="workspace-action-card">
                        <div className="workspace-action-eyebrow">{item.serviceLabel}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{item.title}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.meta || t('Open the related workspace for full details.')}</div>
                          </div>
                          <Badge color={getActionStateTone(item.state)} label={item.state} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--gray-700)' }}>{item.summary}</div>
                        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                          <Btn size="sm" variant="ghost" onClick={() => navigate(item.path)}>{t('Open Queue')}</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div className="hr-surface-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Queue Health')}</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {[
                      { label: t('Active queues'), value: activeQueueCount },
                      { label: t('Urgent follow-ups'), value: urgentActionCount },
                      { label: t('Open plans'), value: openActionPlans.length },
                      { label: t('Priority employees'), value: priorityQueue.length },
                    ].map((item) => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E4E7EC' }}>
                        <span style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hr-surface-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Recommended Review Order')}</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {reviewOrderServices.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('All queues look clear right now.')}</div>
                    ) : reviewOrderServices.map((service) => (
                      <button
                        key={`order-${service.key}`}
                        type="button"
                        onClick={() => navigate(service.path)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: '1px solid #E4E7EC',
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gray-900)' }}>{service.label}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{service.note}</div>
                        </div>
                        <strong style={{ color: service.accent }}>{service.count ?? 0}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
                    <div key={item.department} className="workspace-action-card" style={{ margin: '8px 12px 0' }}>
                      <div className="workspace-action-eyebrow">{t('Department view')}</div>
                      <div className="workspace-action-card-head">
                        <div>
                          <div style={{ fontWeight: 700 }}>{t(item.department || 'Unassigned')}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{Math.round((item.count / Math.max(totals.totalEmployees || 1, 1)) * 100)}% {t('of workforce')}</div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{item.count}</div>
                      </div>
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
                      <div key={`${item.employeeID}-${item.followUpState}`} className="workspace-action-card">
                        <div className="workspace-action-eyebrow">{t('Recognition follow-up')}</div>
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
                    <div key={item.employeeID} className="workspace-action-card">
                      <div className="workspace-action-eyebrow">{t('Priority employee')}</div>
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
                  <div key={plan.taskID} className="workspace-action-card">
                    <div className="workspace-action-eyebrow">{t('Execution plan')}</div>
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
