import { useEffect, useState } from 'react';
import { getJobs, submitResume } from '../../api/index.js';
import { Spinner, Modal, Btn } from '../../components/shared/index.jsx';

export function EmployeeCareersPage() {
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState('');
  const [selected, setSelected]   = useState(null);
  const [search, setSearch]       = useState('');
  const [showApply, setShowApply] = useState(false);
  const [file, setFile]           = useState(null);
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadJobs = async () => {
      setLoading(true);
      setApiError('');
      try {
        const data = await getJobs();
        const nextJobs = Array.isArray(data) ? data : [];
        if (cancelled) return;
        setJobs(nextJobs);
        setSelected(current => current && nextJobs.some(job => job.id === current.id)
          ? current
          : (nextJobs[0] || null));
      } catch {
        if (cancelled) return;
        setApiError('Could not reach API');
      }
      if (!cancelled) setLoading(false);
    };

    loadJobs();
    return () => { cancelled = true; };
  }, []);

  const getSearchText = (job) => [
    job.title,
    job.description,
    job.required_degree,
    ...(Array.isArray(job.required_skills) ? job.required_skills : []),
  ].filter(Boolean).join(' ').toLowerCase();

  const filtered = jobs.filter(j =>
    getSearchText(j).includes(search.toLowerCase())
  );

  const handleApply = async () => {
    if (!file) { toast('Please upload your resume', 'error'); return; }
    if (!name.trim()) { toast('Please enter your name', 'error'); return; }
    if (!email.trim()) { toast('Please enter your email', 'error'); return; }
    setSubmitting(true);
    setResult(null);
    const fd = new FormData();
    fd.append('job', selected.id);
    fd.append('resume_file', file, file.name);
    fd.append('candidate_name', name);
    fd.append('candidate_email', email);
    try {
      const data = await submitResume(fd);
      setResult(data);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setSubmitting(false);
  };

  return (
    <div>
      {/* Hero */}
      <section style={{ background: 'var(--white)', borderBottom: '1px solid #EAECF0', padding: '64px 32px 56px', textAlign: 'center' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px,5vw,56px)', fontWeight: 400, lineHeight: 1.12, maxWidth: 700 }}>
            Build the future of HR tech <em style={{ color: 'var(--red)', fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: '#FDDDD7', textUnderlineOffset: 6 }}>with us.</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 480, lineHeight: 1.6 }}>Join a team of visionaries redefining how people work, grow, and succeed.</p>
          <div style={{ width: '100%', maxWidth: 560, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, stroke: 'var(--gray-300)', fill: 'none', pointerEvents: 'none' }} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by role or department..."
              style={{ width: '100%', padding: '16px 20px 16px 50px', border: '2px solid transparent', background: 'var(--gray-100)', borderRadius: 9999, fontSize: 15, fontFamily: 'var(--sans)', fontWeight: 500, color: 'var(--gray-900)', outline: 'none' }}
              onFocus={e => { e.target.style.background = 'var(--white)'; e.target.style.borderColor = 'var(--red)'; }}
              onBlur={e => { e.target.style.background = 'var(--gray-100)'; e.target.style.borderColor = 'transparent'; }}
            />
          </div>
        </div>
      </section>

      {/* Jobs */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? 'Loading...' : `${filtered.length} Open Positions`}</div>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filtered.map(j => (
                <div key={j.id} onClick={() => setSelected(j)} style={{
                  background: 'var(--white)', borderRadius: 28, padding: 28, cursor: 'pointer',
                  border: `2px solid ${selected?.id === j.id ? 'var(--red)' : '#EAECF0'}`,
                  transition: 'all .2s',
                  boxShadow: selected?.id === j.id ? '0 0 0 4px rgba(232,50,26,.08)' : 'none',
                }}
                  onMouseEnter={e => { if (selected?.id !== j.id) { e.currentTarget.style.borderColor = 'var(--red-mid)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
                  onMouseLeave={e => { if (selected?.id !== j.id) { e.currentTarget.style.borderColor = '#EAECF0'; e.currentTarget.style.transform = 'none'; }}}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{j.title}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>
                        {j.required_degree || 'Open Role'}
                      </div>
                    </div>
                    <div style={{ width: 32, height: 32, background: 'var(--gray-100)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" fill="none" stroke="var(--gray-400)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                    {[
                      [j.required_degree || 'Any Degree'],
                      [`${j.min_experience_years || 0}+ yrs exp`],
                    ].map(([val]) => (
                      <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 500 }}>
                        <svg width="14" height="14" fill="none" stroke="var(--gray-300)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                        {val}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                    {(j.required_skills || []).slice(0, 3).map(skill => (
                      <span key={skill} style={{ padding: '4px 10px', borderRadius: 9999, background: 'var(--gray-100)', color: 'var(--gray-500)', fontSize: 11, fontWeight: 700 }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Req. {j.min_experience_years || 0}+ yrs</span>
                    <Btn size="sm" onClick={(e) => { e.stopPropagation(); setSelected(j); setShowApply(true); setResult(null); }}>Apply Now</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && apiError && jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)' }}>
              <p style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700 }}>{apiError}</p>
            </div>
          ) : !loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)' }}>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 600 }}>No roles match your search right now.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside>
          {!selected ? (
            <div style={{ textAlign: 'center', padding: '64px 32px', border: '2px dashed var(--gray-300)', borderRadius: 28, background: 'var(--white)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-300)', textTransform: 'uppercase', letterSpacing: '.1em' }}>No Selection</p>
            </div>
          ) : (
            <div style={{ background: 'var(--white)', borderRadius: 28, border: '1px solid #EAECF0', padding: 32, boxShadow: 'var(--shadow-lg)', position: 'sticky', top: 96 }}>
              <span style={{ display: 'inline-flex', padding: '5px 12px', background: 'var(--accent-light)', color: '#8B4A42', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', marginBottom: 16 }}>
                JP-{String(selected.id).padStart(3, '0')}
              </span>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, lineHeight: 1.2, marginBottom: 6 }}>{selected.title}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <span style={{ padding: '5px 10px', borderRadius: 9999, background: 'var(--gray-100)', color: 'var(--gray-500)', fontSize: 11, fontWeight: 700 }}>
                  {selected.required_degree || 'Any Degree'}
                </span>
                <span style={{ padding: '5px 10px', borderRadius: 9999, background: 'var(--gray-100)', color: 'var(--gray-500)', fontSize: 11, fontWeight: 700 }}>
                  {selected.min_experience_years || 0}+ years
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--gray-500)', lineHeight: 1.65, marginBottom: 22 }}>{selected.description}</p>
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                  Key Skills
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(selected.required_skills || []).map(skill => (
                    <span key={skill} style={{ padding: '6px 10px', borderRadius: 9999, background: 'var(--red-light)', color: 'var(--red)', fontSize: 11, fontWeight: 700 }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <Btn onClick={() => { setShowApply(true); setResult(null); }} style={{ width: '100%', padding: 15 }}>
                Apply Now
                <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Btn>
            </div>
          )}
        </aside>
      </div>

      {/* Apply modal */}
      <Modal open={showApply} onClose={() => { setShowApply(false); setResult(null); }} title={result ? 'Pipeline Results' : `Apply for ${selected?.title}`} maxWidth={580}>
        {result ? (
          <div>
            <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid #F3F4F6', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.15em', color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>ATS Match Score</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 68, color: result.ats_score >= 70 ? '#22C55E' : 'var(--red)' }}>{(result.ats_score || 0).toFixed(1)}</div>
            </div>
            {[['Skills', result.skills_score, '#E8321A'], ['Experience', result.experience_score, '#3B82F6'], ['Education', result.education_score, '#F59E0B'], ['Semantic', result.semantic_score, '#10B981']].map(([l, v, c]) => (
              <div key={l} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  <span style={{ color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{l}</span>
                  <span style={{ fontWeight: 700 }}>{(v || 0).toFixed(1)}%</span>
                </div>
                <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${v || 0}%`, background: c, borderRadius: 2 }}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div onClick={() => document.getElementById('resume-input').click()}
              style={{ padding: 28, background: 'var(--red-light)', border: '2px dashed var(--red-mid)', borderRadius: 24, textAlign: 'center', cursor: 'pointer', marginBottom: 20 }}>
              <input type="file" id="resume-input" accept=".pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
              <svg width="22" height="22" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24" style={{ margin: '0 auto 8px', display: 'block' }}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{file ? `Selected: ${file.name}` : 'Upload Resume (PDF)'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--gray-700)' }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={{ width: '100%', padding: '12px 16px', background: 'var(--gray-100)', border: '2px solid transparent', borderRadius: 14, fontSize: 14, outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--gray-700)' }}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" type="email" style={{ width: '100%', padding: '12px 16px', background: 'var(--gray-100)', border: '2px solid transparent', borderRadius: 14, fontSize: 14, outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn variant="ghost" onClick={() => setShowApply(false)} style={{ flex: 1 }}>Cancel</Btn>
              <Btn onClick={handleApply} style={{ flex: 1 }} disabled={submitting}>{submitting ? 'Analysing...' : 'Submit Application'}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
