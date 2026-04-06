import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getForms, submitFeedback } from '../../api/index.js';
import { Spinner, Modal, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from '../../context/LanguageContext';


function RatingButtons({ question, value, onChange, disabled }) {
  const { t } = useLanguage();

  if (question.fieldType === 'score_1_4') {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4].map(s => (
            <button key={s} disabled={disabled} onClick={() => onChange(s)} style={{
              flex: 1, aspectRatio: '1', borderRadius: 14,
              border: `2px solid ${value === s ? 'var(--red)' : '#EAECF0'}`,
              background: value === s ? 'var(--red)' : 'var(--white)',
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6, padding: 10,
              transition: 'all .15s',
              transform: value === s ? 'scale(1.06)' : 'scale(1)',
              boxShadow: value === s ? 'var(--shadow-red)' : 'none',
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: value === s ? '#fff' : 'var(--gray-600)' }}>{s}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={value === s ? 'rgba(255,255,255,.5)' : 'none'} stroke={value === s ? '#fff' : 'var(--gray-300)'} strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--gray-300)', fontWeight: 500, marginTop: 8, padding: '0 2px' }}>
          <span>{t('Poor')}</span><span>{t('Excellent')}</span>
        </div>
      </div>
    );
  }
  if (question.fieldType === 'boolean') {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {[true, false].map(v => (
          <button key={String(v)} disabled={disabled} onClick={() => onChange(v)} style={{
            flex: 1, padding: '14px', borderRadius: 14, fontWeight: 700, fontSize: 14,
            border: `2px solid ${value === v ? 'var(--red)' : '#EAECF0'}`,
            background: value === v ? 'var(--red)' : 'var(--white)',
            color: value === v ? '#fff' : 'var(--gray-600)',
            cursor: disabled ? 'default' : 'pointer', transition: 'all .15s',
          }}>{v ? t('Yes') : t('No')}</button>
        ))}
      </div>
    );
  }
  if (question.fieldType === 'decimal') {
    return (
      <input type="number" step="0.1" min="0" disabled={disabled}
        value={value ?? ''} onChange={e => onChange(parseFloat(e.target.value) || null)}
        placeholder={t('Enter a number')}
        style={{
          width: '100%', maxWidth: 200, padding: '12px 16px',
          background: 'var(--gray-100)', border: '2px solid transparent',
          borderRadius: 14, fontSize: 14, fontWeight: 500, outline: 'none',
        }}
      />
    );
  }
  return null;
}

