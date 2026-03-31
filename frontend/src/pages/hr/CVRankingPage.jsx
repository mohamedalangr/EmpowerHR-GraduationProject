import { Fragment, useState, useEffect, useRef } from 'react';
import { Spinner, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { getJobs, getJobRanking, uploadAndRankCVs, getJobSubmissions } from '../../api/index.js';

export function HRCVRankingPage() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);

  const [jobs, setJobs]           = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [rankings, setRankings]   = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [expandedRank, setExpandedRank] = useState(null);
  const [fitFilter, setFitFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [shortlistedKeys, setShortlistedKeys] = useState([]);
  const [compareKeys, setCompareKeys] = useState([]);
  const [sortBy, setSortBy] = useState('overall');
  const [rankPhase, setRankPhase] = useState('idle');

  const topCandidate = rankings.length > 0 ? rankings[0] : null;

  const getFitLabel = (score = 0) => {
    if (score >= 80) return 'Strong Fit';
    if (score >= 65) return 'Good Fit';
    if (score >= 50) return 'Moderate Fit';
    return 'Low Fit';
  };

  const getFitBand = (score = 0) => {
    if (score >= 80) return 'strong';
    if (score >= 65) return 'good';
    if (score >= 50) return 'moderate';
    return 'low';
  };

  const getRankKey = (rank, index) => rank.submission_id || rank.file_name || `${rank.candidate_name || 'candidate'}-${index}`;

  const filteredRankings = rankings.filter((rank, index) => {
    const key = getRankKey(rank, index);
    if (!key) return false;

    const score = Number(rank.final_score || 0);
    const fitBand = getFitBand(score);
    const source = (rank.source || 'submission').toLowerCase();
    const candidateName = (rank.candidate_name || rank.file_name || '').toLowerCase();
    const fileName = (rank.file_name || '').toLowerCase();
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const fitMatches = fitFilter === 'all' || fitBand === fitFilter;
    const sourceMatches = sourceFilter === 'all' || source === sourceFilter;
    const searchMatches = !normalizedSearch || candidateName.includes(normalizedSearch) || fileName.includes(normalizedSearch);

    return fitMatches && sourceMatches && searchMatches;
  });

  const sortedFilteredRankings = [...filteredRankings].sort((a, b) => {
    if (sortBy === 'skills') return (b.skill_match_pct || 0) - (a.skill_match_pct || 0);
    if (sortBy === 'missing') return (a.missing_skills || []).length - (b.missing_skills || []).length;
    return (b.final_score || 0) - (a.final_score || 0);
  });

  const shortlistedCount = shortlistedKeys.length;

  const compareCandidates = compareKeys
    .map((key) => sortedFilteredRankings.find((rank, index) => getRankKey(rank, index) === key))
    .filter(Boolean);

  const clearRankingFilters = () => {
    setSearchTerm('');
    setFitFilter('all');
    setSourceFilter('all');
    setSortBy('overall');
  };

  const shortlistTopCandidates = (count = 3) => {
    const topKeys = sortedFilteredRankings
      .slice(0, count)
      .map((rank, index) => getRankKey(rank, index))
      .filter(Boolean);

    if (topKeys.length === 0) {
      toast('No candidates available to shortlist', 'error');
      return;
    }

    setShortlistedKeys(prev => Array.from(new Set([...prev, ...topKeys])));
    toast(`Top ${topKeys.length} candidates shortlisted`, 'success');
  };

  const exportShortlist = () => {
    const rows = rankings
      .map((rank, index) => ({ rank, index, key: getRankKey(rank, index) }))
      .filter(item => shortlistedKeys.includes(item.key));

    if (rows.length === 0) {
      toast('No shortlisted candidates to export', 'error');
      return;
    }

    const csvHeader = ['Rank', 'Candidate', 'File', 'Overall Fit', 'Skill Coverage', 'Matched Skills', 'Missing Skills'];
    const csvRows = rows.map(({ rank, index }) => [
      `#${index + 1}`,
      rank.candidate_name || '',
      rank.file_name || '',
      `${rank.final_score || 0}%`,
      `${rank.skill_match_pct || 0}%`,
      (rank.matched_skills || []).join(' | '),
      (rank.missing_skills || []).join(' | '),
    ]);

    const csvContent = [csvHeader, ...csvRows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedJob?.title || 'job'}-shortlist.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Shortlist exported', 'success');
  };

  const toggleShortlist = (key) => {
    setShortlistedKeys(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  };

  const toggleCompare = (key) => {
    setCompareKeys(prev => {
      if (prev.includes(key)) return prev.filter(item => item !== key);
      if (prev.length >= 2) {
        toast('You can compare up to 2 candidates', 'error');
        return prev;
      }
      return [...prev, key];
    });
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (rankingLoading) return;
    if (rankings.length > 0) {
      setRankPhase('done');
      return;
    }
    setRankPhase('idle');
  }, [rankingLoading, rankings.length]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await getJobs();
      const normalizedJobs = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];
      setJobs(normalizedJobs);
      if (!Array.isArray(data) && !Array.isArray(data?.results) && data?.detail) {
        toast(data.detail, 'error');
      }
    } catch (err) {
      toast('Failed to load jobs', 'error');
    }
    setLoading(false);
  };

  const loadSubmissions = async (jobId) => {
    try {
      const data = await getJobSubmissions(jobId);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
      setSubmissions([]);
    }
  };

  const handleFileChange = (e) => {
    setUploadedFiles(Array.from(e.target.files));
  };

  const handleClearUploadedCVs = () => {
    setUploadedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast('Uploaded CV selection cleared', 'success');
  };

  const handleRankCVs = async () => {
    if (!selectedJob) {
      toast('Please select a job', 'error');
      return;
    }

    setRankingLoading(true);
    setRankPhase('collecting');
    try {
      let data;
      if (uploadedFiles.length > 0) {
        // Upload and rank new CVs
        const formData = new FormData();
        uploadedFiles.forEach(file => formData.append('cvs', file));
        setRankPhase('analyzing');
        data = await uploadAndRankCVs(selectedJob.id, formData);
      } else {
        // Rank existing submissions
        setRankPhase('analyzing');
        data = await getJobRanking(selectedJob.id);
      }
      setRankings(Array.isArray(data) ? data : []);
      setExpandedRank(null);
      if (!Array.isArray(data)) {
        toast(data?.detail || 'Failed to rank CVs', 'error');
      }
    } catch (err) {
      toast('Failed to rank CVs', 'error');
      setRankPhase('idle');
    }
    setRankingLoading(false);
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>CV Ranking & Analysis</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>Review ranked candidates and shortlist the best fit for the selected role.</p>
        </div>
      </div>

      {rankPhase !== 'idle' && (
        <div style={{
          marginBottom: 18,
          borderRadius: 12,
          border: '1px solid #D0D5DD',
          background: '#fff',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: 12.5, color: '#344054', fontWeight: 600 }}>
            Ranking Progress
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={rankPhase === 'collecting' ? 'accent' : rankPhase === 'done' ? 'green' : 'gray'} label="Collecting CVs" />
            <Badge color={rankPhase === 'analyzing' ? 'accent' : rankPhase === 'done' ? 'green' : 'gray'} label="Analyzing Profiles" />
            <Badge color={rankPhase === 'done' ? 'green' : 'gray'} label="Ranking Complete" />
          </div>
        </div>
      )}

      {/* Job Selection Card */}
      <div style={{ background: 'var(--white)', borderRadius: 20, padding: '24px', border: '1px solid #EAECF0', marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--gray-900)' }}>Select Job Position</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Job Position
          </label>
          <select
            value={selectedJob?.id || ''}
            onChange={(e) => {
              const job = jobs.find(j => j.id == e.target.value);
              setSelectedJob(job);
              setRankings([]);
              setUploadedFiles([]);
              setShortlistedKeys([]);
              setCompareKeys([]);
              setFitFilter('all');
              setSourceFilter('all');
              setSearchTerm('');
              setSortBy('overall');
              if (job) {
                loadSubmissions(job.id);
              } else {
                setSubmissions([]);
              }
            }}
            style={{
              width: '100%', padding: '11px 14px', background: 'var(--gray-100)',
              border: '2px solid transparent', borderRadius: 12, fontSize: 13.5,
              outline: 'none', fontFamily: 'var(--sans)', color: 'var(--gray-900)',
            }}
          >
            <option value="">Choose a job position...</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Upload Additional CVs (Optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt"
            onChange={handleFileChange}
            style={{
              width: '100%', padding: '11px 14px', background: 'var(--gray-100)',
              border: '2px solid transparent', borderRadius: 12, fontSize: 13.5,
              outline: 'none', fontFamily: 'var(--sans)', color: 'var(--gray-900)',
            }}
          />
          <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
            Leave empty to rank existing candidate submissions. Supports PDF and TXT files.
          </p>
        </div>

        {uploadedFiles.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>
              Selected Files ({uploadedFiles.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {uploadedFiles.map((file, index) => (
                <Badge key={index} color="accent" label={file.name} />
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Rank Button */}
          <Btn
            onClick={handleRankCVs}
            disabled={rankingLoading || !selectedJob}
            style={{ minWidth: 160 }}
          >
            {rankingLoading ? (
              <><Spinner size={16} />&nbsp;Analyzing CVs...</>
            ) : (
              <><svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>&nbsp;Rank CVs</>
            )}
          </Btn>

          <button
            type="button"
            onClick={handleClearUploadedCVs}
            disabled={uploadedFiles.length === 0 || rankingLoading}
            style={{
              minWidth: 160,
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #D0D5DD',
              background: uploadedFiles.length === 0 || rankingLoading ? '#F2F4F7' : '#fff',
              color: uploadedFiles.length === 0 || rankingLoading ? '#98A2B3' : '#344054',
              fontWeight: 600,
              fontSize: 13,
              cursor: uploadedFiles.length === 0 || rankingLoading ? 'not-allowed' : 'pointer'
            }}
          >
            Clear Uploaded CVs
          </button>
        </div>
      </div>

      {rankings.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #EAECF0' }}>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--gray-900)' }}>
                  Ranked Candidates ({rankings.length})
                </h3>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
                  Candidates are sorted by best overall fit for this role.
                </p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #F8FAFF 0%, #EEF4FF 100%)',
                border: '1px solid #D9E4FF',
                borderRadius: 14,
                padding: '10px 12px'
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                  Top Candidate Snapshot
                </div>
                {topCandidate ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {topCandidate.candidate_name || topCandidate.file_name || 'Top Candidate'}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                        {topCandidate.final_score ?? 0}%
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-600)', marginTop: 4 }}>
                      {topCandidate.file_name || 'No file name'}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="green" label={`Matched ${(topCandidate.matched_skills || []).length}`} />
                      <Badge color="red" label={`Missing ${(topCandidate.missing_skills || []).length}`} />
                      <Badge color="yellow" label={`Coverage ${topCandidate.skill_match_pct ?? 0}%`} />
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                    Run ranking to see top candidate details.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
                marginTop: 14,
              }}
            >
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Top Score</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>{rankings[0]?.final_score ?? 0}%</div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Avg Score</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {Math.round(rankings.reduce((sum, item) => sum + (item.final_score || 0), 0) / rankings.length)}%
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Strong Matches</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {rankings.filter(item => (item.final_score || 0) >= 75).length}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Critical Gaps</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {rankings.filter(item => (item.missing_skills || []).length >= 3).length}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Shortlisted</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {shortlistedCount}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => shortlistTopCandidates(3)}
                style={{
                  border: '1px solid #D0D5DD',
                  background: '#fff',
                  color: '#344054',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '7px 10px',
                  cursor: 'pointer',
                }}
              >
                Shortlist Top 3
              </button>
              <button
                type="button"
                onClick={() => setShortlistedKeys([])}
                style={{
                  border: '1px solid #D0D5DD',
                  background: '#fff',
                  color: '#344054',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '7px 10px',
                  cursor: 'pointer',
                }}
              >
                Clear Shortlist
              </button>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1.4fr repeat(3, minmax(130px, 1fr)) auto auto', gap: 10 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search candidate or file"
                style={{
                  width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #D0D5DD',
                  borderRadius: 10, fontSize: 13, outline: 'none', color: 'var(--gray-900)'
                }}
              />

              <select
                value={fitFilter}
                onChange={(e) => setFitFilter(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #D0D5DD',
                  borderRadius: 10, fontSize: 13, outline: 'none', color: 'var(--gray-900)'
                }}
              >
                <option value="all">All Fit Levels</option>
                <option value="strong">Strong Fit</option>
                <option value="good">Good Fit</option>
                <option value="moderate">Moderate Fit</option>
                <option value="low">Low Fit</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #D0D5DD',
                  borderRadius: 10, fontSize: 13, outline: 'none', color: 'var(--gray-900)'
                }}
              >
                <option value="all">All Sources</option>
                <option value="submission">Applications</option>
                <option value="media">Media Library</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #D0D5DD',
                  borderRadius: 10, fontSize: 13, outline: 'none', color: 'var(--gray-900)'
                }}
              >
                <option value="overall">Sort: Best Fit</option>
                <option value="skills">Sort: Skill Coverage</option>
                <option value="missing">Sort: Least Missing Skills</option>
              </select>

              <button
                type="button"
                onClick={clearRankingFilters}
                style={{
                  minWidth: 130,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #D0D5DD',
                  background: '#fff',
                  color: '#344054',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Reset Filters
              </button>

              <Btn onClick={exportShortlist} style={{ minWidth: 170 }}>
                Export Shortlist
              </Btn>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-600)' }}>
              Showing {sortedFilteredRankings.length} of {rankings.length} candidates.
              {sortedFilteredRankings.length === 0 ? ' Adjust filters to reveal candidates.' : ''}
              {compareKeys.length > 0 ? ` Compare selected: ${compareKeys.length}/2.` : ''}
            </div>

            {compareCandidates.length > 0 && (
              <div style={{
                marginTop: 14,
                border: '1px solid #E4E7EC',
                borderRadius: 12,
                background: '#FCFCFD',
                padding: 12
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  Compare Candidates ({compareCandidates.length}/2)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: compareCandidates.length === 1 ? '1fr' : '1fr 1fr', gap: 10 }}>
                  {compareCandidates.map((candidate, idx) => (
                    <div key={`${candidate.file_name || candidate.candidate_name}-${idx}`} style={{ border: '1px solid #EAECF0', borderRadius: 10, background: '#fff', padding: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{candidate.candidate_name || candidate.file_name}</div>
                      <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>{candidate.file_name || '-'}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: '#344054' }}>
                          <span style={{ fontWeight: 700 }}>{candidate.final_score || 0}%</span> Overall Fit
                        </div>
                        <div style={{ fontSize: 12, color: '#344054' }}>
                          <span style={{ fontWeight: 700 }}>{candidate.skill_match_pct || 0}%</span> Skill Coverage
                        </div>
                        <div style={{ fontSize: 12, color: '#027A48' }}>
                          <span style={{ fontWeight: 700 }}>{(candidate.matched_skills || []).length}</span> Matched
                        </div>
                        <div style={{ fontSize: 12, color: '#B42318' }}>
                          <span style={{ fontWeight: 700 }}>{(candidate.missing_skills || []).length}</span> Missing
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isMobile ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)' }}>
                  {['Rank', 'Candidate', 'Overall Fit', 'Skill Coverage', 'Hiring Insight', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedFilteredRankings.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
                      <div>No candidates match the selected filters.</div>
                      <button
                        type="button"
                        onClick={clearRankingFilters}
                        style={{
                          marginTop: 8,
                          border: '1px solid #D0D5DD',
                          background: '#fff',
                          color: '#344054',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                )}
                {sortedFilteredRankings.map((rank, index) => {
                  const key = getRankKey(rank, index);
                  const isShortlisted = shortlistedKeys.includes(key);
                  const inCompare = compareKeys.includes(key);
                  return (
                  <Fragment key={key}>
                    <tr style={{ borderBottom: '1px solid #EAECF0' }}>
                      <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: 'var(--gray-900)' }}>
                        #{index + 1}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--gray-900)' }}>
                        <div style={{ fontWeight: 600 }}>{rank.candidate_name || rank.file_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{rank.file_name || '-'}</div>
                        <div style={{ marginTop: 6 }}>
                          <Badge color={rank.source === 'media' ? 'accent' : 'gray'} label={rank.source === 'media' ? 'From Media' : 'From Application'} />
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700 }}>
                        <span style={{
                          color: rank.final_score >= 80 ? '#22C55E' : rank.final_score >= 60 ? '#F59E0B' : '#E8321A',
                          fontWeight: 700
                        }}>
                          {rank.final_score}%
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--gray-600)', marginTop: 4 }}>
                          {getFitLabel(rank.final_score || 0)}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--gray-700)' }}>
                        <div>{rank.skill_match_pct ?? 0}% matched</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
                          {(rank.matched_skills || []).length} matched, {(rank.missing_skills || []).length} missing
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', maxWidth: 320 }}>
                        <div style={{ fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.4, marginBottom: 8 }}>
                          {rank.semantic_analysis || 'No semantic summary available'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedRank(expandedRank === key ? null : key)}
                            style={{
                              border: '1px solid #D0D5DD',
                              background: '#fff',
                              color: 'var(--gray-700)',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '6px 10px',
                              cursor: 'pointer',
                            }}
                          >
                            {expandedRank === key ? 'Hide Brief' : 'Open Brief'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleShortlist(key)}
                            style={{
                              border: '1px solid #D0D5DD',
                              background: isShortlisted ? '#ECFDF3' : '#fff',
                              color: isShortlisted ? '#027A48' : 'var(--gray-700)',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '6px 10px',
                              cursor: 'pointer',
                            }}
                          >
                            {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleCompare(key)}
                            style={{
                              border: '1px solid #D0D5DD',
                              background: inCompare ? '#EFF8FF' : '#fff',
                              color: inCompare ? '#175CD3' : 'var(--gray-700)',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '6px 10px',
                              cursor: 'pointer',
                            }}
                          >
                            {inCompare ? 'Selected' : 'Compare'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedRank === key && (
                      <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid #EAECF0' }}>
                        <td colSpan={6} style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                Required Skills
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.required_skills || []).map(skill => (
                                  <Badge key={`req-${skill}`} color="gray" label={skill} />
                                ))}
                                {(rank.required_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>No required skills defined</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                Candidate Skills
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.candidate_skills || []).map(skill => (
                                  <Badge key={`cand-${skill}`} color="accent" label={skill} />
                                ))}
                                {(rank.candidate_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>No skills extracted</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                Matched Skills
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.matched_skills || []).map(skill => (
                                  <Badge key={`mat-${skill}`} color="green" label={skill} />
                                ))}
                                {(rank.matched_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>None</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                Missing Skills
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.missing_skills || []).map(skill => (
                                  <Badge key={`mis-${skill}`} color="red" label={skill} />
                                ))}
                                {(rank.missing_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>None</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                Extra Strengths
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.extra_skills || []).map(skill => (
                                  <Badge key={`ext-${skill}`} color="yellow" label={skill} />
                                ))}
                                {(rank.extra_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>None</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : null}
        </div>
      )}

      {/* Existing CVs Display */}
      {selectedJob && !rankingLoading && (
        <div style={{ background: 'var(--white)', borderRadius: 20, padding: '24px', border: '1px solid #EAECF0', marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>
              Candidate CV Library ({submissions.length})
            </h3>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: 0 }}>
              Supporting list of submitted and media CVs used in ranking.
            </p>
          </div>

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--gray-50)', borderRadius: 12 }}>
              <svg width="48" height="48" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 16px', display: 'block' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 4 }}>No CV records available</p>
              <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>Once CVs are submitted or detected in media, they will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {submissions.map((submission) => (
                <div key={submission.id || submission.resume_filename || submission.resume_file} style={{
                  padding: 16,
                  border: '1px solid #EAECF0',
                  borderRadius: 12,
                  background: 'var(--gray-50)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' }}>
                      {submission.candidate_name || 'Anonymous Candidate'}
                    </div>
                    <Badge
                      color={submission.status === 'MEDIA' ? 'accent' : 'green'}
                      label={submission.status === 'MEDIA' ? 'From Media' : 'From Application'}
                    />
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>
                    {submission.candidate_email || 'No email provided'}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 8 }}>
                    CV File: {submission.resume_filename || 'Not available'}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
                    Added: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : 'N/A'}
                  </div>

                  {submission.candidate_skills && submission.candidate_skills.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Top Skills
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {submission.candidate_skills.slice(0, 4).map(skill => (
                          <Badge key={skill} color="accent" label={skill} />
                        ))}
                        {submission.candidate_skills.length > 4 && (
                          <Badge color="gray" label={`+${submission.candidate_skills.length - 4}`} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <Spinner />}
    </div>
  );
}