import { useEffect, useMemo, useState } from 'react';
import { getMyPayroll } from '../../api/index.js';
import { Badge, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const formatMoney = (value, language = 'en', currency = 'EGP') => {
  const number = Number(value || 0);
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: currency || 'EGP',
    minimumFractionDigits: 2,
  }).format(number);
};

const getPayrollTone = (record) => (record?.status === 'Paid' ? 'green' : 'orange');

export function EmployeePayrollPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, language } = useLanguage();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayroll = async () => {
      if (!user?.employee_id) return;
      setLoading(true);
      try {
        const data = await getMyPayroll(user.employee_id);
        setRecords(Array.isArray(data) ? data : []);
      } catch (error) {
        toast(error.message || 'Failed to load payroll records', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadPayroll();
  }, [user?.employee_id]);

  const employeeCurrency = user?.employee_currency_preference || records[0]?.currency || 'EGP';

  const stats = useMemo(() => {
    const paid = records.filter((item) => item.status === 'Paid');
    return {
      totalNet: paid.reduce((sum, item) => sum + Number(item.netPay || 0), 0),
      paidCount: paid.length,
      latestPeriod: records[0]?.payPeriod || '—',
    };
  }, [records]);

  const pendingCount = records.filter((item) => item.status !== 'Paid').length;
  const pendingNetPay = records.filter((item) => item.status !== 'Paid').reduce((sum, item) => sum + Number(item.netPay || 0), 0);
  const bonusCount = records.filter((item) => Number(item.bonus || 0) > 0).length;
  const deductionPressure = records.filter((item) => Number(item.deductions || 0) > Number(item.allowances || 0)).length;

  const payrollFocusQueue = useMemo(() => {
    return [...records]
      .sort((a, b) => (a.status === 'Paid' ? 1 : 0) - (b.status === 'Paid' ? 1 : 0)
        || Number(b.netPay || 0) - Number(a.netPay || 0)
        || String(b.payPeriod || '').localeCompare(String(a.payPeriod || '')))
      .slice(0, 4);
  }, [records]);

  const payrollPressureMap = useMemo(() => {
    return [...records]
      .map((item) => ({
        payrollID: item.payrollID,
        payPeriod: item.payPeriod,
        netPay: Number(item.netPay || 0),
        deductions: Number(item.deductions || 0),
        allowances: Number(item.allowances || 0),
        bonus: Number(item.bonus || 0),
        status: item.status,
      }))
      .sort((a, b) => (b.deductions - b.allowances) - (a.deductions - a.allowances) || b.netPay - a.netPay)
      .slice(0, 4);
  }, [records]);

  const payrollPlaybook = useMemo(() => {
    const plays = [];

    if (pendingCount > 0) {
      plays.push({
        title: t('Watch unreleased payroll items'),
        note: t('If a payroll record is still not paid, keep an eye on its release timing and status updates.'),
      });
    }
    if (deductionPressure > 0) {
      plays.push({
        title: t('Review higher deduction periods'),
        note: t('Periods with heavier deductions are worth a quick check so the breakdown stays clear.'),
      });
    }
    if (bonusCount > 0) {
      plays.push({
        title: t('Spotlight bonus-impact periods'),
        note: t('Payroll records with bonuses are useful reference points for compensation conversations and records.'),
      });
    }
    if (stats.paidCount > 0) {
      plays.push({
        title: t('Track payout momentum over time'),
        note: t('Recent paid records help you understand your running pay history and net-pay trend.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Payroll history will build here'),
      note: t('As more payslips are recorded, this page will highlight the clearest payment and deduction patterns.'),
    }];
  }, [bonusCount, deductionPressure, pendingCount, stats.paidCount, t]);

  const strongestSignal = pendingCount > 0
    ? t('One or more payroll records are still pending, so payout timing is the clearest item to watch next.')
    : deductionPressure > 0
      ? t('Some periods carry relatively higher deductions, making payroll breakdown clarity especially useful right now.')
      : bonusCount > 0
        ? t('Bonus-bearing periods are standing out in your payroll history and can be useful reference points later.')
        : t('Your payroll history looks steady right now, with no major pressure signals standing out.');

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1200 }}>
      <div className="hr-page-header">
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Payroll & Payslips')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Review your monthly salary records and payment status.')}
        </p>
      </div>

      <div className="hr-stats-grid">
        {[
          { label: t('Paid to Date'), value: formatMoney(stats.totalNet, language, employeeCurrency), accent: '#10B981' },
          { label: t('Paid Payslips'), value: stats.paidCount, accent: '#E8321A' },
          { label: t('Latest Period'), value: stats.latestPeriod, accent: '#111827' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Payroll Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Pending Records'), value: pendingCount, color: '#B54708', note: t('Payroll entries that are still waiting for final payment status.') },
                { label: t('Pending Net'), value: formatMoney(pendingNetPay, language, employeeCurrency), color: '#E8321A', note: t('Net pay amount currently tied to unpaid or draft records.') },
                { label: t('Bonus Periods'), value: bonusCount, color: '#027A48', note: t('Payroll periods where bonuses added extra compensation.') },
                { label: t('Deduction Pressure'), value: deductionPressure, color: '#175CD3', note: t('Periods where deductions outweigh allowances and deserve a closer look.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Payroll Focus Queue')}</h3>
            </div>
            {payrollFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority payroll follow-up items will appear here as records are added.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {payrollFocusQueue.map((item) => (
                  <div key={`queue-${item.payrollID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.payPeriod}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t('Net Pay')} {formatMoney(item.netPay, language, item.currency || employeeCurrency)} • {t('Bonus')} {formatMoney(item.bonus, language, item.currency || employeeCurrency)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{item.paymentDate || '—'}</div>
                    </div>
                    <Badge label={t(item.status)} color={getPayrollTone(item)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Payroll Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {payrollPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Pay Breakdown Pressure')}</div>
            {payrollPressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No payroll pressure pattern stands out yet.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {payrollPressureMap.map((item) => (
                  <div key={item.payrollID} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{item.payPeriod}</div>
                      <Badge label={t(item.status)} color={getPayrollTone(item)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Deductions')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{formatMoney(item.deductions, language, item.currency || employeeCurrency)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Allowances')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{formatMoney(item.allowances, language, item.currency || employeeCurrency)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hr-table-card">
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Payroll Records')}</h3>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : records.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No payroll records are available yet.')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)' }}>
                  {['Period', 'Base Salary', 'Allowances', 'Deductions', 'Bonus', 'Net Pay', 'Status', 'Payment Date'].map((head) => (
                    <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.payrollID}>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{item.payPeriod}</td>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{formatMoney(item.baseSalary, language)}</td>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{formatMoney(item.allowances, language)}</td>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{formatMoney(item.deductions, language)}</td>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{formatMoney(item.bonus, language)}</td>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{formatMoney(item.netPay, language)}</td>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(item.status)} color={getPayrollTone(item)} /></td>
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{item.paymentDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
