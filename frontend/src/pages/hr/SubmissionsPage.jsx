import { useState, useEffect } from 'react';
import { hrGetForms, hrGetSubmissions } from '../../api/index.js';
import { Spinner, Badge } from '../../components/shared/index.jsx';

export function HRSubmissionsPage() {
  const [forms, setForms]             = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedForm, setSelected]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState(null);

  const [error, setError] = useState(null);

  useEffect(() => {
    const loadForms = async () => {
      setError(null);
      try {
        const data = await hrGetForms();
        const f = Array.isArray(data) ? data : [];
        setForms(f);
        if (f.length > 0) setSelected(f[0].formID);
      } catch (e) {
        setError('Failed to load forms: ' + (e.message || 'network error'));
      }
    };
    loadForms();
  }, []);

  useEffect(() => {
    if (!selectedForm) return;
    const loadSubs = async () => {
      setError(null);
      setLoading(true);
      try {
        const data = await hrGetSubmissions(selectedForm);
        setSubmissions(Array.isArray(data) ? data : []);
      } catch (e) {
        setError('Failed to load submissions: ' + (e.message || 'network error'));
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };
    loadSubs();
  }, [selectedForm]);

  const completed = submissions.filter(s => s.status === 'Completed').length;
  const pending   = submissions.filter(s => s.status === 'Pending').length;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Submissions</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>View all employee feedback submissions</p>
        </div>
        <select value={selectedForm} onChange={e => setSelected(e.target.value)} style={{
          padding: '10px 16px', borderRadius: 12, border: '1px solid var(--gray-300)',
          fontSize: 13, fontWeight: 600, background: 'var(--white)',
          color: 'var(--gray-700)', outline: 'none', cursor: 'pointer',
        }}>
          {forms.map(f => <option key={f.formID} value={f.formID}>{f.title}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total', value: submissions.length, color: 'var(--gray-900)' },
          { label: 'Completed', value: completed, color: '#22C55E' },
          { label: 'Pending', value: pending, color: 'var(--red)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--white)', borderRadius: 20, padding: '20px 24px', border: '1px solid #EAECF0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 32px', background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>No submissions for this form yet.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['Employee', 'Status', 'Submitted At', 'Answers', ''].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map(sub => (
                <>
                  <tr key={sub.submissionID} style={{ borderBottom: expanded === sub.submissionID ? 'none' : '1px solid #F3F4F6' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.employeeName || sub.employeeID}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{sub.employeeID}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <Badge label={sub.status} color={sub.status === 'Completed' ? 'green' : 'orange'} />
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--gray-500)' }}>
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13 }}>
                      {sub.answers?.length || 0} answers
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <button onClick={() => setExpanded(expanded === sub.submissionID ? null : sub.submissionID)} style={{
                        background: 'var(--gray-100)', border: 'none', borderRadius: 8,
                        padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--gray-700)',
                      }}>
                        {expanded === sub.submissionID ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expanded === sub.submissionID && (
                    <tr key={`${sub.submissionID}-expanded`}>
                      <td colSpan="5" style={{ padding: '0 20px 20px', background: 'var(--gray-50)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, paddingTop: 12 }}>
                          {sub.answers?.map(a => {
                            const val = a.scoreValue ?? (a.booleanValue !== null ? (a.booleanValue ? 'Yes' : 'No') : a.decimalValue);
                            return (
                              <div key={a.questionID} style={{ background: 'var(--white)', borderRadius: 12, padding: '12px 16px', border: '1px solid #EAECF0' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Q: {a.questionID?.slice(0, 8)}...</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>{String(val)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
