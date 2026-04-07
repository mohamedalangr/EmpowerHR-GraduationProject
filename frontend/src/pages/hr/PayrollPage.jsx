import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreatePayroll, hrGetPayroll, hrGetPayrollWatch, hrMarkPayrollPaid } from '../../api/index.js';
import { Badge, Btn, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  employeeID: '',
  payPeriod: new Date().toISOString().slice(0, 7),
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

const formatMoney = (value, language = 'en') => {
  const number = Number(value || 0);
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(number);
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

export function HRPayrollPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
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
    paidAmount: Number(watchSummary.paidAmount ?? records.filter((item) => item.status === 'Paid').reduce((sum, item) => sum + Number(item.netPay || 0), 0)),
    followUpCount: watchSummary.followUpCount ?? 0,
  }), [records, watchSummary]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
            { label: t('Paid Amount'), value: formatMoney(stats.paidAmount, language), color: '#10B981' },
            { label: t('Needs Follow-Up'), value: stats.followUpCount, color: '#F59E0B' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
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
                    {formatMoney(item.netPay, language)} · {item.ageDays ?? 0} {t('days pending')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Department Snapshot')}</div>
          {departmentBreakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No payroll summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {departmentBreakdown.map((item) => (
                <div key={item.department} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{item.department}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.count ?? 0}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.draftCount ?? 0} {t('draft')} · {item.paidCount ?? 0} {t('paid')} · {formatMoney(item.pendingAmount ?? 0, language)} {t('pending')}
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
          <EmployeeSelect label={t('Employee')} value={form.employeeID} onChange={(value) => handleChange('employeeID', value)} placeholder={t('Select an employee')} />
          <Input label={t('Pay Period (YYYY-MM)')} value={form.payPeriod} onChange={(e) => handleChange('payPeriod', e.target.value)} placeholder="2026-04" />
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
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{formatMoney(item.baseSalary, language)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{formatMoney(item.netPay, language)}</td>
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
