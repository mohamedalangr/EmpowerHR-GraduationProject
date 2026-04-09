import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreatePayroll, hrGetPayroll, hrGetPayrollWatch, hrMarkPayrollPaid } from '../../api/index.js';
import { Badge, Btn, EmployeeProfileSummary, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  employeeID: '',
  payPeriod: new Date().toISOString().slice(0, 7),
  currency: 'EGP',
  baseSalary: '',
  allowances: '0',
  deductions: '0',
  bonus: '0',
  notes: '',
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

const formatMoney = (value, language = 'en', currency = 'EGP') => {
  const number = Number(value || 0);
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: currency || 'EGP',
    minimumFractionDigits: 2,
  }).format(number);
};

const summarizeCurrencyTotals = (items = [], valueSelector = (item) => Number(item?.netPay || 0)) => {
  const totals = items.reduce((acc, item) => {
    const currency = item?.currency || 'EGP';
    acc[currency] = (acc[currency] || 0) + Number(valueSelector(item) || 0);
    return acc;
  }, {});

  return Object.entries(totals).map(([currency, amount]) => ({ currency, amount }));
};

const formatCurrencyTotals = (totals = [], language = 'en') => {
  if (!totals.length) return formatMoney(0, language, 'EGP');
  return totals.map((entry) => formatMoney(entry.amount, language, entry.currency)).join(' • ');
};

const WATCH_COLORS = {
  'Overdue Release': 'red',
  'Ready to Release': 'orange',
  'Payment Date Missing': 'yellow',
  Draft: 'orange',
  Paid: 'green',
};

const EMPTY_WATCH = {
  summary: {},
  departmentBreakdown: [],
  followUpItems: [],
};

const getPayrollTone = (item) => {
  if (item?.followUpState === 'Overdue Release') return 'red';
  if (item?.followUpState === 'Ready to Release' || item?.status === 'Draft') return 'orange';
  if (item?.followUpState === 'Payment Date Missing') return 'yellow';
  if (item?.status === 'Paid') return 'green';
  return 'accent';
};

