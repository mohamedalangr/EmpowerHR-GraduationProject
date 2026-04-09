import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hrGetAttendanceRecords,
  hrGetAttendanceWatch,
  hrGetLeaveRequests,
  hrReviewLeaveRequest,
} from '../../api/index.js';
import { Spinner, Btn, Badge, useToast } from '../../components/shared/index.jsx';
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

const WATCH_COLORS = {
  'Open Shift': 'orange',
  'Leave Approval Pending': 'yellow',
  'Partial Day': 'red',
};

const EMPTY_WATCH = {
  summary: {},
  departmentBreakdown: [],
  followUpItems: [],
};

const getAttendanceTone = (item) => {
  if (item?.followUpState === 'Partial Day') return 'red';
  if (item?.followUpState === 'Open Shift') return 'orange';
  if (item?.followUpState === 'Leave Approval Pending') return 'yellow';
  if (item?.status === 'Approved' || item?.status === 'Present') return 'green';
  return 'accent';
};

export function HRAttendancePage() {
  const toast = useToast();
  const { t } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attendanceData, leaveData, watchData] = await Promise.all([
        hrGetAttendanceRecords(),
        hrGetLeaveRequests(),
        hrGetAttendanceWatch().catch(() => EMPTY_WATCH),
      ]);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setLeaveRequests(Array.isArray(leaveData) ? leaveData : []);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
    } catch (error) {
      toast(error.message || 'Failed to load HR attendance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const departmentBreakdown = watch?.departmentBreakdown || [];

  const stats = useMemo(() => {
    const pending = watchSummary.pendingLeaveCount ?? leaveRequests.filter((item) => item.status === 'Pending').length;
    const approved = watchSummary.approvedLeaveCount ?? leaveRequests.filter((item) => item.status === 'Approved').length;
    return {
      attendanceToday: watchSummary.attendanceToday ?? attendance.filter((item) => item.date === new Date().toISOString().slice(0, 10)).length,
      pending,
      approved,
      followUp: watchSummary.followUpCount ?? 0,
    };
  }, [attendance, leaveRequests, watchSummary]);

  const openShiftCount = watchSummary.clockedInCount ?? followUpItems.filter((item) => item.followUpState === 'Open Shift').length;
  const partialDayCount = watchSummary.partialCount ?? followUpItems.filter((item) => item.followUpState === 'Partial Day').length;
  const attendanceFocusQueue = useMemo(() => {
    const stateRank = { 'Partial Day': 3, 'Open Shift': 2, 'Leave Approval Pending': 1 };
    return [...followUpItems]
      .sort((a, b) => (stateRank[b.followUpState] || 0) - (stateRank[a.followUpState] || 0)
        || String(a.date || '').localeCompare(String(b.date || ''))
        || String(a.employeeName || '').localeCompare(String(b.employeeName || '')))
      .slice(0, 4);
  }, [followUpItems]);
  const attendancePressureMap = useMemo(() => {
    return [...departmentBreakdown]
      .sort((a, b) => Number(b.pendingLeaveCount || 0) - Number(a.pendingLeaveCount || 0)
        || Number(b.clockedInCount || 0) - Number(a.clockedInCount || 0)
        || Number(b.partialCount || 0) - Number(a.partialCount || 0))
      .slice(0, 4);
  }, [departmentBreakdown]);
  const attendancePlaybook = useMemo(() => {
    const plays = [];

    if (partialDayCount > 0) {
      plays.push({
        title: t('Investigate partial-day records first'),
        note: t('Start with partial attendance issues so manager outreach and payroll corrections can happen before they compound.'),
      });
    }
    if (openShiftCount > 0) {
      plays.push({
        title: t('Close open attendance records'),
        note: t('Employees still clocked in may need a same-day closeout to keep attendance and payroll clean.'),
      });
    }
    if (stats.pending > 0) {
      plays.push({
        title: t('Clear the leave queue'),
        note: t('Pending leave requests should be reviewed quickly so schedule coverage and staffing plans stay reliable.'),
      });
    }
    if (attendancePressureMap.some((item) => Number(item.pendingLeaveCount || 0) > 0 || Number(item.partialCount || 0) > 0)) {
      plays.push({
        title: t('Focus on the busiest department'),
        note: t('Work the department carrying the most leave or attendance pressure to reduce daily operations risk fastest.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Keep attendance rhythm steady'),
      note: t('Attendance operations look stable, so keep the current review and approval cadence in place.'),
    }];
  }, [attendancePressureMap, openShiftCount, partialDayCount, stats.pending, t]);
  const strongestSignal = partialDayCount > 0
    ? t('Some attendance records show partial days and should be clarified before they create payroll or compliance follow-up.')
    : stats.pending > 0
      ? t('The leave queue still needs attention, so the next best win is clearing pending approvals quickly.')
      : t('Attendance flow looks stable; keep open shifts and leave reviews moving so daily issues do not stack up.');

  const attendancePulseCards = useMemo(() => ([
    {
      label: t('Attendance Flow'),
      value: stats.attendanceToday,
      note: t('Daily logs already captured across the workforce today.'),
      accent: '#E8321A',
    },
    {
      label: t('Leave Queue'),
      value: stats.pending,
      note: t('Pending leave decisions that still need HR review or approval.'),
      accent: '#F59E0B',
    },
    {
      label: t('Department Signals'),
      value: departmentBreakdown.length,
      note: t('Teams represented in the attendance and leave monitoring snapshot.'),
      accent: '#2563EB',
    },
    {
      label: t('Follow-Up Watch'),
      value: followUpItems.length,
      note: t('Open shifts, partial days, or leave cases that still need attention.'),
      accent: '#7C3AED',
    },
  ]), [departmentBreakdown.length, followUpItems.length, stats.attendanceToday, stats.pending, t]);

  const handleReview = async (leaveRequestID, status) => {
    setReviewingId(leaveRequestID);
    try {
      await hrReviewLeaveRequest(leaveRequestID, {
        status,
        reviewNotes: status === 'Approved' ? 'Approved by HR.' : 'Rejected by HR.',
      });
      toast(`Leave request ${status.toLowerCase()}`);
      await loadData();
    } catch (error) {
      toast(error.message || 'Review action failed', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Attendance Logged Today', stats.attendanceToday, ''],
        ['Summary', 'Pending Leave Requests', stats.pending, ''],
        ['Summary', 'Approved Leave Requests', stats.approved, ''],
        ['Summary', 'Needs Follow-Up', stats.followUp, ''],
      ];

      if (departmentBreakdown.length) {
        rows.push([]);
        rows.push(['Departments', 'Department', 'Attendance', 'Open Shift / Pending Leave']);
        departmentBreakdown.forEach((item) => {
          rows.push([
            'Departments',
            item.department,
            item.attendanceCount ?? 0,
            `clocked in ${item.clockedInCount ?? 0} | partial ${item.partialCount ?? 0} | leave ${item.pendingLeaveCount ?? 0}`,
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
            `${item.department || ''} | ${item.date || ''} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`attendance-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Attendance watch exported.'));
    } catch {
      toast(t('Failed to export attendance watch.'), 'error');
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Approved' || status === 'Present') return 'green';
    if (status === 'Pending' || status === 'Clocked In') return 'orange';
    if (status === 'Rejected' || status === 'Partial') return 'red';
    return 'gray';
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.attendance.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {t('page.attendance.subtitle')}
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/shifts'))}>{t('nav.shifts')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/payroll'))}>{t('nav.payroll')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/tickets'))}>{t('nav.supportTickets')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Attendance Logged Today'), value: stats.attendanceToday, color: '#E8321A' },
            { label: t('Pending Leave Requests'), value: stats.pending, color: '#F59E0B' },
            { label: t('Approved Leave Requests'), value: stats.approved, color: '#10B981' },
            { label: t('Needs Follow-Up'), value: stats.followUp, color: '#111827' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 24 }}>
        {attendancePulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="hr-surface-card" style={{ background: 'var(--white)', borderRadius: 24, padding: 20, border: '1px solid #EAECF0', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Attendance Response Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring leave backlog, open shifts, and department pressure into one daily attendance response layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={partialDayCount > 0 ? 'red' : 'green'} label={`${t('Partial days')} ${partialDayCount}`} />
            <Badge color={stats.pending > 0 ? 'yellow' : 'gray'} label={`${t('Pending leave')} ${stats.pending}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Open Shifts'),
              value: openShiftCount,
              note: t('Employees still clocked in who may need same-day attendance closeout.'),
              accent: openShiftCount > 0 ? '#F59E0B' : '#22C55E',
            },
            {
              label: t('Partial Days'),
              value: partialDayCount,
              note: t('Attendance records that may need manager clarification or payroll review.'),
              accent: partialDayCount > 0 ? '#E8321A' : '#22C55E',
            },
            {
              label: t('Pending Leave'),
              value: stats.pending,
              note: t('Leave requests still waiting for a decision before schedules are final.'),
              accent: stats.pending > 0 ? '#2563EB' : '#22C55E',
            },
            {
              label: t('Today Logged'),
              value: stats.attendanceToday,
              note: t('Attendance activity already recorded today across the workforce.'),
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

        <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.05fr .95fr', alignItems: 'start' }}>
          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Attendance Queue')}</div>
            {attendanceFocusQueue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority attendance items are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {attendanceFocusQueue.map((item, index) => (
                  <div key={`${item.type}-${item.attendanceID || item.leaveRequestID || index}`} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                      <Badge color={getAttendanceTone(item)} label={t(item.followUpState || item.status)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.department || '—'} • {item.date || '—'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{item.summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {item.type && <Badge color="accent" label={t(item.type)} />}
                      {item.status && <Badge color="gray" label={t(item.status)} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Attendance Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {attendancePlaybook.map((item) => (
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
          { label: 'Attendance Logged Today', value: stats.attendanceToday, accent: '#E8321A' },
          { label: 'Pending Leave Requests', value: stats.pending, accent: '#F59E0B' },
          { label: 'Approved Leave Requests', value: stats.approved, accent: '#10B981' },
          { label: 'Needs Follow-Up', value: stats.followUp, accent: '#111827' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ background: 'var(--white)', borderRadius: 20, padding: '20px 24px', border: '1px solid #EAECF0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.05fr .95fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Attendance Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Highlight open shifts, partial days, and leave approvals that need HR attention.')}</div>
            </div>
            <Badge label={`${stats.followUp} ${t('follow-up')}`} color={stats.followUp > 0 ? 'orange' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No attendance follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item, index) => (
                <div key={`${item.type}-${item.attendanceID || item.leaveRequestID || index}`} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Attendance follow-up')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.department} · {item.date || '—'}</div>
                    </div>
                    <Badge label={t(item.followUpState || item.status)} color={WATCH_COLORS[item.followUpState] || getStatusColor(item.status)} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {item.type && <Badge label={t(item.type)} color="accent" />}
                    {item.status && <Badge label={t(item.status)} color={getStatusColor(item.status)} />}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{item.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Department Pressure Map')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>{t('See which departments are carrying the most leave or attendance follow-up pressure today.')}</div>
          {attendancePressureMap.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No attendance summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {attendancePressureMap.map((item) => (
                <div key={item.department} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>{item.department}</strong>
                    <Badge
                      color={Number(item.pendingLeaveCount || 0) > 0 ? 'yellow' : Number(item.partialCount || 0) > 0 ? 'red' : 'green'}
                      label={`${item.attendanceCount ?? 0} ${t('logs')}`}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.clockedInCount ?? 0} {t('open')} · {item.partialCount ?? 0} {t('partial')} · {item.pendingLeaveCount ?? 0} {t('pending')}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 6 }}>
                    {t('Focus first where leave backlog and partial attendance are highest.')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="hr-table-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Recent Attendance Records')}</h3>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No attendance records available.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Date', 'Time', 'Hours', 'Status'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.slice(0, 10).map((record) => (
                    <tr key={record.attendanceID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{record.employeeName || `#${record.employeeID}`}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{record.date}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontSize: 12.5 }}>
                        {record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '—'} → {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{record.workedHours ?? '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(record.status)} color={getStatusColor(record.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="hr-table-card" style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Leave Review Queue')}</h3>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : leaveRequests.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No leave requests available.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaveRequests.slice(0, 10).map((request) => (
                <div key={request.leaveRequestID} style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{request.employeeName || `Employee #${request.employeeID}`}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(request.leaveType)} • {request.startDate} → {request.endDate}</div>
                    </div>
                    <Badge label={t(request.status)} color={getStatusColor(request.status)} />
                  </div>

                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{request.reason}</div>
                  {request.eligibilityMessage && (
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>{request.eligibilityMessage}</div>
                  )}

                  {request.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn onClick={() => handleReview(request.leaveRequestID, 'Approved')} disabled={reviewingId === request.leaveRequestID}>
                        {reviewingId === request.leaveRequestID ? t('Saving...') : t('Approve')}
                      </Btn>
                      <Btn variant="ghost" onClick={() => handleReview(request.leaveRequestID, 'Rejected')} disabled={reviewingId === request.leaveRequestID}>
                        {reviewingId === request.leaveRequestID ? t('Saving...') : t('Reject')}
                      </Btn>
                    </div>
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
