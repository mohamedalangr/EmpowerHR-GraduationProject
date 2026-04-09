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

const daysUntilDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const getDateWindowLabel = (value, t) => {
  const days = daysUntilDate(value);
  if (!Number.isFinite(days)) return t('No date set');
  if (days < 0) return `${Math.abs(days)} ${t('days ago')}`;
  if (days === 0) return t('Today');
  if (days === 1) return t('Tomorrow');
  return `${days} ${t('days left')}`;
};

const getStatusColor = (status) => {
  if (status === 'Approved' || status === 'Present') return 'green';
  if (status === 'Pending' || status === 'Clocked In') return 'orange';
  if (status === 'Rejected' || status === 'Partial') return 'red';
  return 'gray';
};

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
  const openClockCount = attendance.filter((record) => record.clockIn && !record.clockOut).length;
  const partialDays = attendance.filter((record) => record.status === 'Partial').length;
  const completedEntries = attendance.filter((record) => ['Present', 'Partial'].includes(record.status)).length;
  const attendanceMomentum = attendance.length ? Math.round((completedEntries / attendance.length) * 100) : 0;
  const upcomingLeaveCount = leaveRequests.filter((request) => ['Pending', 'Approved'].includes(request.status) && daysUntilDate(request.startDate) >= 0 && daysUntilDate(request.startDate) <= 14).length;

  const attendanceFocusQueue = useMemo(() => {
    const items = [];

    if (todayRecord?.clockIn && !todayRecord?.clockOut) {
      items.push({
        key: 'open-shift',
        title: t('Today is still open'),
        detail: t('Clock out to finalize today’s working hours and close the shift cleanly.'),
        meta: todayRecord.date || t('Today'),
        badge: t('Clocked In'),
        tone: 'orange',
      });
    }

    leaveRequests
      .filter((request) => request.status === 'Pending')
      .sort((a, b) => daysUntilDate(a.startDate) - daysUntilDate(b.startDate))
      .slice(0, 2)
      .forEach((request) => {
        items.push({
          key: `leave-${request.leaveRequestID}`,
          title: `${t(request.leaveType)} ${t('leave request')}`,
          detail: `${request.startDate || '—'} → ${request.endDate || '—'}`,
          meta: request.eligibilityMessage || t('Awaiting HR review'),
          badge: t(request.status),
          tone: 'orange',
        });
      });

    attendance
      .filter((record) => record.status === 'Partial')
      .slice(0, 2)
      .forEach((record) => {
        items.push({
          key: `attendance-${record.attendanceID}`,
          title: t('Partial attendance day'),
          detail: `${record.date || '—'} • ${record.workedHours ?? '—'}h`,
          meta: t('A recent record may need a quick time check or note update.'),
          badge: t(record.status),
          tone: 'red',
        });
      });

    return items.slice(0, 4);
  }, [attendance, leaveRequests, t, todayRecord]);

  const leavePressureMap = useMemo(() => {
    const grouped = leaveRequests.reduce((acc, request) => {
      const key = request.leaveType || 'Other';
      if (!acc[key]) {
        acc[key] = { leaveType: key, count: 0, pendingCount: 0, approvedCount: 0 };
      }
      acc[key].count += 1;
      if (request.status === 'Pending') acc[key].pendingCount += 1;
      if (request.status === 'Approved') acc[key].approvedCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.pendingCount - a.pendingCount || b.count - a.count || b.approvedCount - a.approvedCount)
      .slice(0, 4);
  }, [leaveRequests]);

  const attendancePlaybook = useMemo(() => {
    const plays = [];

    if (openClockCount > 0) {
      plays.push({
        title: t('Close open shifts promptly'),
        note: t('Finishing clock-out on time keeps working-hour records clean and reduces follow-up later.'),
      });
    }
    if (pendingLeaves > 0) {
      plays.push({
        title: t('Track pending leave requests'),
        note: t('Keep an eye on leave approvals so upcoming time off does not catch the schedule by surprise.'),
      });
    }
    if (partialDays > 0) {
      plays.push({
        title: t('Review partial attendance days'),
        note: t('A quick check on shorter or incomplete days helps avoid confusion during approvals or payroll review.'),
      });
    }
    if (upcomingLeaveCount > 0) {
      plays.push({
        title: t('Prepare for upcoming time away'),
        note: t('Upcoming leave windows are a good time to align handoffs and confirm any priority work coverage.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Attendance rhythm looks stable'),
      note: t('Your recent attendance and leave flow look healthy, so keep the same update cadence going.'),
    }];
  }, [openClockCount, pendingLeaves, partialDays, upcomingLeaveCount, t]);

  const strongestSignal = openClockCount > 0
    ? t('You still have an open shift, so closing today’s attendance cleanly is the most important next action.')
    : pendingLeaves > 0
      ? t('Pending leave requests are the clearest pressure point right now and worth checking before upcoming dates arrive.')
      : partialDays > 0
        ? t('Recent partial attendance records suggest a quick time review could improve clarity and follow-through.')
        : t('Attendance and leave activity look steady right now, with no major pressure signals standing out.');

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

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Attendance Response Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Clocked In'), value: openClockCount, color: '#B54708', note: t('Shifts that are still open and waiting for clock-out.') },
                { label: t('Pending Leave'), value: pendingLeaves, color: '#E8321A', note: t('Leave requests still waiting on review or approval.') },
                { label: t('Partial Days'), value: partialDays, color: '#175CD3', note: t('Attendance records that may need a closer time check.') },
                { label: t('Momentum'), value: `${attendanceMomentum}%`, color: '#027A48', note: t('Completion health across your recent attendance history.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Attendance Queue')}</h3>
            </div>
            {attendanceFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No immediate attendance follow-up items stand out right now.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {attendanceFocusQueue.map((item) => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.detail}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{item.meta}</div>
                    </div>
                    <Badge label={item.badge} color={item.tone} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Attendance Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {attendancePlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Leave Pressure')}</div>
            {leavePressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No leave pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {leavePressureMap.map((item) => (
                  <div key={item.leaveType} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.leaveType)}</div>
                      <Badge label={`${item.count} ${t('requests')}`} color={item.pendingCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Pending')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.pendingCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Approved')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.approvedCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{getDateWindowLabel(request.startDate, t)}</div>
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
