import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreateBenefit, hrGetBenefitWatch, hrGetBenefits } from '../../api/index.js';
import { Badge, Btn, DatalistInput, EmployeeProfileSummary, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
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

const INITIAL_FORM = {
  employeeID: '',
  benefitName: '',
  benefitType: 'Medical',
  provider: '',
  coverageLevel: 'Employee Only',
  status: 'Pending',
  monthlyCost: 0,
  employeeContribution: 0,
  effectiveDate: '',
  notes: '',
};

const STATUS_COLORS = {
  Pending: 'orange',
  Enrolled: 'green',
  Waived: 'gray',
};

const WATCH_COLORS = {
  Overdue: 'red',
  'Due Soon': 'yellow',
  'Pending Review': 'orange',
  Enrolled: 'green',
  Waived: 'gray',
};

const EMPTY_WATCH = {
  summary: {},
  benefitTypeBreakdown: [],
  followUpItems: [],
};

const formatMoney = (value, language = 'en') => {
  const number = Number(value || 0);
  const preferredCurrency = typeof document !== 'undefined'
    ? (document.documentElement.dataset.currencyPreference || 'EGP')
    : 'EGP';
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: preferredCurrency,
    minimumFractionDigits: 2,
  }).format(number);
};

const getBenefitTone = (item) => {
  if (item?.dueState === 'Overdue') return 'red';
  if (item?.dueState === 'Due Soon' || item?.dueState === 'Pending Review' || item?.status === 'Pending') return 'orange';
  if (item?.status === 'Enrolled') return 'green';
  return 'accent';
};