export function EmployeeFeedbackPage() {
  const { user, resolvePath } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const EMPLOYEE_ID = user?.employee_id;
  const toast = useToast();
  const [forms, setForms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [openForm, setOpenForm]   = useState(null);
  const [answers, setAnswers]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getForms(EMPLOYEE_ID);
      setForms(Array.isArray(data) ? data : []);
    } catch { toast('Failed to load forms', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getStatus = (form) =>
    form.submission?.status === 'Completed' ? 'completed' : 'pending';

  const handleOpen = (form) => {
    setOpenForm(form);
    const saved = {};
    if (form.submission?.answers) {
      form.submission.answers.forEach(a => {
        saved[a.questionID] = a.scoreValue ?? a.booleanValue ?? a.decimalValue;
      });
    }
    setAnswers(saved);
  };

  const handleSubmit = async () => {
    const unanswered = openForm.questions.filter(q => answers[q.questionID] === undefined);
    if (unanswered.length > 0) { toast('Please answer all questions', 'error'); return; }

    const payload = {
      employeeID: EMPLOYEE_ID,
      answers: openForm.questions.map(q => {
        const val = answers[q.questionID];
        if (q.fieldType === 'score_1_4') return { questionID: q.questionID, scoreValue: val };
        if (q.fieldType === 'boolean')   return { questionID: q.questionID, booleanValue: val };
        if (q.fieldType === 'decimal')   return { questionID: q.questionID, decimalValue: val };
        return { questionID: q.questionID };
      }),
    };

    setSubmitting(true);
    try {
      const res = await submitFeedback(openForm.formID, payload);
      if (res.submissionID) {
        toast('Feedback submitted successfully!');
        setOpenForm(null);
        load();
      } else throw new Error(JSON.stringify(res));
    } catch (e) {
      toast('Submission failed: ' + e.message, 'error');
    }
    setSubmitting(false);
  };

  const pending   = forms.filter(f => getStatus(f) === 'pending').length;
  const completed = forms.filter(f => getStatus(f) === 'completed').length;
  const completionRate = forms.length ? Math.round((completed / forms.length) * 100) : 0;
  const averageQuestions = forms.length
    ? Math.round(forms.reduce((sum, form) => sum + (form.questions?.length || 0), 0) / forms.length)
    : 0;
  const sortedForms = useMemo(
    () => [...forms].sort((a, b) => {
      const aPending = getStatus(a) === 'pending' ? 0 : 1;
      const bPending = getStatus(b) === 'pending' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (a.title || '').localeCompare(b.title || '');
    }),
    [forms],
  );
  const nextPendingForm = sortedForms.find((form) => getStatus(form) === 'pending') || null;

  return (
    <div className="hr-page-shell">
      {/* Header */}
      <div className="hr-page-header">
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Feedback Forms')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>{t('Complete satisfaction surveys and view past submissions')}</p>
      </div>

      {/* Stats */}
      <div className="hr-stats-grid" style={{ marginBottom: 28 }}>
        {[
          { label: t('Pending'), value: pending, grad: 'linear-gradient(135deg,#E8321A,#c4240f)' },
          { label: t('Completed'), value: completed, grad: 'linear-gradient(135deg,#22C55E,#16a34a)' },
          { label: t('Total'), value: forms.length, grad: 'linear-gradient(135deg,#D5A499,#b8837a)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.grad, borderRadius: 24, padding: '24px 28px', color: '#fff', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: .85, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 400 }}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Feedback Progress')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-900)' }}>{loading ? '—' : `${completionRate}%`}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('Completion Rate')}</div>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${completionRate}%`, height: '100%', background: completionRate === 100 ? '#16A34A' : 'var(--red)', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color="red" label={`${t('Pending')} ${pending}`} />
            <Badge color="green" label={`${t('Completed')} ${completed}`} />
            <Badge color="accent" label={`${t('Avg Questions')} ${averageQuestions}`} />
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Next Best Action')}</div>
          {nextPendingForm ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 4 }}>{nextPendingForm.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 14 }}>
                {(nextPendingForm.questions?.length || 0)} {t('questions')} • {t('Ready to complete now')}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn onClick={() => handleOpen(nextPendingForm)}>{t('Continue Next Form')}</Btn>
                <Btn variant="ghost" onClick={load}>{t('Refresh')}</Btn>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#027A48', marginBottom: 6 }}>{t('You are all caught up')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 14 }}>{t('Review your account or come back when a new survey is published.')}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn variant="outline" onClick={() => navigate(resolvePath('/employee/profile'))}>{t('Open Profile')}</Btn>
                <Btn variant="ghost" onClick={load}>{t('Refresh')}</Btn>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Forms grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : forms.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500, marginBottom: 12 }}>{t('No active feedback forms at the moment.')}</p>
          <Btn variant="ghost" onClick={load}>{t('Refresh')}</Btn>
        </div>
      ) : (
        <div className="hr-card-grid">
          {sortedForms.map(form => {
            const status = getStatus(form);
            const isPending = status === 'pending';
            return (
              <div key={form.formID} className="hr-click-card" onClick={() => handleOpen(form)} style={{
                padding: '26px',
                border: `2px solid ${isPending ? 'var(--red-mid)' : '#EAECF0'}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: isPending ? 'var(--red-light)' : '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" fill="none" stroke={isPending ? 'var(--red)' : '#16a34a'} strokeWidth="2" viewBox="0 0 24 24">
                      {isPending
                        ? <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></>
                        : <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                      }
                    </svg>
                  </div>
                  <Badge label={isPending ? t('Pending') : t('Completed')} color={isPending ? 'red' : 'green'} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{form.title}</h3>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>{form.questions?.length || 0} {t('questions')}</p>
                {form.description && <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 16, lineHeight: 1.5 }}>{form.description}</p>}
                <button style={{
                  width: '100%', padding: 11, borderRadius: 14, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: isPending ? 'var(--red)' : 'var(--gray-100)',
                  color: isPending ? '#fff' : 'var(--gray-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: isPending ? 'var(--shadow-red)' : 'none',
                }}>
                  {isPending ? t('Fill Form') : t('View Responses')}
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      <Modal open={!!openForm} onClose={() => setOpenForm(null)} title={openForm?.title || ''} maxWidth={700}>
        {openForm && (
          <>
            {openForm.description && (
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20, lineHeight: 1.6 }}>{openForm.description}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {openForm.questions?.map((q, i) => {
                const isPending = getStatus(openForm) === 'pending';
                return (
                  <div key={q.questionID} style={{ background: 'var(--gray-50)', borderRadius: 18, padding: '20px 22px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
                      {q.fieldType.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, lineHeight: 1.45 }}>
                      {i + 1}. {q.questionText}
                    </div>
                    <RatingButtons
                      question={q}
                      value={answers[q.questionID]}
                      onChange={(val) => setAnswers(a => ({ ...a, [q.questionID]: val }))}
                      disabled={!isPending}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 24 }}>
              {getStatus(openForm) === 'pending' ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <Btn variant="ghost" onClick={() => setOpenForm(null)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
                  <Btn onClick={handleSubmit} style={{ flex: 1 }} disabled={submitting}>
                    {submitting ? t('Submitting...') : t('Submit Feedback')}
                  </Btn>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#DCFCE7', color: '#15803D', borderRadius: 14, fontSize: 13, fontWeight: 700 }}>
                    <svg width="18" height="18" fill="none" stroke="#15803D" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    {t('This form has been completed')}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
