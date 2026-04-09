import { useEffect, useMemo, useState } from 'react';
import { acknowledgeMyShift, getMyShifts } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Planned: 'gray',
  Confirmed: 'orange',
  Completed: 'green',
  Swapped: 'red',
};

const daysUntilDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
};

const getShiftWindowLabel = (value, t) => {
  const days = daysUntilDate(value);
  if (!Number.isFinite(days)) return t('No shift date');
  if (days < 0) return `${Math.abs(days)} ${t('days ago')}`;
  if (days === 0) return t('Today');
  if (days === 1) return t('Tomorrow');
  return `${days} ${t('days away')}`;
};

const getShiftTone = (shift) => {
  const days = daysUntilDate(shift?.shiftDate);
  if (shift?.status === 'Swapped') return 'red';
  if (shift?.status === 'Completed') return 'green';
  if (shift?.status === 'Planned' && days <= 1) return 'orange';
  if (shift?.status === 'Confirmed') return 'accent';
  return STATUS_COLORS[shift?.status] || 'gray';
};

export function EmployeeShiftsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadShifts = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyShifts(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setShifts(list);
      const nextDrafts = {};
      list.forEach((shift) => {
        nextDrafts[shift.scheduleID] = {
          status: shift.status || 'Planned',
          note: shift.employeeNote || '',
        };
      });
      setDrafts(nextDrafts);
    } catch (error) {
      toast(error.message || 'Failed to load shift schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: shifts.length,
    upcoming: shifts.filter((shift) => shift.status === 'Planned' || shift.status === 'Confirmed').length,
    completed: shifts.filter((shift) => shift.status === 'Completed').length,
  }), [shifts]);

  const plannedCount = shifts.filter((shift) => shift.status === 'Planned').length;
  const swappedCount = shifts.filter((shift) => shift.status === 'Swapped').length;
  const todayShiftCount = shifts.filter((shift) => daysUntilDate(shift.shiftDate) === 0).length;
  const dueSoonCount = shifts.filter((shift) => ['Planned', 'Confirmed'].includes(shift.status) && Number.isFinite(daysUntilDate(shift.shiftDate)) && daysUntilDate(shift.shiftDate) <= 2).length;

  const shiftFocusQueue = useMemo(() => {
    const statusRank = { Swapped: 4, Planned: 3, Confirmed: 2, Completed: 1 };
    return [...shifts]
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || daysUntilDate(a.shiftDate) - daysUntilDate(b.shiftDate)
        || String(a.shiftType || '').localeCompare(String(b.shiftType || '')))
      .slice(0, 4);
  }, [shifts]);

  const shiftTypePressureMap = useMemo(() => {
    const grouped = shifts.reduce((acc, shift) => {
      const key = shift.shiftType || 'Other';
      if (!acc[key]) {
        acc[key] = { shiftType: key, count: 0, plannedCount: 0, swappedCount: 0, completedCount: 0 };
      }
      acc[key].count += 1;
      if (shift.status === 'Planned') acc[key].plannedCount += 1;
      if (shift.status === 'Swapped') acc[key].swappedCount += 1;
      if (shift.status === 'Completed') acc[key].completedCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.plannedCount - a.plannedCount || b.swappedCount - a.swappedCount || b.count - a.count)
      .slice(0, 4);
  }, [shifts]);

  const shiftPlaybook = useMemo(() => {
    const plays = [];

    if (swappedCount > 0) {
      plays.push({
        title: t('Resolve swap requests early'),
        note: t('Swapped shifts are the clearest risk to coverage, so confirm replacements before the next roster window.'),
      });
    }
    if (dueSoonCount > 0) {
      plays.push({
        title: t('Confirm the next shifts now'),
        note: t('Near-term planned shifts are best handled early so there is no last-minute uncertainty.'),
      });
    }
    if (plannedCount > 0) {
      plays.push({
        title: t('Keep planned work visible'),
        note: t('A quick status update on planned shifts helps HR see whether any schedule support is needed.'),
      });
    }
    if (todayShiftCount > 0) {
      plays.push({
        title: t('Close out today cleanly'),
        note: t('Today’s shifts are the best place to keep notes current so payroll and attendance remain aligned.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Coverage flow looks stable'),
      note: t('Your shift schedule looks steady right now, so keep confirming upcoming work and adding notes when needed.'),
    }];
  }, [dueSoonCount, plannedCount, swappedCount, t, todayShiftCount]);

  const strongestSignal = swappedCount > 0
    ? t('One or more shifts are marked as swapped, so coverage confirmation is the clearest priority right now.')
    : dueSoonCount > 0
      ? t('Several upcoming shifts are close, making early confirmation the best next move.')
      : plannedCount > 0
        ? t('You still have planned shifts waiting for confirmation, so keeping the schedule current is the main focus.')
        : t('Your shift schedule looks stable right now, with no major coverage pressure standing out.');

  const setDraftField = (scheduleID, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [scheduleID]: {
        ...(prev[scheduleID] || {}),
        [key]: value,
      },
    }));
  };

  const handleAcknowledge = async (scheduleID) => {
    const draft = drafts[scheduleID];
    if (!draft) return;

    setSavingId(scheduleID);
    try {
      await acknowledgeMyShift(scheduleID, {
        status: draft.status,
        note: draft.note || '',
      });
      toast('Shift updated');
      await loadShifts();
    } catch (error) {
      toast(error.message || 'Failed to update shift schedule', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Shifts')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Review your assigned schedule, confirm upcoming shifts, and add notes for HR.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Total Shifts'), value: stats.total, accent: '#111827' },
          { label: t('Upcoming'), value: stats.upcoming, accent: '#F59E0B' },
          { label: t('Completed'), value: stats.completed, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Shift Coverage Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Planned'), value: plannedCount, color: '#E8321A', note: t('Shifts still waiting for employee confirmation or final status.') },
                { label: t('Swapped'), value: swappedCount, color: '#DC2626', note: t('Schedule changes that may need coverage review or extra follow-up.') },
                { label: t('Today'), value: todayShiftCount, color: '#175CD3', note: t('Shifts happening today that are most relevant for live coordination.') },
                { label: t('Due Soon'), value: dueSoonCount, color: '#027A48', note: t('Upcoming shifts in the next two days that deserve early attention.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Shift Queue')}</h3>
            </div>
            {shiftFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority shift items will appear here as schedules are assigned.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {shiftFocusQueue.map((shift) => (
                  <div key={`queue-${shift.scheduleID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{t(shift.shiftType)} {t('Shift')}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{shift.shiftDate} • {shift.startTime} to {shift.endTime}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{getShiftWindowLabel(shift.shiftDate, t)}</div>
                    </div>
                    <Badge label={t(shift.status)} color={getShiftTone(shift)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Shift Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {shiftPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Shift Type Pressure')}</div>
            {shiftTypePressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No shift-type pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {shiftTypePressureMap.map((item) => (
                  <div key={item.shiftType} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.shiftType)}</div>
                      <Badge label={`${item.count} ${t('shifts')}`} color={item.plannedCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Planned')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.plannedCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Swapped')}</div>
                        <div style={{ fontWeight: 700, color: '#DC2626' }}>{item.swappedCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Completed')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.completedCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : shifts.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No shifts assigned yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR can assign upcoming shifts from the Shifts page.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {shifts.map((shift) => {
            const draft = drafts[shift.scheduleID] || { status: shift.status, note: shift.employeeNote || '' };
            return (
              <div key={shift.scheduleID} className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t(shift.shiftType)} {t('Shift')}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {shift.shiftDate} • {shift.startTime} to {shift.endTime} • {shift.location || 'Location TBD'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Badge label={getShiftWindowLabel(shift.shiftDate, t)} color={getShiftTone(shift)} />
                    <Badge label={t(shift.status)} color={getShiftTone(shift)} />
                  </div>
                </div>

                {shift.notes && (
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14 }}>{shift.notes}</p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
                    <select
                      value={draft.status}
                      onChange={(e) => setDraftField(shift.scheduleID, 'status', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}
                    >
                      {['Confirmed', 'Completed', 'Swapped'].map((item) => (
                        <option key={item} value={item}>{t(item)}</option>
                      ))}
                    </select>
                  </div>

                  <Textarea
                    label={t('Note')}
                    value={draft.note}
                    onChange={(e) => setDraftField(shift.scheduleID, 'note', e.target.value)}
                    placeholder={t('Add any shift note or swap request')}
                  />

                  <Btn onClick={() => handleAcknowledge(shift.scheduleID)} disabled={savingId === shift.scheduleID}>
                    {savingId === shift.scheduleID ? t('Saving...') : t('Update')}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
