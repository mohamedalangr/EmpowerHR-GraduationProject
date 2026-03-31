import { useState, useEffect } from 'react';
import { Spinner, Modal, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { getJobs, createJob, updateJob, updateJobWeights } from '../../api/index.js';

const BASE = 'http://127.0.0.1:8000/api';

export function HRJobPostingsPage() {
  const toast = useToast();

  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const empty = { title: '', description: '', min_experience_years: 0, required_degree: 'Bachelor',
                  weight_skills: 0.40, weight_experience: 0.30, weight_education: 0.10, weight_semantic: 0.20 };
  const [form, setForm] = useState(empty);

  const DEGREES = ['Unknown', 'High School', 'Associate', 'Bachelor', 'Master', 'PhD'];

  const load = async () => {
    setLoading(true);
    try {
      const data = await getJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch { toast('Failed to load job postings', 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const weightsValid = () => {
    const total = +form.weight_skills + +form.weight_experience + +form.weight_education + +form.weight_semantic;
    return Math.abs(total - 1.0) < 0.001;
  };

  const handleCreate = async () => {
    if (!form.title.trim())       { toast('Title is required', 'error'); return; }
    if (!form.description.trim()) { toast('Description is required', 'error'); return; }
    if (!weightsValid())          { toast('Weights must sum to 1.0', 'error'); return; }
    setSaving(true);
    try {
      const res = await createJob(form);
      if (res.id) { toast('Job posting created'); setShowCreate(false); setForm(empty); load(); }
      else toast(res.detail ?? 'Failed to create job', 'error');
    } catch { toast('Failed to create job', 'error'); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!form.title.trim())       { toast('Title is required', 'error'); return; }
    if (!form.description.trim()) { toast('Description is required', 'error'); return; }
    if (!weightsValid())          { toast('Weights must sum to 1.0', 'error'); return; }
    setSaving(true);
    try {
      const res = await updateJob(selected.id, form);
      if (res.id) { toast('Job updated'); setShowEdit(false); load(); }
      else toast(res.detail ?? 'Failed to update job', 'error');
    } catch { toast('Failed to update job', 'error'); }
    setSaving(false);
  };

  const handleToggleActive = async (job) => {
    try {
      await updateJob(job.id, {
        title: job.title,
        description: job.description,
        min_experience_years: job.min_experience_years,
        required_degree: job.required_degree,
        weight_skills: job.weight_skills,
        weight_experience: job.weight_experience,
        weight_education: job.weight_education,
        weight_semantic: job.weight_semantic,
        is_active: !job.is_active,
      });
      toast(job.is_active ? 'Job deactivated' : 'Job activated');
      load();
    } catch { toast('Failed to update job', 'error'); }
  };

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: 'var(--gray-100)',
    border: '2px solid transparent', borderRadius: 12, fontSize: 13.5,
    outline: 'none', fontFamily: 'var(--sans)', color: 'var(--gray-900)',
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: 'var(--gray-700)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
  };

  const WeightInput = ({ label, fieldKey }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" step="0.05" min="0" max="1" style={inputStyle} {...field(fieldKey)} />
    </div>
  );

  const FormFields = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Job Title *</label>
        <input style={inputStyle} placeholder="e.g. Senior Backend Engineer" {...field('title')} />
      </div>
      <div>
        <label style={labelStyle}>Job Description *</label>
        <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
          placeholder="Full job description — skills, responsibilities, requirements..." {...field('description')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Min. Experience (years)</label>
          <input type="number" min="0" step="0.5" style={inputStyle} {...field('min_experience_years')} />
        </div>
        <div>
          <label style={labelStyle}>Required Degree</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} {...field('required_degree')}>
            {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {/* Weights */}
      <div>
        <label style={{ ...labelStyle, marginBottom: 10 }}>Scoring Weights (must sum to 1.0)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <WeightInput label="Skills"      fieldKey="weight_skills" />
          <WeightInput label="Experience"  fieldKey="weight_experience" />
          <WeightInput label="Education"   fieldKey="weight_education" />
          <WeightInput label="Semantic"    fieldKey="weight_semantic" />
        </div>
        <div style={{ fontSize: 12, color: weightsValid() ? '#22C55E' : 'var(--red)', marginTop: 6, fontWeight: 600 }}>
          Total: {(+form.weight_skills + +form.weight_experience + +form.weight_education + +form.weight_semantic).toFixed(2)}
          {weightsValid() ? ' ✓' : ' — must equal 1.0'}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Job Postings</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>Create and manage open positions visible to candidates</p>
        </div>
        <Btn onClick={() => { setForm(empty); setShowCreate(true); }}>
          <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Job Posting
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Postings',  value: jobs.length },
          { label: 'Active',          value: jobs.filter(j => j.is_active).length,  color: '#22C55E' },
          { label: 'Total Applicants',value: jobs.reduce((a, j) => a + (j.submission_count || 0), 0) },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--white)', borderRadius: 20, padding: '20px 24px', border: '1px solid #EAECF0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color ?? 'var(--gray-900)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Jobs list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px', background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)' }}>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 4 }}>No job postings yet</p>
          <p style={{ fontSize: 12, color: 'var(--gray-300)' }}>Create your first posting to start receiving applications</p>
        </div>
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['Title', 'Min. Exp', 'Degree', 'Applicants', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{job.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 2, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.description}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{job.min_experience_years}+ yrs</td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{job.required_degree}</td>
                  <td style={{ padding: '16px 20px', fontSize: 13.5, fontWeight: 600 }}>{job.submission_count ?? 0}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <Badge label={job.is_active ? 'Active' : 'Inactive'} color={job.is_active ? 'green' : 'gray'} />
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn size="sm" variant={job.is_active ? 'ghost' : 'primary'}
                        onClick={() => handleToggleActive(job)}>
                        {job.is_active ? 'Deactivate' : 'Activate'}
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => {
                        setSelected(job);
                        setForm({
                          title: job.title, description: job.description,
                          min_experience_years: job.min_experience_years,
                          required_degree: job.required_degree,
                          weight_skills: job.weight_skills, weight_experience: job.weight_experience,
                          weight_education: job.weight_education, weight_semantic: job.weight_semantic,
                        });
                        setShowEdit(true);
                      }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Job Posting" maxWidth={600}>
        <FormFields />
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleCreate} style={{ flex: 1 }} disabled={saving}>{saving ? 'Creating...' : 'Create Posting'}</Btn>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Job Posting" maxWidth={600}>
        <FormFields />
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setShowEdit(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleUpdate} style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
        </div>
      </Modal>

    </div>
  );
}