export function HRBenefitsPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [benefits, setBenefits] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadBenefits = async () => {
    setLoading(true);
    try {
      const [data, watchData] = await Promise.all([
        hrGetBenefits(),
        hrGetBenefitWatch().catch(() => EMPTY_WATCH),
      ]);
      setBenefits(Array.isArray(data) ? data : []);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
    } catch (error) {
      toast(error.message || 'Failed to load benefits', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenefits();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const benefitTypeBreakdown = watch?.benefitTypeBreakdown || [];

  const stats = useMemo(() => ({
    total: watchSummary.totalEnrollments ?? benefits.length,
    enrolled: watchSummary.enrolledCount ?? benefits.filter((item) => item.status === 'Enrolled').length,
    pending: watchSummary.pendingCount ?? benefits.filter((item) => item.status === 'Pending').length,
    followUp: watchSummary.followUpCount ?? 0,
  }), [benefits, watchSummary]);

  const overdueCount = watchSummary.overdueCount ?? followUpItems.filter((item) => item.dueState === 'Overdue').length;
  const dueSoonCount = watchSummary.dueSoonCount ?? followUpItems.filter((item) => item.dueState === 'Due Soon').length;
  const totalMonthlyCost = watchSummary.totalMonthlyCost ?? benefits.reduce((sum, item) => sum + Number(item.monthlyCost || 0), 0);
  const employeeContributionTotal = watchSummary.employeeContributionTotal ?? benefits.reduce((sum, item) => sum + Number(item.employeeContribution || 0), 0);
  const benefitFocusQueue = useMemo(() => {
    const stateRank = { Overdue: 3, 'Due Soon': 2, 'Pending Review': 1 };
    return [...followUpItems]
      .sort((a, b) => (stateRank[b.dueState] || 0) - (stateRank[a.dueState] || 0)
        || Number(a.daysToEffective ?? 999) - Number(b.daysToEffective ?? 999)
        || Number(b.contributionRate || 0) - Number(a.contributionRate || 0))
      .slice(0, 4);
  }, [followUpItems]);
  const benefitPressureMap = useMemo(() => {
    return [...benefitTypeBreakdown]
      .sort((a, b) => Number(b.pendingCount || 0) - Number(a.pendingCount || 0)
        || Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 4);
  }, [benefitTypeBreakdown]);
  const benefitPlaybook = useMemo(() => {
    const plays = [];

    if (overdueCount > 0) {
      plays.push({
        title: t('Resolve overdue enrollments'),
        note: t('Start with overdue benefit items so employees are not left without the expected coverage start.'),
      });
    }
    if (stats.pending > 0) {
      plays.push({
        title: t('Clear pending confirmations'),
        note: t('Use a short HR follow-up to close pending elections and provider confirmations quickly.'),
      });
    }
    if (dueSoonCount > 0) {
      plays.push({
        title: t('Protect upcoming effective dates'),
        note: t('Due-soon enrollments should be finalized before they roll into an overdue benefits issue.'),
      });
    }
    if (benefitPressureMap.some((item) => Number(item.pendingCount || 0) > 0)) {
      plays.push({
        title: t('Prioritize the busiest benefit type'),
        note: t('Focus on the plan type carrying the most pending enrollments to reduce queue pressure fastest.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Maintain enrollment rhythm'),
      note: t('Benefits operations look stable, so keep the current enrollment and reminder cadence.'),
    }];
  }, [benefitPressureMap, dueSoonCount, overdueCount, stats.pending, t]);
  const strongestSignal = overdueCount > 0
    ? t('Some benefit enrollments are already overdue and need immediate HR action before the effective date slips further.')
    : stats.pending > 0
      ? t('Pending benefit confirmations are still open and should be cleared before the next payroll or eligibility cycle.')
      : t('Benefit coverage looks steady; focus next on keeping due-soon enrollments on track.');

  const benefitPulseCards = useMemo(() => ([
    {
      label: t('Enrollment Queue'),
      value: stats.pending,
      note: t('Benefit requests or plan changes still waiting for HR confirmation.'),
      accent: '#E8321A',
    },
    {
      label: t('Overdue Renewals'),
      value: watchSummary.overdueCount ?? 0,
      note: t('Enrollments nearing their effective dates or still missing review.'),
      accent: '#F59E0B',
    },
    {
      label: t('Coverage Mix'),
      value: benefitTypeBreakdown.length,
      note: t('Plan categories currently represented across active enrollments.'),
      accent: '#2563EB',
    },
    {
      label: t('Action Watch'),
      value: followUpItems.length,
      note: t('Employees whose benefits still need provider, date, or status follow-up.'),
      accent: '#7C3AED',
    },
  ]), [benefitTypeBreakdown.length, followUpItems.length, stats.pending, t, watchSummary.overdueCount]);

  const benefitNames = useMemo(() => [...new Set(benefits.map((item) => item.benefitName).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [benefits]);
  const providers = useMemo(() => [...new Set(benefits.map((item) => item.provider).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [benefits]);
  const coverageLevels = useMemo(() => [...new Set(benefits.map((item) => item.coverageLevel).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [benefits]);

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Enrollments', watchSummary.totalEnrollments ?? benefits.length, ''],
        ['Summary', 'Pending', watchSummary.pendingCount ?? 0, ''],
        ['Summary', 'Enrolled', watchSummary.enrolledCount ?? 0, ''],
        ['Summary', 'Waived', watchSummary.waivedCount ?? 0, ''],
        ['Summary', 'Overdue', watchSummary.overdueCount ?? 0, ''],
        ['Summary', 'Due Soon', watchSummary.dueSoonCount ?? 0, ''],
      ];

      if (benefitTypeBreakdown.length) {
        rows.push([]);
        rows.push(['Types', 'Benefit Type', 'Count', 'Pending / Cost']);
        benefitTypeBreakdown.forEach((item) => {
          rows.push([
            'Types',
            item.benefitType,
            item.count ?? 0,
            `pending ${item.pendingCount ?? 0} | enrolled ${item.enrolledCount ?? 0} | monthly ${item.monthlyCost ?? 0}`,
          ]);
        });
      }

      if (followUpItems.length) {
        rows.push([]);
        rows.push(['Follow-Up', 'Employee', 'Due State', 'Summary']);
        followUpItems.forEach((item) => {
          rows.push([
            'Follow-Up',
            item.employeeName || item.employeeID,
            item.dueState || item.status,
            `${item.benefitName || ''} | ${item.benefitType || ''} | ${item.effectiveDate || 'No effective date'} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`benefits-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Benefits watch exported.'));
    } catch {
      toast(t('Failed to export benefits watch.'), 'error');
    }
  };

  const handleCreate = async () => {
    if (!form.employeeID.trim() || !form.benefitName.trim()) {
      toast('Employee ID and benefit name are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await hrCreateBenefit({
        employeeID: form.employeeID.trim(),
        benefitName: form.benefitName.trim(),
        benefitType: form.benefitType,
        provider: form.provider.trim(),
        coverageLevel: form.coverageLevel.trim(),
        status: form.status,
        monthlyCost: Number(form.monthlyCost || 0),
        employeeContribution: Number(form.employeeContribution || 0),
        effectiveDate: form.effectiveDate || null,
        notes: form.notes.trim(),
      });
      toast('Benefit enrollment created');
      setForm(INITIAL_FORM);
      await loadBenefits();
    } catch (error) {
      toast(error.message || 'Failed to create benefit enrollment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'المزايا والاشتراكات' : 'Benefits & Enrollment'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {language === 'ar' ? 'عيّن مزايا الموظفين وتابع حالة الاشتراك وراجع تفاصيل المساهمات.' : 'Assign employee benefits, track enrollment status, and review contribution details.'}
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/payroll'))}>{t('nav.payroll')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/policies'))}>{t('nav.policies')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Plans'), value: stats.total, color: '#111827' },
            { label: t('Enrolled'), value: stats.enrolled, color: '#10B981' },
            { label: t('Pending'), value: stats.pending, color: '#E8321A' },
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
        {benefitPulseCards.map((card) => (
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Benefits Strategy Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring the most urgent enrollment deadlines, cost signals, and follow-up priorities into one benefits review layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={overdueCount > 0 ? 'red' : 'green'} label={`${t('Overdue')} ${overdueCount}`} />
            <Badge color={stats.pending > 0 ? 'orange' : 'gray'} label={`${t('Pending')} ${stats.pending}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Overdue'),
              value: overdueCount,
              note: t('Benefit enrollments already past their effective date target.'),
              accent: overdueCount > 0 ? '#E8321A' : '#22C55E',
            },
            {
              label: t('Due Soon'),
              value: dueSoonCount,
              note: t('Enrollments that still have time to be rescued before the deadline.'),
              accent: dueSoonCount > 0 ? '#F59E0B' : '#22C55E',
            },
            {
              label: t('Monthly Cost'),
              value: formatMoney(totalMonthlyCost, language),
              note: t('Total monthly benefits load currently represented in the portfolio.'),
              accent: '#2563EB',
            },
            {
              label: t('Employee Share'),
              value: formatMoney(employeeContributionTotal, language),
              note: t('Current employee contribution across tracked enrollments.'),
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
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Enrollment Queue')}</div>
            {benefitFocusQueue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority benefit items are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {benefitFocusQueue.map((item) => (
                  <div key={item.enrollmentID} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                      <Badge color={getBenefitTone(item)} label={t(item.dueState || item.status)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.benefitName} • {t(item.benefitType)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{item.summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="accent" label={`${t('Effective')}: ${item.effectiveDate || t('TBA')}`} />
                      <Badge color="gray" label={`${item.contributionRate ?? 0}% ${t('employee contribution')}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Benefits Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {benefitPlaybook.map((item) => (
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
          { label: 'Plans', value: stats.total, accent: '#111827' },
          { label: 'Enrolled', value: stats.enrolled, accent: '#10B981' },
          { label: 'Pending', value: stats.pending, accent: '#E8321A' },
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
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Benefits Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('See which benefit enrollments need action before the effective date.')}</div>
            </div>
            <Badge label={`${watchSummary.overdueCount ?? 0} ${t('overdue')}`} color={(watchSummary.overdueCount ?? 0) > 0 ? 'red' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No benefits follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.enrollmentID} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Benefits follow-up')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.benefitName} · {t(item.benefitType)}</div>
                    </div>
                    <Badge label={t(item.dueState || item.status)} color={WATCH_COLORS[item.dueState] || STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Badge label={t(item.benefitType)} color="accent" />
                    <Badge label={item.coverageLevel || t('Coverage TBD')} color="gray" />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 4 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    {item.effectiveDate ? `${t('Effective')}: ${item.effectiveDate}` : t('No effective date set')} · {item.contributionRate ?? 0}% {t('employee contribution')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Benefit Type Snapshot')}</div>
          {benefitTypeBreakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No benefit summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {benefitTypeBreakdown.map((item) => (
                <div key={item.benefitType} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{t(item.benefitType)}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.count ?? 0}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.pendingCount ?? 0} {t('pending')} · {item.enrolledCount ?? 0} {t('enrolled')} · {formatMoney(item.monthlyCost, language)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', margin: '16px 0 10px' }}>{t('Benefit Mix Pressure')}</div>
          {benefitPressureMap.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Benefit pressure signals will appear as enrollments are created.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {benefitPressureMap.map((item) => (
                <div key={`${item.benefitType}-pressure`} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid #E7EAEE', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gray-700)' }}>{t(item.benefitType)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 2 }}>{item.count ?? 0} {t('Plans')} • {item.enrolledCount ?? 0} {t('Enrolled')}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 700 }}>
                    <div style={{ color: (item.pendingCount ?? 0) > 0 ? '#F59E0B' : 'var(--gray-500)' }}>{item.pendingCount ?? 0} {t('Pending')}</div>
                    <div style={{ color: '#2563EB', marginTop: 2 }}>{formatMoney(item.monthlyCost, language)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Benefit Enrollment')}</h3>
          <EmployeeSelect
            label={t('Employee')}
            value={form.employeeID}
            onChange={(value) => setForm((prev) => ({ ...prev, employeeID: value }))}
            onEmployeeChange={(employee) => setSelectedEmployee(employee || null)}
            placeholder={t('Select an employee')}
            helperText={t('The selected employee profile is shown below so HR can use related details without retyping them.')}
          />
          <EmployeeProfileSummary
            employee={selectedEmployee}
            t={t}
            language={language}
            note="Related employee details are pulled in here for easier benefit setup and can still be changed manually in the form."
          />
          <DatalistInput label={t('Benefit Name')} value={form.benefitName} options={benefitNames} onChange={(e) => setForm((prev) => ({ ...prev, benefitName: e.target.value }))} placeholder={t('Select or type a benefit name')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Benefit Type')}</label>
              <select value={form.benefitType} onChange={(e) => setForm((prev) => ({ ...prev, benefitType: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Medical', 'Dental', 'Retirement', 'Transportation', 'Wellness'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Pending', 'Enrolled', 'Waived'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DatalistInput label={t('Provider')} value={form.provider} options={providers} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))} placeholder="Select or type a provider" />
            <DatalistInput label={t('Coverage Level')} value={form.coverageLevel} options={coverageLevels} onChange={(e) => setForm((prev) => ({ ...prev, coverageLevel: e.target.value }))} placeholder={t('Select or type a coverage level')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Monthly Cost')} type="number" min="0" step="0.01" value={form.monthlyCost} onChange={(e) => setForm((prev) => ({ ...prev, monthlyCost: e.target.value }))} />
            <Input label={t('Employee Contribution')} type="number" min="0" step="0.01" value={form.employeeContribution} onChange={(e) => setForm((prev) => ({ ...prev, employeeContribution: e.target.value }))} />
          </div>

          <Input label={t('Effective Date')} type="date" value={form.effectiveDate} onChange={(e) => setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))} />
          <Textarea label={t('Notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t('Add eligibility notes or enrollment instructions')} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Create Enrollment')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Benefits Overview')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : benefits.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No benefit enrollments created yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Benefit', 'Coverage', 'Status', 'Monthly Cost', 'Effective'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benefits.map((item) => (
                    <tr key={item.enrollmentID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{item.employeeName || item.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.department || '—'} • {item.team || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{item.benefitName}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(item.benefitType)} • {item.provider || t('Provider TBD')}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{item.coverageLevel || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{formatMoney(item.monthlyCost, language)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{item.effectiveDate || '—'}</td>
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
