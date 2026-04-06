import { useEffect, useMemo, useState } from 'react';
import {
  getMyAttendance,
  clockAttendance,
  getMyLeaveRequests,
  submitLeaveRequest,
} from '../../api/index.js';
import { Spinner, Btn, Badge, Input, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_LEAVE = {
  leaveType: 'Annual',
  startDate: '',
  endDate: '',
  reason: '',
};

const LEAVE_TYPES = ['Annual', 'Sick', 'Casual', 'Unpaid'];

export function EmployeeAttendancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const employeeID = user?.employee_id;

  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState(INITIAL_LEAVE);

  const loadData = async () => {
    if (!employeeID) return;
    setLoading(true);
    try {
      const [attendanceData, leaveData] = await Promise.all([
        getMyAttendance(employeeID),
        getMyLeaveRequests(employeeID),
      ]);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setLeaveRequests(Array.isArray(leaveData) ? leaveData : []);
    } catch (error) {
      toast(error.message || 'Failed to load attendance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employeeID]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRecord = useMemo(
    () => attendance.find((record) => record.date === todayKey),
    [attendance, todayKey]
  );

  const pendingLeaves = leaveRequests.filter((request) => request.status === 'Pending').length;

  const handleClock = async (action) => {
    if (!employeeID) {
      toast('No employee ID found for the current user', 'error');
      return;
    }

    setClocking(true);
    try {
      await clockAttendance({ employeeID, action });
      toast(action === 'clock_in' ? 'Clock-in recorded' : 'Clock-out recorded');
      await loadData();
    } catch (error) {
      toast(error.message || 'Attendance action failed', 'error');
    } finally {
      setClocking(false);
    }
  };

  const handleLeaveSubmit = async () => {
    if (!employeeID) return;
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      toast('Please complete all leave request fields', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitLeaveRequest({
        employeeID,
        ...leaveForm,
        reason: leaveForm.reason.trim(),
      });
      toast('Leave request submitted');
      setLeaveForm(INITIAL_LEAVE);
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to submit leave request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Approved' || status === 'Present') return 'green';
    if (status === 'Pending' || status === 'Clocked In') return 'orange';
    if (status === 'Rejected' || status === 'Partial') return 'red';
    return 'gray';
  };

  return (
    <div className="hr-page-shell">
      <div className="hr-page-header">
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Attendance & Leave')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Step 3: clock in / out, review your attendance history, and submit leave requests.')}
        </p>
      </div>

      <div className="hr-stats-grid">
        {[
          { label: t('Today'), value: t(todayRecord?.status || 'Not started'), accent: '#E8321A' },
          { label: t('Attendance Entries'), value: attendance.length },
          { label: t('Pending Leave Requests'), value: pendingLeaves, accent: '#F59E0B' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.accent || 'var(--gray-900)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid">
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('Clock In / Out')}</h3>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 18 }}>
            {t('Use this to register your daily working hours.')}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <Btn onClick={() => handleClock('clock_in')} disabled={clocking || !!todayRecord?.clockIn}>
              {clocking ? t('Working...') : t('Clock In')}
            </Btn>
            <Btn variant="ghost" onClick={() => handleClock('clock_out')} disabled={clocking || !todayRecord?.clockIn || !!todayRecord?.clockOut}>
              {clocking ? t('Working...') : t('Clock Out')}
            </Btn>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['Clock In', todayRecord?.clockIn ? new Date(todayRecord.clockIn).toLocaleTimeString() : '—'],
              ['Clock Out', todayRecord?.clockOut ? new Date(todayRecord.clockOut).toLocaleTimeString() : '—'],
              ['Worked Hours', todayRecord?.workedHours ?? '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 12 }}>
                <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t(label)}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('Submit Leave Request')}</h3>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 18 }}>
            {t('Annual leave uses a basic eligibility check before HR approval.')}
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Leave Type')}</label>
            <select value={leaveForm.leaveType} onChange={(e) => setLeaveForm((prev) => ({ ...prev, leaveType: e.target.value }))} style={{ width: '100%', padding: '12px 16px', background: 'var(--gray-100)', border: '2px solid transparent', borderRadius: 14, fontSize: 14 }}>
              {LEAVE_TYPES.map((type) => <option key={type} value={type}>{t(type)}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Start Date')} type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((prev) => ({ ...prev, startDate: e.target.value }))} />
            <Input label={t('End Date')} type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((prev) => ({ ...prev, endDate: e.target.value }))} />
          </div>

          <Textarea label={t('Reason')} value={leaveForm.reason} onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder={t('Explain the leave request')} />

          <Btn onClick={handleLeaveSubmit} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Submitting...') : t('Submit Leave Request')}
          </Btn>
        </div>
      </div>

      <div className="hr-panel-grid" style={{ marginTop: 24 }}>
        <div className="hr-table-card">
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Recent Attendance')}</h3>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No attendance records yet.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {attendance.slice(0, 6).map((record) => (
                <div key={record.attendanceID} style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{record.date}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '—'} → {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge label={t(record.status)} color={getStatusColor(record.status)} />
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{record.workedHours ?? '—'}h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-table-card">
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('My Leave Requests')}</h3>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : leaveRequests.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No leave requests submitted yet.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaveRequests.slice(0, 6).map((request) => (
                <div key={request.leaveRequestID} style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t(request.leaveType)} {t('Leave')}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{request.startDate} → {request.endDate} ({request.daysRequested} day(s))</div>
                    </div>
                    <Badge label={t(request.status)} color={getStatusColor(request.status)} />
                  </div>
                  {request.eligibilityMessage && (
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6 }}>{request.eligibilityMessage}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
