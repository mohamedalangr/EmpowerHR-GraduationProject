import { useState, useEffect, useCallback } from 'react';
import { getForms, submitFeedback } from '../../api/index.js';
import { Spinner, Modal, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { useAuth } from "../../context/AuthContext";


function RatingButtons({ question, value, onChange, disabled }) {
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
          <span>Poor</span><span>Excellent</span>
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
          }}>{v ? 'Yes' : 'No'}</button>
        ))}
      </div>
    );
  }
  if (question.fieldType === 'decimal') {
    return (
      <input type="number" step="0.1" min="0" disabled={disabled}
        value={value ?? ''} onChange={e => onChange(parseFloat(e.target.value) || null)}
        placeholder="Enter a number"
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
  const { user } = useAuth();
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

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Feedback Forms</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>Complete satisfaction surveys and view past submissions</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Pending', value: pending, grad: 'linear-gradient(135deg,#E8321A,#c4240f)' },
          { label: 'Completed', value: completed, grad: 'linear-gradient(135deg,#22C55E,#16a34a)' },
          { label: 'Total', value: forms.length, grad: 'linear-gradient(135deg,#D5A499,#b8837a)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.grad, borderRadius: 24, padding: '24px 28px', color: '#fff', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: .85, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 400 }}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {/* Forms grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : forms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 32px', background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>No active feedback forms at the moment.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {forms.map(form => {
            const status = getStatus(form);
            const isPending = status === 'pending';
            return (
              <div key={form.formID} onClick={() => handleOpen(form)} style={{
                background: 'var(--white)', borderRadius: 28, padding: '26px',
                border: `2px solid ${isPending ? 'var(--red-mid)' : '#EAECF0'}`,
                cursor: 'pointer', transition: 'all .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: isPending ? 'var(--red-light)' : '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" fill="none" stroke={isPending ? 'var(--red)' : '#16a34a'} strokeWidth="2" viewBox="0 0 24 24">
                      {isPending
                        ? <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></>
                        : <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                      }
                    </svg>
                  </div>
                  <Badge label={isPending ? 'Pending' : 'Completed'} color={isPending ? 'red' : 'green'} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{form.title}</h3>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>{form.questions?.length || 0} questions</p>
                {form.description && <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 16, lineHeight: 1.5 }}>{form.description}</p>}
                <button style={{
                  width: '100%', padding: 11, borderRadius: 14, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: isPending ? 'var(--red)' : 'var(--gray-100)',
                  color: isPending ? '#fff' : 'var(--gray-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: isPending ? 'var(--shadow-red)' : 'none',
                }}>
                  {isPending ? 'Fill Form' : 'View Responses'}
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
                  <Btn variant="ghost" onClick={() => setOpenForm(null)} style={{ flex: 1 }}>Cancel</Btn>
                  <Btn onClick={handleSubmit} style={{ flex: 1 }} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                  </Btn>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#DCFCE7', color: '#15803D', borderRadius: 14, fontSize: 13, fontWeight: 700 }}>
                    <svg width="18" height="18" fill="none" stroke="#15803D" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    This form has been completed
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
