import { useState, useEffect } from 'react';
import { getJobs, createJob, updateJob, deleteJob, updateJobWeights } from '../../api/index.js';
import { Spinner, Modal, Input, Textarea, Btn, Badge, useToast } from '../../components/shared/index.jsx';

export function HRJobsPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [jobData, setJobData] = useState({ title: '', description: '', min_experience_years: 0, required_degree: 'Any' });
  const [weightsData, setWeightsData] = useState({ weight_skills: 0.4, weight_experience: 0.3, weight_education: 0.1, weight_semantic: 0.2 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      toast('Failed to load jobs: ' + (e.message || 'network error'), 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!jobData.title.trim()) { toast('Job title is required', 'error'); return; }
    if (!jobData.description.trim()) { toast('Job description is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await createJob(jobData);
      if (res.id || res.ID) {
        toast('Job created successfully');
        setShowCreate(false);
        setJobData({ title: '', description: '', min_experience_years: 0, required_degree: 'Any' });
        load();
      } else {
        toast('Failed to create job', 'error');
      }
    } catch (e) {
      toast('Error: ' + (e.message || 'Failed to create job'), 'error');
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!jobData.title.trim()) { toast('Job title is required', 'error'); return; }
    if (!jobData.description.trim()) { toast('Job description is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await updateJob(selectedJob.id, jobData);
      if (res.id || res.ID) {
        toast('Job updated successfully');
        setShowEdit(false);
        load();
      } else {
        toast('Failed to update job', 'error');
      }
    } catch (e) {
      toast('Error: ' + (e.message || 'Failed to update job'), 'error');
    }
    setSaving(false);
  };

  const handleUpdateWeights = async () => {
    const total = (weightsData.weight_skills + weightsData.weight_experience + weightsData.weight_education + weightsData.weight_semantic).toFixed(3);
    if (Math.abs(parseFloat(total) - 1.0) > 0.001) {
      toast(`Weights must sum to 1.0 (currently ${total})`, 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await updateJobWeights(selectedJob.id, weightsData);
      if (res.id || res.ID || res.weight_skills !== undefined) {
        toast('Weights updated successfully');
        setShowWeights(false);
        load();
      } else {
        toast('Failed to update weights', 'error');
      }
    } catch (e) {
      toast('Error: ' + (e.message || 'Failed to update weights'), 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (job) => {
    if (!window.confirm(`Delete job "${job.title}"? This cannot be undone.`)) return;
    try {
      await deleteJob(job.id);
      toast('Job deleted');
      if (selectedJob?.id === job.id) setSelectedJob(null);
      load();
    } catch (e) {
      toast('Error: ' + (e.message || 'Failed to delete job'), 'error');
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Job Management</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>Create and manage recruitment job postings</p>
        </div>
        <Btn onClick={() => { setJobData({ title: '', description: '', min_experience_years: 0, required_degree: 'Any' }); setShowCreate(true); }}>
          <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Job
        </Btn>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>

          {/* Jobs list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)' }}>
                <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>No jobs yet. Create one to get started.</p>
              </div>
            )}
            {jobs.map(job => (
              <div key={job.id}
                onClick={() => { setSelectedJob(job); setWeightsData({ weight_skills: job.weight_skills, weight_experience: job.weight_experience, weight_education: job.weight_education, weight_semantic: job.weight_semantic }); }}
                style={{
                  background: 'var(--white)', borderRadius: 20, padding: '20px 22px',
                  border: `2px solid ${selectedJob?.id === job.id ? 'var(--red)' : '#EAECF0'}`,
                  cursor: 'pointer', transition: 'all .2s',
                  boxShadow: selectedJob?.id === job.id ? '0 0 0 4px rgba(232,50,26,.08)' : 'none',
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={job.is_active ? 'Active' : 'Inactive'} color={job.is_active ? 'green' : 'gray'} />
                      <Badge label={`${job.submission_count || 0} submissions`} color="accent" />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <Btn size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedJob(job); setJobData({ title: job.title, description: job.description, min_experience_years: job.min_experience_years || 0, required_degree: job.required_degree || 'Any' }); setShowEdit(true); }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleDelete(job); }}>
                    <svg width="13" height="13" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </Btn>
                </div>
              </div>
            ))}
          </div>

          {/* Job detail / view */}
          {selectedJob ? (
            <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedJob.title}</div>
                  <Badge label={`${selectedJob.submission_count || 0} Submissions`} color="accent" />
                </div>
                <Btn size="sm" onClick={() => setShowWeights(true)}>
                  <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.08 2.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.08-2.08l4.24-4.24M19.78 19.78l-4.24-4.24m-2.08-2.08l-4.24-4.24"/></svg>
                  Weights
                </Btn>
              </div>
              <div style={{ padding: '24px 28px' }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Description</div>
                  <div style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.6 }}>{selectedJob.description || '—'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Min Experience</div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedJob.min_experience_years || 0} years</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Required Degree</div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedJob.required_degree || 'Any'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Required Skills</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(selectedJob.required_skills || []).map((skill, i) => (
                      <Badge key={i} label={skill} color="gray" />
                    ))}
                    {(!selectedJob.required_skills || selectedJob.required_skills.length === 0) && (
                      <span style={{ fontSize: 13, color: 'var(--gray-300)' }}>Auto-extracted from description</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)', padding: '80px 32px', textAlign: 'center' }}>
              <svg width="44" height="44" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 12px', display: 'block' }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>Select a job to view details</p>
            </div>
          )}
        </div>
      )}

      {/* Create job modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Job">
        <Input label="Job Title *" value={jobData.title} onChange={e => setJobData(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Senior Python Developer" />
        <Textarea label="Job Description *" value={jobData.description} onChange={e => setJobData(d => ({ ...d, description: e.target.value }))} placeholder="Full job description (skills will be auto-extracted)..." style={{ minHeight: 120 }} />
        <Input label="Min Experience (years)" type="number" value={jobData.min_experience_years} onChange={e => setJobData(d => ({ ...d, min_experience_years: parseFloat(e.target.value) || 0 }))} />
        <Input label="Required Degree" value={jobData.required_degree} onChange={e => setJobData(d => ({ ...d, required_degree: e.target.value }))} placeholder="e.g. Bachelor's, Master's, Any" />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleCreate} style={{ flex: 1 }} disabled={saving}>{saving ? 'Creating...' : 'Create Job'}</Btn>
        </div>
      </Modal>

      {/* Edit job modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Job">
        <Input label="Job Title *" value={jobData.title} onChange={e => setJobData(d => ({ ...d, title: e.target.value }))} />
        <Textarea label="Job Description *" value={jobData.description} onChange={e => setJobData(d => ({ ...d, description: e.target.value }))} style={{ minHeight: 120 }} />
        <Input label="Min Experience (years)" type="number" value={jobData.min_experience_years} onChange={e => setJobData(d => ({ ...d, min_experience_years: parseFloat(e.target.value) || 0 }))} />
        <Input label="Required Degree" value={jobData.required_degree} onChange={e => setJobData(d => ({ ...d, required_degree: e.target.value }))} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowEdit(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleUpdate} style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
        </div>
      </Modal>

      {/* Edit weights modal */}
      <Modal open={showWeights} onClose={() => setShowWeights(false)} title="Scoring Weights">
        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 16 }}>Adjust how each component affects the final ATS score. Must sum to 100%.</p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>Skills Match: {Math.round(weightsData.weight_skills * 100)}%</label>
          <input type="range" min="0" max="1" step="0.05" value={weightsData.weight_skills} onChange={e => setWeightsData(d => ({ ...d, weight_skills: parseFloat(e.target.value) }))} style={{ width: '100%', height: 6, borderRadius: 3 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>Experience Match: {Math.round(weightsData.weight_experience * 100)}%</label>
          <input type="range" min="0" max="1" step="0.05" value={weightsData.weight_experience} onChange={e => setWeightsData(d => ({ ...d, weight_experience: parseFloat(e.target.value) }))} style={{ width: '100%', height: 6, borderRadius: 3 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>Education Match: {Math.round(weightsData.weight_education * 100)}%</label>
          <input type="range" min="0" max="1" step="0.05" value={weightsData.weight_education} onChange={e => setWeightsData(d => ({ ...d, weight_education: parseFloat(e.target.value) }))} style={{ width: '100%', height: 6, borderRadius: 3 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>Semantic Match: {Math.round(weightsData.weight_semantic * 100)}%</label>
          <input type="range" min="0" max="1" step="0.05" value={weightsData.weight_semantic} onChange={e => setWeightsData(d => ({ ...d, weight_semantic: parseFloat(e.target.value) }))} style={{ width: '100%', height: 6, borderRadius: 3 }} />
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: 'var(--gray-50)', marginBottom: 16, fontSize: 13 }}>
          <strong>Total: {Math.round((weightsData.weight_skills + weightsData.weight_experience + weightsData.weight_education + weightsData.weight_semantic) * 100)}%</strong>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="ghost" onClick={() => setShowWeights(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleUpdateWeights} style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Apply Weights'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
