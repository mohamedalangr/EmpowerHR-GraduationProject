import { useState, useEffect } from 'react';
import { deleteSubmission, getJobs, getJobSubmissions, submitResumeAllJobs } from '../../api/index.js';
import { Spinner, Btn, Badge, useToast } from '../../components/shared/index.jsx';

const UPLOADED_SUBMISSION_IDS_KEY = 'hr_uploaded_submission_ids';

export function HRCVRankingPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [candidatesByJobId, setCandidatesByJobId] = useState({}); // { jobId: [submissions] }
  const [loadingJobs, setLoadingJobs] = useState(true);
  
  // Upload state
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  // Results state
  const [uploadedCandidates, setUploadedCandidates] = useState([]); // All uploaded CVs with scores across jobs
  const [uploadedSubmissionIds, setUploadedSubmissionIds] = useState(() => {
    try {
      const saved = window.localStorage.getItem(UPLOADED_SUBMISSION_IDS_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selectedJobFilterId, setSelectedJobFilterId] = useState(null); // Filter results by job
  const [expandedCandidateId, setExpandedCandidateId] = useState(null); // Track expanded row for skill details

  const normalizeSkill = (skill) => String(skill || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  // Utility: Parse string skills (comma-separated/newline-separated) or arrays
  const parseSkills = (skillsData) => {
    if (!skillsData) return [];

    const rawSkills = Array.isArray(skillsData)
      ? skillsData
      : typeof skillsData === 'string'
        ? skillsData.split(/[\n,;|]+/)
        : [];

    return [...new Set(
      rawSkills
        .map(normalizeSkill)
        .filter(Boolean)
    )];
  };

  const getCandidateSkills = (candidate) => (
    candidate?.candidate_skills ||
    candidate?.extracted_skills ||
    candidate?.skills ||
    []
  );

  const skillsOverlap = (candidateSkills, requiredSkills) => {
    const cSkills = parseSkills(candidateSkills);
    const rSkills = parseSkills(requiredSkills);

    const matched = rSkills.filter(r =>
      cSkills.some(c => c === r || c.includes(r) || r.includes(c))
    );
    const missing = rSkills.filter(r => !matched.includes(r));
    const extra = cSkills.filter(c =>
      !rSkills.some(r => c === r || c.includes(r) || r.includes(c))
    );

    return { candidate: cSkills, required: rSkills, matched, missing, extra };
  };

  // Utility: Calculate skill match score
  const calculateSkillMatch = (candidateSkills, requiredSkills) => {
    const { candidate: cSkills, required: rSkills, matched } = skillsOverlap(candidateSkills, requiredSkills);
    
    if (rSkills.length === 0) return 100;
    if (cSkills.length === 0) return 0;
    
    return Math.round((matched.length / rSkills.length) * 100);
  };

  // Utility: Get skill overlap details
  const getSkillDetails = (candidateSkills, requiredSkills) => skillsOverlap(candidateSkills, requiredSkills);

  // Load all jobs and their submissions on mount
  useEffect(() => {
    const loadJobsAndSubmissions = async () => {
      setLoadingJobs(true);
      try {
        const jobsData = await getJobs();
        setJobs(Array.isArray(jobsData) ? jobsData : []);
        
        // Load submissions for each job
        const submissionsByJob = {};
        if (Array.isArray(jobsData)) {
          for (const job of jobsData) {
            try {
              const subs = await getJobSubmissions(job.id);
              submissionsByJob[job.id] = Array.isArray(subs) ? subs : [];
            } catch (e) {
              submissionsByJob[job.id] = [];
            }
          }
        }
        setCandidatesByJobId(submissionsByJob);
      } catch (e) {
        toast('Failed to load jobs', 'error');
      }
      setLoadingJobs(false);
    };
    loadJobsAndSubmissions();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(UPLOADED_SUBMISSION_IDS_KEY, JSON.stringify(uploadedSubmissionIds));
    } catch {
      // Ignore localStorage write issues in restricted environments
    }
  }, [uploadedSubmissionIds]);

  // Extract candidate info from file text
  const extractCandidateInfo = (text) => {
    let name = '';
    let email = '';
    
    // Extract email (pattern: text@domain.com)
    const emailMatch = text.match(/([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) email = emailMatch[1];
    
    // Extract name (first line or first capitalized word sequence)
    const lines = text.split('\n').filter(l => l.trim());
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 2 && line.length < 100 && !line.includes('@')) {
        const words = line.split(/\s+/);
        if (words.length <= 4 && words.every(w => /^[A-Z][a-z]*$/.test(w) || /^[A-Z]\.?$/.test(w))) {
          name = line;
          break;
        }
      }
    }
    
    return { name, email };
  };

  const handleFileSelection = async (e) => {
    const files = Array.from(e.target.files || []);
    const newFiles = [];

    for (const file of files) {
      let text = '';
      
      if (file.type === 'text/plain') {
        text = await file.text();
      } else if (file.name.endsWith('.pdf')) {
        // For PDF, we'll let backend handle extraction
        text = '';
      }
      
      const { name, email } = text ? extractCandidateInfo(text) : { name: '', email: '' };
      newFiles.push({
        file,
        candidateName: name,
        candidateEmail: email,
      });
      setUploadProgress(p => ({ ...p, [file.name]: { status: 'pending', score: 0 } }));
    }
    
    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const updateFileInfo = (index, field, value) => {
    setUploadFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeFile = (index) => {
    setUploadFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated;
    });
  };

  const handleBatchUploadAllJobs = async () => {
    if (uploadFiles.length === 0) { toast('No files to upload', 'error'); return; }
    if (jobs.length === 0) { toast('No jobs available', 'error'); return; }
    
    setUploading(true);
    let newCandidates = [];
    let successCount = 0;

    for (let i = 0; i < uploadFiles.length; i++) {
      const { file, candidateName, candidateEmail } = uploadFiles[i];
      const fileName = file.name;
      
      setUploadProgress(p => ({ ...p, [fileName]: { status: 'uploading', score: 0 } }));
      
      try {
        // Upload to first job (backend will score it), then we'll manually score against other jobs
        const formData = new FormData();
        formData.append('job', jobs[0].id);
        formData.append('candidate_name', candidateName || 'Anonymous');
        formData.append('candidate_email', candidateEmail || '');
        formData.append('resume_file', file);

        const result = await submitResumeAllJobs(formData);
        if (result.id || result.ID) {
          successCount++;
          
          // Create candidate profile with scores for this job
          const candidateRecord = {
            id: result.id || result.ID,
            name: candidateName || result.candidate_name || 'Anonymous',
            email: candidateEmail || result.candidate_email || '',
            fileName: fileName,
            submissionId: result.id || result.ID,
            candidate_skills: result.candidate_skills || result.extracted_skills || result.skills || [],
            jobScores: {
              [jobs[0].id]: {
                atsScore: result.ats_score || 0,
                skillsScore: result.skills_score || 0,
                experienceScore: result.experience_score || 0,
                educationScore: result.education_score || 0,
                semanticScore: result.semantic_score || 0,
                status: result.status || 'done',
              }
            }
          };
          
          newCandidates.push(candidateRecord);
          setUploadProgress(p => ({ ...p, [fileName]: { status: 'done', score: result.ats_score || 0 } }));
        } else {
          setUploadProgress(p => ({ ...p, [fileName]: { status: 'error', score: 0, message: 'Scoring failed' } }));
        }
      } catch (e) {
        setUploadProgress(p => ({ ...p, [fileName]: { status: 'error', score: 0, message: e.message } }));
      }
    }

    setUploading(false);
    toast(`Uploaded ${successCount}/${uploadFiles.length} CVs successfully`);
    
    if (successCount > 0) {
      // Add to uploaded candidates state
      setUploadedCandidates(prev => [...prev, ...newCandidates]);
      setUploadedSubmissionIds(prev => [
        ...new Set([
          ...prev,
          ...newCandidates.map(c => String(c.submissionId || c.id)).filter(Boolean),
        ]),
      ]);
      setUploadFiles([]);
      setUploadProgress({});
    }
  };

  const reloadSubmissions = async (jobsData = jobs) => {
    const submissionsByJob = {};
    for (const job of jobsData) {
      try {
        const subs = await getJobSubmissions(job.id);
        submissionsByJob[job.id] = Array.isArray(subs) ? subs : [];
      } catch {
        submissionsByJob[job.id] = [];
      }
    }
    setCandidatesByJobId(submissionsByJob);
  };

  const clearAllResults = async () => {
    const idsToDelete = [...new Set(
      uploadedSubmissionIds
        .map(String)
        .filter(Boolean)
    )];

    if (idsToDelete.length === 0) {
      setUploadFiles([]);
      setUploadProgress({});
      setExpandedCandidateId(null);
      toast('No uploaded submissions to clear', 'error');
      return;
    }

    try {
      await Promise.all(idsToDelete.map(id => deleteSubmission(id)));
      await reloadSubmissions();
      setUploadedCandidates([]);
      setUploadedSubmissionIds([]);
      setUploadFiles([]);
      setUploadProgress({});
      setExpandedCandidateId(null);
      toast('Uploaded files removed from comparison');
    } catch (e) {
      toast(e.message || 'Failed to clear uploaded files', 'error');
    }
  };

  // Merge pre-existing candidates from submissions with newly uploaded candidates
  const allCandidates = (() => {
    const preExisting = [];
    
    // Transform all submissions into candidate format
    Object.entries(candidatesByJobId).forEach(([jobId, submissions]) => {
      submissions.forEach(sub => {
        // Check if this candidate already exists (by email or name+email)
        const existingIdx = preExisting.findIndex(c => 
          (c.email && c.email === sub.candidate_email) || 
          (c.name === sub.candidate_name && c.email === sub.candidate_email)
        );
        
        if (existingIdx >= 0) {
          // Add this job's score to existing candidate
          preExisting[existingIdx].jobScores[jobId] = {
            atsScore: sub.ats_score || 0,
            skillsScore: sub.skills_score || 0,
            experienceScore: sub.experience_score || 0,
            educationScore: sub.education_score || 0,
            semanticScore: sub.semantic_score || 0,
          };
          if (!preExisting[existingIdx].submissionIds) preExisting[existingIdx].submissionIds = [];
          preExisting[existingIdx].submissionIds.push(sub.id);
        } else {
          // New pre-existing candidate
          preExisting.push({
            id: `pre-${sub.id}`,
            name: sub.candidate_name || 'Anonymous',
            email: sub.candidate_email || '',
            fileName: `(Pre-existing)`,
            source: 'pre-existing',
            submissionIds: [sub.id],
            candidate_skills: sub.candidate_skills || sub.extracted_skills || sub.skills || [],
            jobScores: {
              [jobId]: {
                atsScore: sub.ats_score || 0,
                skillsScore: sub.skills_score || 0,
                experienceScore: sub.experience_score || 0,
                educationScore: sub.education_score || 0,
                semanticScore: sub.semantic_score || 0,
              },
            },
          });
        }
      });
    });
    
    // Mark newly uploaded candidates
    const newlyUploaded = uploadedCandidates.map(c => ({
      ...c,
      source: 'newly-uploaded',
      candidate_skills: c.candidate_skills || c.extracted_skills || c.skills || [],
    }));
    
    return [...preExisting, ...newlyUploaded];
  })();

  // Get candidates to display (filtered by selected job if applicable)
  const displayCandidates = selectedJobFilterId 
    ? allCandidates.filter(c => c.jobScores[selectedJobFilterId])
    : allCandidates;

  // Sort by selected-job skills match first, then ATS score as tie-breaker
  const sortedCandidates = [...displayCandidates].sort((a, b) => {
    const jobId = selectedJobFilterId || jobs[0]?.id;
    const selectedJobData = jobs.find(j => j.id === jobId);
    const skillsMatchA = selectedJobData ? calculateSkillMatch(getCandidateSkills(a), selectedJobData.required_skills) : 0;
    const skillsMatchB = selectedJobData ? calculateSkillMatch(getCandidateSkills(b), selectedJobData.required_skills) : 0;

    if (skillsMatchB !== skillsMatchA) return skillsMatchB - skillsMatchA;

    const scoreA = a.jobScores[jobId]?.atsScore || 0;
    const scoreB = b.jobScores[jobId]?.atsScore || 0;
    return scoreB - scoreA;
  });

  const selectedJob = selectedJobFilterId ? jobs.find(j => j.id === selectedJobFilterId) : null;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>CV Ranking - Compare All Jobs</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>Upload candidate CVs and compare against all job postings automatically.</p>
        </div>
      </div>

{/* Upload Section */}
      <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', padding: 20, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600 }}>📤 Batch Upload CVs</h3>
        
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--gray-700)' }}>Select Multiple CVs (PDF or TXT)</label>
          <input
            type="file"
            multiple
            accept=".pdf,.txt"
            onChange={handleFileSelection}
            disabled={uploading}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #EAECF0', fontSize: 13, width: '100%' }}
          />
          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>Files will be scored against all {jobs.length} job postings</p>
        </div>

        {uploadFiles.length > 0 && (
          <>
            <div style={{ marginBottom: 12, maxHeight: 240, overflowY: 'auto', border: '1px solid #EAECF0', borderRadius: 12, padding: 12 }}>
              {uploadFiles.map((item, idx) => {
                const progress = uploadProgress[item.file.name];
                const status = progress?.status || 'pending';
                
                return (
                  <div key={idx} style={{ marginBottom: 10, padding: 10, background: 'var(--gray-50)', borderRadius: 8, border: '1px solid #EAECF0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{item.file.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>({(item.file.size / 1024).toFixed(1)} KB)</div>
                      </div>
                      {status === 'pending' && !uploading && (
                        <button onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 18 }}>×</button>
                      )}
                    </div>
                    {status === 'pending' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Candidate name"
                          value={item.candidateName}
                          onChange={e => updateFileInfo(idx, 'candidateName', e.target.value)}
                          disabled={uploading}
                          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #EAECF0', fontSize: 12 }}
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={item.candidateEmail}
                          onChange={e => updateFileInfo(idx, 'candidateEmail', e.target.value)}
                          disabled={uploading}
                          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #EAECF0', fontSize: 12 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn 
                onClick={handleBatchUploadAllJobs}
                disabled={uploading}
                style={{ flex: 1 }}
              >
                {uploading ? (
                  <><Spinner size={14} />&nbsp;Scoring against all jobs...</>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload {uploadFiles.length} & Compare All
                  </>
                )}
              </Btn>
              <Btn 
                onClick={() => { setUploadFiles([]); setUploadProgress({}); }}
                variant="ghost"
                disabled={uploading}
              >
                Clear Queue
              </Btn>
            </div>
          </>
        )}
      </div>

      {/* Results Section */}
      {loadingJobs ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : sortedCandidates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--white)', borderRadius: 24, border: '2px dashed #EAECF0' }}>
          <svg width="48" height="48" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 16px', display: 'block' }}><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          <p style={{ fontSize: 14, color: 'var(--gray-400)', fontWeight: 600 }}>No candidates found</p>
          <p style={{ fontSize: 12, color: 'var(--gray-300)' }}>Upload CVs above or check if there are existing submissions in the system</p>
        </div>
      ) : (
        <>
          {/* Job Filter */}
          {jobs.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8, textTransform: 'uppercase' }}>Filter by job:</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn
                  variant={!selectedJobFilterId ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedJobFilterId(null)}
                  style={{ minWidth: 120 }}
                >
                  Show All
                </Btn>
                {jobs.map(job => (
                  <Btn
                    key={job.id}
                    variant={selectedJobFilterId === job.id ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedJobFilterId(job.id)}
                    style={{ minWidth: 140 }}
                  >
                    {job.title.substring(0, 20)}...
                  </Btn>
                ))}
              </div>
            </div>
          )}

          {/* Job Details Panel */}
          {selectedJob && (
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>{selectedJob.title}</h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: 13, opacity: 0.95 }}>{selectedJob.description}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>Min Experience</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{selectedJob.min_experience_years || 0} years</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>Required Skills</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {parseSkills(selectedJob.required_skills).map((skill, idx) => (
                      <span key={idx} style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Candidate Rankings</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--gray-500)' }}>
                  {sortedCandidates.length} candidates
                  {selectedJob && ` • Ranked for: ${selectedJob.title}`}
                  {sortedCandidates.length > 0 && ` • ${allCandidates.filter(c => c.source === 'pre-existing').length} pre-existing, ${uploadedCandidates.length} newly uploaded`}
                </p>
              </div>
              <Btn variant="ghost" size="sm" onClick={clearAllResults}>
                Clear Uploaded
              </Btn>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--gray-50)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0', width: 40 }}></th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>Rank</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>Candidate</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>Email</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>Source</th>
                    {selectedJob && (
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>Skills Match</th>
                    )}
                    {jobs.map(job => (
                      <th key={job.id} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0', whiteSpace: 'nowrap' }}>
                        {job.title.substring(0, 16)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCandidates.map((candidate, idx) => {
                    const isExpanded = expandedCandidateId === candidate.id;
                    const selectedJobId = selectedJobFilterId || jobs[0]?.id;
                    const selectedJobData = jobs.find(j => j.id === selectedJobId);
                    const candidateSkills = getCandidateSkills(candidate);
                    const skillMatch = selectedJobData ? calculateSkillMatch(candidateSkills, selectedJobData.required_skills) : 0;
                    const skillDetails = selectedJobData ? getSkillDetails(candidateSkills, selectedJobData.required_skills) : { matched: [], missing: [], extra: [] };
                    
                    return [
                      <tr key={`row-${candidate.id}`} style={{ borderBottom: '1px solid #F3F4F6' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: 13 }}>
                          <button 
                            onClick={() => setExpandedCandidateId(isExpanded ? null : candidate.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#667eea', fontWeight: 700 }}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{candidate.name || 'Anonymous'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{candidate.email || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 11 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: candidate.source === 'pre-existing' ? '#F3F4F6' : '#DCFCE7',
                            color: candidate.source === 'pre-existing' ? '#6B7280' : '#166534',
                            fontWeight: 600,
                            fontSize: 10,
                          }}>
                            {candidate.source === 'pre-existing' ? '📁 Existing' : '⬆️ New'}
                          </span>
                        </td>
                        {selectedJob && (
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: skillMatch > 75 ? '#DCFCE7' : skillMatch > 50 ? '#FEF3C7' : '#FEE2E2',
                              color: skillMatch > 75 ? '#166534' : skillMatch > 50 ? '#92400E' : '#991B1B',
                            }}>
                              {skillMatch}%
                            </span>
                          </td>
                        )}
                        {jobs.map(job => {
                          const score = candidate.jobScores[job.id]?.atsScore || 0;
                          return (
                            <td key={job.id} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                background: score > 75 ? '#DCFCE7' : score > 50 ? '#FEF3C7' : '#FEE2E2',
                                color: score > 75 ? '#166534' : score > 50 ? '#92400E' : '#991B1B',
                              }}>
                                {score.toFixed(0)}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>,
                      
                      isExpanded && selectedJob ? (
                        <tr key={`expand-${candidate.id}`} style={{ background: '#FAFBFC', borderBottom: '2px solid #EAECF0' }}>
                          <td colSpan={jobs.length + (selectedJob ? 6 : 5)} style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                              {/* Candidate Skills */}
                              <div>
                                <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>📋 Candidate Skills</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {parseSkills(candidateSkills).length > 0 ? (
                                    parseSkills(candidateSkills).map((skill, idx) => (
                                      <span key={idx} style={{ background: '#E0E7FF', color: '#4338CA', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                        {skill}
                                      </span>
                                    ))
                                  ) : (
                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--gray-400)' }}>No skills extracted</p>
                                  )}
                                </div>
                              </div>

                              {/* Required Skills */}
                              <div>
                                <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>🎯 Required Skills</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {parseSkills(selectedJob.required_skills).map((skill, idx) => (
                                    <span key={idx} style={{ background: '#F3E8FF', color: '#7C3AED', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Match Analysis */}
                              <div>
                                <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>✨ Analysis</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ fontSize: 11 }}>
                                    <span style={{ color: '#059669', fontWeight: 700 }}>✓ Matched ({skillDetails.matched.length})</span>: {skillDetails.matched.length > 0 ? skillDetails.matched.join(', ') : 'None'}
                                  </div>
                                  <div style={{ fontSize: 11 }}>
                                    <span style={{ color: '#DC2626', fontWeight: 700 }}>✗ Missing ({skillDetails.missing.length})</span>: {skillDetails.missing.length > 0 ? skillDetails.missing.join(', ') : 'None'}
                                  </div>
                                  {skillDetails.extra.length > 0 && (
                                    <div style={{ fontSize: 11 }}>
                                      <span style={{ color: '#2563EB', fontWeight: 700 }}>+ Extra ({skillDetails.extra.length})</span>: {skillDetails.extra.join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ].filter(Boolean);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
