import { useEffect, useMemo, useState } from 'react';
import { getMyTraining, updateMyTrainingProgress } from '../../api/index.js';
import { Badge, Btn, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  'Not Started': 'gray',
  'In Progress': 'orange',
  Completed: 'green',
};

export function EmployeeTrainingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadCourses = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyTraining(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setCourses(list);
      const nextDrafts = {};
      list.forEach((course) => {
        nextDrafts[course.courseID] = {
          status: course.status || 'Not Started',
          progress: course.progress ?? 0,
        };
      });
      setDrafts(nextDrafts);
    } catch (error) {
      toast(error.message || 'Failed to load training courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: courses.length,
    inProgress: courses.filter((course) => course.status === 'In Progress').length,
    completed: courses.filter((course) => course.status === 'Completed').length,
  }), [courses]);

  const setDraftField = (courseID, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [courseID]: {
        ...(prev[courseID] || {}),
        [key]: value,
      },
    }));
  };

  const handleUpdate = async (courseID) => {
    const draft = drafts[courseID];
    if (!draft) return;

    setSavingId(courseID);
    try {
      await updateMyTrainingProgress(courseID, {
        status: draft.status,
        progress: Number(draft.progress || 0),
      });
      toast('Training progress updated');
      await loadCourses();
    } catch (error) {
      toast(error.message || 'Failed to update training progress', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Training')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('View assigned learning courses and update your completion progress.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Assigned Courses'), value: stats.total, accent: '#111827' },
          { label: t('In Progress'), value: stats.inProgress, accent: '#F59E0B' },
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
      ) : courses.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No training courses assigned')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR can assign new courses from the Training page.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {courses.map((course) => {
            const draft = drafts[course.courseID] || { status: course.status, progress: course.progress ?? 0 };
            return (
              <div key={course.courseID} className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{course.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {t(course.category)} • {course.durationHours} {t('hour(s)')} • {t('Due')}: {course.dueDate || '—'}
                    </div>
                  </div>
                  <Badge label={t(course.status)} color={STATUS_COLORS[course.status] || 'gray'} />
                </div>

                {course.description && (
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14 }}>{course.description}</p>
                )}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Completion')}</span>
                    <strong style={{ fontSize: 12.5 }}>{draft.progress}%</strong>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${draft.progress}%`, height: '100%', background: 'var(--red)', borderRadius: 999 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
                    <select
                      value={draft.status}
                      onChange={(e) => setDraftField(course.courseID, 'status', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}
                    >
                      {['Not Started', 'In Progress', 'Completed'].map((item) => (
                        <option key={item} value={item}>{t(item)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Progress %')}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={draft.progress}
                      onChange={(e) => setDraftField(course.courseID, 'progress', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <Btn onClick={() => handleUpdate(course.courseID)} disabled={savingId === course.courseID}>
                    {savingId === course.courseID ? t('Saving...') : t('Update')}
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