export function HRPayrollPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const [data, watchData] = await Promise.all([
        hrGetPayroll(),
        hrGetPayrollWatch().catch(() => EMPTY_WATCH),
      ]);
      setRecords(Array.isArray(data) ? data : []);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
    } catch (error) {
      toast(error.message || 'Failed to load payroll records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const departmentBreakdown = watch?.departmentBreakdown || [];

  const stats = useMemo(() => ({
    totalRecords: watchSummary.totalRecords ?? records.length,
    pendingCount: watchSummary.draftCount ?? records.filter((item) => item.status !== 'Paid').length,
    followUpCount: watchSummary.followUpCount ?? 0,
  }), [records, watchSummary]);

  const overdueCount = watchSummary.overdueCount ?? followUpItems.filter((item) => item.followUpState === 'Overdue Release').length;
  const readyToReleaseCount = followUpItems.filter((item) => item.followUpState === 'Ready to Release').length;
  const paymentDateMissingCount = followUpItems.filter((item) => item.followUpState === 'Payment Date Missing').length;
  const paidTotals = useMemo(() => summarizeCurrencyTotals(records.filter((item) => item.status === 'Paid')), [records]);
  const pendingTotals = useMemo(() => summarizeCurrencyTotals(records.filter((item) => item.status !== 'Paid')), [records]);
  const averagePendingTotals = useMemo(() => {
    const grouped = records.reduce((acc, item) => {
      if (item.status === 'Paid') return acc;
      const currency = item?.currency || 'EGP';
      const entry = acc[currency] || { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += Number(item.netPay || 0);
      acc[currency] = entry;
      return acc;
    }, {});

    return Object.entries(grouped).map(([currency, entry]) => ({
      currency,
      amount: entry.count ? entry.amount / entry.count : 0,
    }));
  }, [records]);
  const averagePendingValue = formatCurrencyTotals(averagePendingTotals, language);
  const payrollReleaseQueue = useMemo(() => {
    const stateRank = { 'Overdue Release': 3, 'Payment Date Missing': 2, 'Ready to Release': 1 };
    return [...followUpItems]
      .sort((a, b) => (stateRank[b.followUpState] || 0) - (stateRank[a.followUpState] || 0)
        || Number(b.ageDays || 0) - Number(a.ageDays || 0)
        || Number(b.netPay || 0) - Number(a.netPay || 0))
      .slice(0, 4);
  }, [followUpItems]);
  const payrollPressureMap = useMemo(() => {
    const grouped = records.reduce((acc, item) => {
      const department = item.department || 'Unassigned';
      const currency = item.currency || 'EGP';
      const entry = acc[department] || {
        department,
        count: 0,
        draftCount: 0,
        paidCount: 0,
        currencyTotals: {},
      };

      entry.count += 1;
      if (item.status === 'Paid') {
        entry.paidCount += 1;
      } else {
        entry.draftCount += 1;
      }

      const bucket = entry.currencyTotals[currency] || { currency, pendingAmount: 0, totalAmount: 0 };
      bucket.totalAmount += Number(item.netPay || 0);
      if (item.status !== 'Paid') {
        bucket.pendingAmount += Number(item.netPay || 0);
      }
      entry.currencyTotals[currency] = bucket;
      acc[department] = entry;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => Number(b.draftCount || 0) - Number(a.draftCount || 0)
        || Number(b.count || 0) - Number(a.count || 0)
        || String(a.department || '').localeCompare(String(b.department || '')))
      .slice(0, 4)
      .map((entry) => ({
        ...entry,
        currencyTotals: Object.values(entry.currencyTotals || {}),
      }));
  }, [records]);
  const payrollPlaybook = useMemo(() => {
    const plays = [];

    if (overdueCount > 0) {
      plays.push({
        title: t('Release overdue payroll first'),
        note: t('Start with overdue payroll runs so employee pay confidence does not slip before the next pay cycle.'),
      });
    }
    if (readyToReleaseCount > 0) {
      plays.push({
        title: t('Clear ready-to-release drafts'),
        note: t('Draft runs that are already prepared should move out of the queue quickly to reduce last-minute payroll pressure.'),
      });
    }
    if (paymentDateMissingCount > 0) {
      plays.push({
        title: t('Confirm missing payment dates'),
        note: t('Paid records without a confirmed payment date should be reconciled so payroll reporting stays audit-ready.'),
      });
    }
    if (payrollPressureMap.some((item) => Number(item.draftCount || 0) > 0)) {
      plays.push({
        title: t('Prioritize the busiest department'),
        note: t('Focus on the department carrying the most draft payroll pressure to reduce queue risk fastest.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Keep payroll rhythm steady'),
      note: t('Payroll operations look stable, so keep the current review and release cadence in place.'),
    }];
  }, [overdueCount, paymentDateMissingCount, payrollPressureMap, readyToReleaseCount, t]);
  const strongestSignal = overdueCount > 0
    ? t('Some payroll runs are overdue and should be released before payroll confidence slips further.')
    : paymentDateMissingCount > 0
      ? t('Some paid records still need payment confirmation, so finance follow-through is the next control point to tighten.')
      : t('Payroll flow looks steady; keep draft runs moving so they do not age into overdue releases.');

  const payrollPulseCards = useMemo(() => ([
    {
      label: t('Release Queue'),
      value: stats.pendingCount,
      note: t('Draft payroll runs waiting for approval or payment release.'),
      accent: '#E8321A',
    },
    {
      label: t('Overdue Items'),
      value: watchSummary.overdueCount ?? 0,
      note: t('Runs that are aging past the expected release window.'),
      accent: '#F59E0B',
    },
    {
      label: t('Departments Covered'),
      value: departmentBreakdown.length,
      note: t('Teams represented in the current payroll overview.'),
      accent: '#2563EB',
    },
    {
      label: t('Follow-Up Watch'),
      value: followUpItems.length,
      note: t('Employees or records that still need confirmation.'),
      accent: '#7C3AED',
    },
  ]), [departmentBreakdown.length, followUpItems.length, stats.pendingCount, t, watchSummary.overdueCount]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyEmployeeDefaults = (employee) => {
    setSelectedEmployee(employee || null);
    setForm((prev) => ({
      ...prev,
      currency: employee?.currency_preference || prev.currency || 'EGP',
      baseSalary: employee?.monthlyIncome !== null && employee?.monthlyIncome !== undefined
        ? String(employee.monthlyIncome)
        : (employee ? prev.baseSalary : ''),
    }));
  };

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Records', watchSummary.totalRecords ?? records.length, ''],
        ['Summary', 'Draft', watchSummary.draftCount ?? 0, ''],
        ['Summary', 'Paid', watchSummary.paidCount ?? 0, ''],
        ['Summary', 'Overdue Release', watchSummary.overdueCount ?? 0, ''],
        ['Summary', 'Pending Amount', watchSummary.pendingAmount ?? 0, ''],
      ];

      if (departmentBreakdown.length) {
        rows.push([]);
        rows.push(['Departments', 'Department', 'Count', 'Draft / Pending Amount']);
        departmentBreakdown.forEach((item) => {
          rows.push([
            'Departments',
            item.department,
            item.count ?? 0,
            `draft ${item.draftCount ?? 0} | paid ${item.paidCount ?? 0} | pending ${item.pendingAmount ?? 0}`,
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
            `${item.payPeriod || ''} | ${item.department || ''} | ${item.netPay ?? 0} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`payroll-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Payroll watch exported.'));
    } catch {
      toast(t('Failed to export payroll watch.'), 'error');
    }
  };

  const handleCreate = async () => {
    if (!form.employeeID.trim() || !form.payPeriod.trim() || !form.baseSalary) {
      toast('Employee ID, pay period, and base salary are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await hrCreatePayroll({
        ...form,
        employeeID: form.employeeID.trim(),
        payPeriod: form.payPeriod.trim(),
        currency: form.currency || selectedEmployee?.currency_preference || 'EGP',
      });
      toast('Payroll record created');
      setForm({ ...INITIAL_FORM, payPeriod: new Date().toISOString().slice(0, 7) });
      await loadPayroll();
    } catch (error) {
      toast(error.message || 'Failed to create payroll record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (payrollID) => {
    setMarkingId(payrollID);
    try {
      await hrMarkPayrollPaid(payrollID, {});
      toast('Payroll marked as paid');
      await loadPayroll();
    } catch (error) {
      toast(error.message || 'Failed to mark payroll as paid', 'error');
    } finally {
      setMarkingId(null);
    }
  };

  const statusColor = (status) => (status === 'Paid' ? 'green' : 'orange');

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.payroll.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {t('page.payroll.subtitle')}
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/expenses'))}>{t('nav.expenses')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/benefits'))}>{t('nav.benefits')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/shifts'))}>{t('nav.shifts')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Payroll Records'), value: stats.totalRecords, color: '#111827' },
            { label: t('Pending Release'), value: stats.pendingCount, color: '#E8321A' },
            { label: t('Paid Amount'), value: formatCurrencyTotals(paidTotals, language), color: '#10B981' },
            { label: t('Needs Follow-Up'), value: stats.followUpCount, color: '#F59E0B' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 24 }}>
        {payrollPulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="hr-surface-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Payroll Release Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring overdue releases, payment controls, and department pressure into one finance-ready payroll review layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={overdueCount > 0 ? 'red' : 'green'} label={`${t('Overdue')} ${overdueCount}`} />
            <Badge color={readyToReleaseCount > 0 ? 'orange' : 'gray'} label={`${t('Ready to release')} ${readyToReleaseCount}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Overdue Release'),
              value: overdueCount,
              note: t('Payroll runs already outside the expected release window and most likely to create employee concern.'),
              accent: overdueCount > 0 ? '#E8321A' : '#22C55E',
            },
            {
              label: t('Ready to Release'),
              value: readyToReleaseCount,
              note: t('Draft payroll runs that can be pushed forward quickly to reduce last-minute risk.'),
              accent: readyToReleaseCount > 0 ? '#F59E0B' : '#22C55E',
            },
            {
              label: t('Payment Date Missing'),
              value: paymentDateMissingCount,
              note: t('Paid records that still need payment-date confirmation for reporting and control hygiene.'),
              accent: paymentDateMissingCount > 0 ? '#2563EB' : '#22C55E',
            },
            {
              label: t('Average Pending Value'),
              value: averagePendingValue,
              note: t('Average value of unreleased payroll records currently sitting in the queue.'),
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
          <div className="hr-surface-card" style={{ background: '#FCFCFD', borderRadius: 20, padding: 16, border: '1px solid #EAECF0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Release Queue')}</div>
            {payrollReleaseQueue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority payroll items are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {payrollReleaseQueue.map((item) => (
                  <div key={item.payrollID} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                      <Badge color={getPayrollTone(item)} label={t(item.followUpState || item.status)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.payPeriod} • {item.department}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{item.summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="accent" label={formatMoney(item.netPay, language, item.currency)} />
                      <Badge color="gray" label={`${item.ageDays ?? 0} ${t('days pending')}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ background: '#FCFCFD', borderRadius: 20, padding: 16, border: '1px solid #EAECF0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Payroll Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {payrollPlaybook.map((item) => (
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
          { label: 'Payroll Records', value: stats.totalRecords, accent: '#111827' },
          { label: 'Pending Release', value: stats.pendingCount, accent: '#E8321A' },
          { label: 'Paid Amount', value: formatMoney(stats.paidAmount, language), accent: '#10B981' },
          { label: 'Needs Follow-Up', value: stats.followUpCount, accent: '#F59E0B' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ background: 'var(--white)', borderRadius: 20, padding: '20px 24px', border: '1px solid #EAECF0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Payroll Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Highlight draft payroll runs that still need approval, release, or confirmation.')}</div>
            </div>
            <Badge label={`${watchSummary.overdueCount ?? 0} ${t('overdue')}`} color={(watchSummary.overdueCount ?? 0) > 0 ? 'red' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No payroll follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.payrollID} style={{ border: '1px solid #F1F5F9', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.payPeriod} · {item.department}</div>
                    </div>
                    <Badge label={t(item.followUpState || item.status)} color={WATCH_COLORS[item.followUpState] || statusColor(item.status)} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 10 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {formatMoney(item.netPay, language, item.currency)} · {item.ageDays ?? 0} {t('days pending')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Department Pressure Map')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>{t('See which teams are carrying the highest draft payroll pressure or unreleased value.')}</div>
          {payrollPressureMap.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No payroll summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {payrollPressureMap.map((item) => (
                <div key={item.department} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>{item.department}</strong>
                    <Badge
                      color={Number(item.draftCount || 0) > 0 ? 'orange' : 'green'}
                      label={`${item.count ?? 0} ${t('records')}`}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.draftCount ?? 0} {t('draft')} · {item.paidCount ?? 0} {t('paid')} · {formatCurrencyTotals((item.currencyTotals || []).map((entry) => ({ currency: entry.currency, amount: entry.pendingAmount })), language)} {t('pending')}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 6 }}>
                    {formatCurrencyTotals((item.currencyTotals || []).map((entry) => ({ currency: entry.currency, amount: entry.totalAmount })), language)} {t('total payroll value tracked for this team')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Payroll Record')}</h3>
          <EmployeeSelect
            label={t('Employee')}
            value={form.employeeID}
            onChange={(value) => handleChange('employeeID', value)}
            onEmployeeChange={applyEmployeeDefaults}
            placeholder={t('Select an employee')}
            helperText={t('Selecting an employee pulls the current salary and profile details for quick editing.')}
          />
          <EmployeeProfileSummary
            employee={selectedEmployee}
            t={t}
            language={language}
            note="Payroll-related defaults were fetched from the employee profile. You can still edit every value before saving."
          />
          <Input label={t('Pay Period (YYYY-MM)')} value={form.payPeriod} onChange={(e) => handleChange('payPeriod', e.target.value)} placeholder="2026-04" />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('layout.currency')}</label>
            <select
              value={form.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#fff',
                border: '1.5px solid #E7EAEE',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--gray-900)',
              }}
            >
              <option value="EGP">{t('currency.EGP')}</option>
              <option value="USD">{t('currency.USD')}</option>
            </select>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-500)' }}>
              {t('Changing the payroll currency here also saves it to the employee profile.')}
            </div>
          </div>
          <Input label={t('Base Salary')} type="number" value={form.baseSalary} onChange={(e) => handleChange('baseSalary', e.target.value)} placeholder="15000" />
          <Input label={t('Allowances')} type="number" value={form.allowances} onChange={(e) => handleChange('allowances', e.target.value)} placeholder="0" />
          <Input label={t('Deductions')} type="number" value={form.deductions} onChange={(e) => handleChange('deductions', e.target.value)} placeholder="0" />
          <Input label={t('Bonus')} type="number" value={form.bonus} onChange={(e) => handleChange('bonus', e.target.value)} placeholder="0" />
          <Textarea label={t('Notes')} value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder={t('Optional payroll notes')} />
          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Create Payroll')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Payroll Queue')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : records.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No payroll records yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Period', 'Base', 'Net Pay', 'Status', 'Payment Date', 'Action'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.payrollID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{item.employeeName || item.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.department || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{item.payPeriod}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        {formatMoney(item.baseSalary, language, item.currency)}
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.currency || 'EGP'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{formatMoney(item.netPay, language, item.currency)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(item.status)} color={statusColor(item.status)} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{item.paymentDate || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        {item.status !== 'Paid' ? (
                          <Btn size="sm" onClick={() => handleMarkPaid(item.payrollID)} disabled={markingId === item.payrollID}>
                            {markingId === item.payrollID ? t('Saving...') : t('Mark Paid')}
                          </Btn>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('Completed')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
