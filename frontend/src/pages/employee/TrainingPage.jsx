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

const daysUntilDue = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
};

const getDueWindowLabel = (value, t) => {
  const days = daysUntilDue(value);
  if (!Number.isFinite(days)) return t('No due date');
  if (days < 0) return `${Math.abs(days)} ${t('days overdue')}`;
  if (days === 0) return t('Due today');
  if (days === 1) return t('Due tomorrow');
  return `${days} ${t('days left')}`;
};

const getLearningTone = (course) => {
  if (course?.status === 'Completed') return 'green';
  if (daysUntilDue(course?.dueDate) <= 7) return 'red';
  if (course?.status === 'In Progress') return 'orange';
  return 'accent';
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

  const completionMomentum = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const dueSoonCount = courses.filter((course) => course.status !== 'Completed' && daysUntilDue(course.dueDate) <= 7).length;
  const notStartedCount = courses.filter((course) => course.status === 'Not Started').length;
  const shortCourseCount = courses.filter((course) => course.status !== 'Completed' && Number(course.durationHours || 0) > 0 && Number(course.durationHours || 0) <= 2).length;

  const learningFocusQueue = useMemo(() => {
    const statusRank = { 'Not Started': 3, 'In Progress': 2, Completed: 1 };
    return [...courses]
      .filter((course) => course.status !== 'Completed')
      .sort((a, b) => daysUntilDue(a.dueDate) - daysUntilDue(b.dueDate)
        || (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || Number(a.progress || 0) - Number(b.progress || 0)
        || Number(a.durationHours || 0) - Number(b.durationHours || 0))
      .slice(0, 4);
  }, [courses]);

  const categoryPressureMap = useMemo(() => {
    const grouped = courses.reduce((acc, course) => {
      if (course.status === 'Completed') return acc;
      const key = course.category || 'General';
      if (!acc[key]) {
        acc[key] = { category: key, openCount: 0, dueSoonCount: 0, durationHours: 0 };
      }
      acc[key].openCount += 1;
      acc[key].durationHours += Number(course.durationHours || 0);
      if (daysUntilDue(course.dueDate) <= 7) acc[key].dueSoonCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.openCount - a.openCount || b.dueSoonCount - a.dueSoonCount || b.durationHours - a.durationHours)
      .slice(0, 4);
  }, [courses]);

  const learningPlaybook = useMemo(() => {
    const plays = [];

    if (dueSoonCount > 0) {
      plays.push({
        title: t('Protect the closest deadlines'),
        note: t('Courses due soon should get focused time first so compliance and development plans stay on track.'),
      });
    }
    if (notStartedCount > 0) {
      plays.push({
        title: t('Start untouched courses early'),
        note: t('Starting one not-yet-begun course prevents the learning queue from stacking up later.'),
      });
    }
    if (shortCourseCount > 0) {
      plays.push({
        title: t('Use short courses as quick wins'),
        note: t('Shorter learning items can boost your completion momentum with minimal schedule disruption.'),
      });
    }
    if (stats.inProgress > 0) {
      plays.push({
        title: t('Finish what is already underway'),
        note: t('Courses already in progress are often the fastest path to a cleaner learning board.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Learning rhythm looks healthy'),
      note: t('Your assigned training is in a good place, so keep the current progress cadence going.'),
    }];
  }, [dueSoonCount, notStartedCount, shortCourseCount, stats.inProgress, t]);

  const strongestSignal = dueSoonCount > 0
    ? t('Some courses are approaching their due dates, so protecting learning time now will create the biggest payoff.')
    : notStartedCount > 0
      ? t('A few assigned courses have not started yet, making early kickoff the best next move.')
      : stats.inProgress > 0
        ? t('Several courses are already in motion, so finishing them will clean up the learning board fastest.')
        : t('Your learning workload looks steady right now, with no major pressure signals standing out.');

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
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

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Learning Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Due Soon'), value: dueSoonCount, color: '#E8321A', note: t('Courses that need attention within the next week.') },
                { label: t('Not Started'), value: notStartedCount, color: '#B54708', note: t('Assigned courses still waiting for a first step.') },
                { label: t('Quick Wins'), value: shortCourseCount, color: '#175CD3', note: t('Short courses that can improve completion momentum quickly.') },
                { label: t('Momentum'), value: `${completionMomentum}%`, color: '#027A48', note: t('Overall completion progress across your learning plan.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Learning Queue')}</h3>
            </div>
            {learningFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No active courses need follow-up right now.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {learningFocusQueue.map((course) => (
                  <div key={`queue-${course.courseID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{course.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t(course.category)} • {course.durationHours} {t('hour(s)')} • {t('Completion')} {course.progress ?? 0}%
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{t('Due')}: {course.dueDate || '—'}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <Badge label={t(course.status)} color={getLearningTone(course)} />
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>{getDueWindowLabel(course.dueDate, t)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Learning Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {learningPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Category Pressure')}</div>
            {categoryPressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No learning category pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {categoryPressureMap.map((item) => (
                  <div key={item.category} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.category)}</div>
                      <Badge label={`${item.openCount} ${t('open')}`} color={item.dueSoonCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Due Soon')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.dueSoonCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Hours')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.durationHours}</div>
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
