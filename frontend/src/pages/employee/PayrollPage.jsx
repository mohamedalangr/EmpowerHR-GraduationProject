import { useEffect, useMemo, useState } from 'react';
import { getMyPayroll } from '../../api/index.js';
import { Badge, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const formatMoney = (value, language = 'en') => {
  const number = Number(value || 0);
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(number);
};

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

  const stats = useMemo(() => {
    const paid = records.filter((item) => item.status === 'Paid');
    return {
      totalNet: paid.reduce((sum, item) => sum + Number(item.netPay || 0), 0),
      paidCount: paid.length,
      latestPeriod: records[0]?.payPeriod || '—',
    };
  }, [records]);

  const statusColor = (status) => (status === 'Paid' ? 'green' : 'orange');

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
          { label: t('Paid to Date'), value: formatMoney(stats.totalNet, language), accent: '#10B981' },
          { label: t('Paid Payslips'), value: stats.paidCount, accent: '#E8321A' },
          { label: t('Latest Period'), value: stats.latestPeriod, accent: '#111827' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
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
                    <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(item.status)} color={statusColor(item.status)} /></td>
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
