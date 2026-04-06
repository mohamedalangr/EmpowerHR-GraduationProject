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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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
                  <Badge label={t(shift.status)} color={STATUS_COLORS[shift.status] || 'gray'} />
                </div>

                {shift.notes && (
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14 }}>{shift.notes}</p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 12, alignItems: 'end' }}>
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
