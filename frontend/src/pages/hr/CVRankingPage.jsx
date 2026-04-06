import { Fragment, useState, useEffect, useRef } from 'react';
import { Spinner, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { getJobs, getJobRanking, uploadAndRankCVs, getJobSubmissions, updateSubmissionStage } from '../../api/index.js';
import { useLanguage } from '../../context/LanguageContext';

export function HRCVRankingPage() {
  const toast = useToast();
  const { t } = useLanguage();
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
  const [stageDrafts, setStageDrafts] = useState({});
  const [stageSavingId, setStageSavingId] = useState(null);

  const topCandidate = rankings.length > 0 ? rankings[0] : null;
  const pipelineCandidates = submissions.filter((submission) => submission.status !== 'MEDIA');

  const getFitLabel = (score = 0) => {
    if (score >= 80) return t('Strong Fit');
    if (score >= 65) return t('Good Fit');
    if (score >= 50) return t('Moderate Fit');
    return t('Low Fit');
  };

  const getStageColor = (stage = 'Applied') => {
    if (stage === 'Hired') return 'green';
    if (stage === 'Rejected') return 'red';
    if (stage === 'Interview') return 'accent';
    if (stage === 'Shortlisted') return 'yellow';
    return 'gray';
  };

  const updateStageDraft = (submissionId, key, value) => {
    setStageDrafts((current) => ({
      ...current,
      [submissionId]: {
        review_stage: current[submissionId]?.review_stage ?? 'Applied',
        stage_notes: current[submissionId]?.stage_notes ?? '',
        talent_pool: current[submissionId]?.talent_pool ?? true,
        ...current[submissionId],
        [key]: value,
      },
    }));
  };

  const getFitBand = (score = 0) => {
    if (score >= 80) return 'strong';
    if (score >= 65) return 'good';
    if (score >= 50) return 'moderate';
    return 'low';
  };

  const getRecommendation = (rank = {}) => {
    const score = Number(rank.final_score || 0);
    const missingCount = (rank.missing_skills || []).length;

    if (score >= 82 && missingCount <= 2) return { label: t('Fast-track interview'), color: 'green' };
    if (score >= 65) return { label: t('Review with hiring manager'), color: 'accent' };
    if (score >= 50) return { label: t('Consider for talent pool'), color: 'yellow' };
    return { label: t('Needs deeper review'), color: 'red' };
  };

  const renderScoreBar = (label, value, color = '#E8321A') => {
    const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
    return (
      <div key={label}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11.5, color: '#344054', fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 11.5, color: '#111827', fontWeight: 700 }}>{Math.round(safeValue)}%</span>
        </div>
        <div style={{ height: 8, background: '#EAECF0', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${safeValue}%`, height: '100%', background: color, borderRadius: 999 }} />
        </div>
      </div>
    );
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

  const topRecommendation = topCandidate ? getRecommendation(topCandidate) : null;

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

  useEffect(() => {
    const nextDrafts = submissions.reduce((acc, submission) => {
      if (submission?.id && submission.status !== 'MEDIA') {
        acc[submission.id] = {
          review_stage: submission.review_stage || 'Applied',
          stage_notes: submission.stage_notes || '',
          talent_pool: submission.talent_pool !== false,
        };
      }
      return acc;
    }, {});
    setStageDrafts(nextDrafts);
  }, [submissions]);

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

  const handleStageUpdate = async (submission) => {
    if (!selectedJob || !submission?.id) return;

    const draft = stageDrafts[submission.id] || {
      review_stage: submission.review_stage || 'Applied',
      stage_notes: submission.stage_notes || '',
      talent_pool: submission.talent_pool !== false,
    };

    if (['Rejected', 'Hired'].includes(draft.review_stage) && !draft.stage_notes.trim()) {
      toast(t('approval.stageNoteRequired'), 'error');
      return;
    }

    setStageSavingId(submission.id);
    try {
      await updateSubmissionStage(submission.id, draft);
      toast('Candidate stage updated', 'success');
      await loadSubmissions(selectedJob.id);
    } catch (err) {
      toast(err.message || 'Failed to update stage', 'error');
    }
    setStageSavingId(null);
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div className="hr-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.cv.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>{t('page.cv.subtitle')}</p>
        </div>
      </div>

      {rankPhase !== 'idle' && (
        <div className="hr-surface-card" style={{
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
            {t('Ranking Progress')}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={rankPhase === 'collecting' ? 'accent' : rankPhase === 'done' ? 'green' : 'gray'} label={t('Collecting CVs')} />
            <Badge color={rankPhase === 'analyzing' ? 'accent' : rankPhase === 'done' ? 'green' : 'gray'} label={t('Analyzing Profiles')} />
            <Badge color={rankPhase === 'done' ? 'green' : 'gray'} label={t('Ranking Complete')} />
          </div>
        </div>
      )}

      {/* Job Selection Card */}
      <div className="hr-surface-card" style={{ background: 'var(--white)', borderRadius: 20, padding: '24px', border: '1px solid #EAECF0', marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--gray-900)' }}>{t('Select Job Position')}</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {t('Job Position')}
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
            <option value="">{t('Choose a job position...')}</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {t('Upload Additional CVs (Optional)')}
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
            {t('Leave empty to rank existing candidate submissions. Supports PDF and TXT files.')}
          </p>
        </div>

        {uploadedFiles.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>
              {t('Selected Files')} ({uploadedFiles.length}):
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
              <><Spinner size={16} />&nbsp;{t('Analyzing CVs...')}</>
            ) : (
              <><svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>&nbsp;{t('Rank CVs')}</>
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
            {t('Clear Uploaded CVs')}
          </button>
        </div>
      </div>

      {rankings.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #EAECF0' }}>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--gray-900)' }}>
                  {t('Ranked Candidates')} ({rankings.length})
                </h3>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
                  {t('Candidates are sorted by best overall fit for this role.')}
                </p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #F8FAFF 0%, #EEF4FF 100%)',
                border: '1px solid #D9E4FF',
                borderRadius: 14,
                padding: '10px 12px'
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                  {t('Top Candidate Snapshot')}
                </div>
                {topCandidate ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {topCandidate.candidate_name || topCandidate.file_name || t('Top Candidate')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                        {topCandidate.final_score ?? 0}%
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-600)', marginTop: 4 }}>
                      {topCandidate.file_name || t('No file name')}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color={topRecommendation?.color || 'green'} label={topRecommendation?.label || t('Top Candidate')} />
                      <Badge color="green" label={`${t('Matched')} ${(topCandidate.matched_skills || []).length}`} />
                      <Badge color="red" label={`${t('Missing')} ${(topCandidate.missing_skills || []).length}`} />
                      <Badge color="yellow" label={`${t('Coverage')} ${topCandidate.skill_match_pct ?? 0}%`} />
                      <Badge color="accent" label={`${t('Confidence')} ${Math.round(topCandidate.confidence_score || 0)}%`} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.45 }}>
                      {topCandidate.semantic_analysis || t('No semantic summary available')}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                    {t('Run ranking to see top candidate details.')}
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
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('Top Score')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>{rankings[0]?.final_score ?? 0}%</div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('Avg Score')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {Math.round(rankings.reduce((sum, item) => sum + (item.final_score || 0), 0) / rankings.length)}%
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('Strong Matches')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {rankings.filter(item => (item.final_score || 0) >= 75).length}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('Critical Gaps')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {rankings.filter(item => (item.missing_skills || []).length >= 3).length}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid #EAECF0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('Shortlisted')}</div>
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
                {t('Shortlist Top 3')}
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
                {t('Clear Shortlist')}
              </button>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1.4fr repeat(3, minmax(130px, 1fr)) auto auto', gap: 10 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('Search candidate or file')}
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
                <option value="all">{t('All Fit Levels')}</option>
                <option value="strong">{t('Strong Fit')}</option>
                <option value="good">{t('Good Fit')}</option>
                <option value="moderate">{t('Moderate Fit')}</option>
                <option value="low">{t('Low Fit')}</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #D0D5DD',
                  borderRadius: 10, fontSize: 13, outline: 'none', color: 'var(--gray-900)'
                }}
              >
                <option value="all">{t('All Sources')}</option>
                <option value="submission">{t('Applications')}</option>
                <option value="media">{t('Media Library')}</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', background: '#fff', border: '1px solid #D0D5DD',
                  borderRadius: 10, fontSize: 13, outline: 'none', color: 'var(--gray-900)'
                }}
              >
                <option value="overall">{t('Sort: Best Fit')}</option>
                <option value="skills">{t('Sort: Skill Coverage')}</option>
                <option value="missing">{t('Sort: Least Missing Skills')}</option>
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
                {t('Reset Filters')}
              </button>

              <Btn onClick={exportShortlist} style={{ minWidth: 170 }}>
                {t('Export Shortlist')}
              </Btn>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-600)' }}>
              {t('Showing')} {sortedFilteredRankings.length} {t('of')} {rankings.length} {t('candidates.')}
              {sortedFilteredRankings.length === 0 ? ` ${t('Adjust filters to reveal candidates.')}` : ''}
              {compareKeys.length > 0 ? ` ${t('Compare selected:')} ${compareKeys.length}/2.` : ''}
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
                  {t('Compare Candidates')} ({compareCandidates.length}/2)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: compareCandidates.length === 1 ? '1fr' : '1fr 1fr', gap: 10 }}>
                  {compareCandidates.map((candidate, idx) => (
                    <div key={`${candidate.file_name || candidate.candidate_name}-${idx}`} style={{ border: '1px solid #EAECF0', borderRadius: 10, background: '#fff', padding: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{candidate.candidate_name || candidate.file_name}</div>
                      <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>{candidate.file_name || '-'}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: '#344054' }}>
                          <span style={{ fontWeight: 700 }}>{candidate.final_score || 0}%</span> {t('Overall Fit')}
                        </div>
                        <div style={{ fontSize: 12, color: '#344054' }}>
                          <span style={{ fontWeight: 700 }}>{candidate.skill_match_pct || 0}%</span> {t('Skill Coverage')}
                        </div>
                        <div style={{ fontSize: 12, color: '#027A48' }}>
                          <span style={{ fontWeight: 700 }}>{(candidate.matched_skills || []).length}</span> {t('Matched')}
                        </div>
                        <div style={{ fontSize: 12, color: '#B42318' }}>
                          <span style={{ fontWeight: 700 }}>{(candidate.missing_skills || []).length}</span> {t('Missing')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        <Badge color={getRecommendation(candidate).color} label={getRecommendation(candidate).label} />
                        <Badge color="accent" label={`${t('Confidence')} ${Math.round(candidate.confidence_score || 0)}%`} />
                        <Badge color="yellow" label={`${t('Concept Coverage')} ${Math.round(candidate.concept_coverage_pct || 0)}%`} />
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
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedFilteredRankings.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
                      <div>{t('No candidates match the selected filters.')}</div>
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
                        {t('Clear filters')}
                      </button>
                    </td>
                  </tr>
                )}
                {sortedFilteredRankings.map((rank, index) => {
                  const key = getRankKey(rank, index);
                  const isShortlisted = shortlistedKeys.includes(key);
                  const inCompare = compareKeys.includes(key);
                  const recommendation = getRecommendation(rank);
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
                          <Badge color={rank.source === 'media' ? 'accent' : 'gray'} label={rank.source === 'media' ? t('From Media') : t('From Application')} />
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
                        <div>{rank.skill_match_pct ?? 0}% {t('matched')}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
                          {(rank.matched_skills || []).length} {t('Matched').toLowerCase()}, {(rank.missing_skills || []).length} {t('Missing').toLowerCase()}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', maxWidth: 320 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          <Badge color={recommendation.color} label={recommendation.label} />
                          <Badge color="accent" label={`${t('Confidence')} ${Math.round(rank.confidence_score || 0)}%`} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.4, marginBottom: 8 }}>
                          {rank.semantic_analysis || t('No semantic summary available')}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Badge color="yellow" label={`${t('Concept Coverage')} ${Math.round(rank.concept_coverage_pct || 0)}%`} />
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
                            {expandedRank === key ? t('Hide Brief') : t('Open Brief')}
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
                            {isShortlisted ? t('Shortlisted') : t('Shortlist')}
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
                            {inCompare ? t('Selected') : t('Compare')}
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
                                {t('Required Skills')}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.required_skills || []).map(skill => (
                                  <Badge key={`req-${skill}`} color="gray" label={skill} />
                                ))}
                                {(rank.required_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{t('No required skills defined')}</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {t('Candidate Skills')}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.candidate_skills || []).map(skill => (
                                  <Badge key={`cand-${skill}`} color="accent" label={skill} />
                                ))}
                                {(rank.candidate_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{t('No skills extracted')}</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {t('Matched Skills')}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.matched_skills || []).map(skill => (
                                  <Badge key={`mat-${skill}`} color="green" label={skill} />
                                ))}
                                {(rank.matched_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{t('None')}</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {t('Missing Skills')}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.missing_skills || []).map(skill => (
                                  <Badge key={`mis-${skill}`} color="red" label={skill} />
                                ))}
                                {(rank.missing_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{t('None')}</span>}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {t('Extra Strengths')}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.extra_skills || []).map(skill => (
                                  <Badge key={`ext-${skill}`} color="yellow" label={skill} />
                                ))}
                                {(rank.extra_skills || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{t('None')}</span>}
                              </div>
                            </div>

                            <div style={{ padding: 12, border: '1px solid #D9E4FF', borderRadius: 12, background: 'linear-gradient(135deg, #F8FAFF 0%, #EEF4FF 100%)' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {t('AI Explainability')}
                              </div>
                              <div style={{ display: 'grid', gap: 8 }}>
                                {renderScoreBar(t('Overall Fit'), rank.final_score, '#16A34A')}
                                {renderScoreBar(t('Semantic Alignment'), rank.semantic_score, '#2563EB')}
                                {renderScoreBar(t('Skill Coverage'), rank.skill_match_pct, '#B54708')}
                                {renderScoreBar(t('Concept Coverage'), rank.concept_coverage_pct, '#7C3AED')}
                                {renderScoreBar(t('Confidence'), rank.confidence_score, '#E8321A')}
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                                <Badge color={recommendation.color} label={recommendation.label} />
                                <Badge color="accent" label={`${t('Historical Strength')} ${Math.round(rank.historical_strength_score || 0)}%`} />
                              </div>
                            </div>

                            <div style={{ padding: 12, border: '1px solid #FDEAD7', borderRadius: 12, background: '#FFFAF5' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#B54708', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {t('Evidence & Interview Focus')}
                              </div>
                              {(rank.evidence || []).length > 0 ? (
                                <ul style={{ margin: '0 0 12px 18px', padding: 0, color: '#475467', fontSize: 12.5, lineHeight: 1.6 }}>
                                  {(rank.evidence || []).slice(0, 4).map((item, evidenceIndex) => (
                                    <li key={`${key}-evidence-${evidenceIndex}`}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>{t('No resume evidence available')}</div>
                              )}
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#475467', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {t('Interview Focus')}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(rank.missing_skills || []).length > 0 ? (
                                  (rank.missing_skills || []).slice(0, 4).map((skill) => (
                                    <Badge key={`${key}-focus-${skill}`} color="red" label={skill} />
                                  ))
                                ) : (
                                  <Badge color="green" label={t('No critical skill gaps detected')} />
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: '#667085', marginTop: 10 }}>
                                {t('Model weights')}: S {Math.round((rank.adaptive_weights?.semantic || 0) * 100)}% · T {Math.round((rank.adaptive_weights?.tfidf || 0) * 100)}% · K {Math.round((rank.adaptive_weights?.skills || 0) * 100)}%
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
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>
                {t('Candidate CV Library')} ({submissions.length})
              </h3>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
                {t('Supporting list of submitted and media CVs used in ranking.')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge color="gray" label={`${t('Applied')} ${pipelineCandidates.filter((item) => item.review_stage === 'Applied').length}`} />
              <Badge color="yellow" label={`${t('Shortlisted')} ${pipelineCandidates.filter((item) => item.review_stage === 'Shortlisted').length}`} />
              <Badge color="accent" label={`${t('Interview')} ${pipelineCandidates.filter((item) => item.review_stage === 'Interview').length}`} />
              <Badge color="green" label={`${t('Hired')} ${pipelineCandidates.filter((item) => item.review_stage === 'Hired').length}`} />
            </div>
          </div>

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--gray-50)', borderRadius: 12 }}>
              <svg width="48" height="48" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 16px', display: 'block' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 4 }}>{t('No CV records available')}</p>
              <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>{t('Once CVs are submitted or detected in media, they will appear here.')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {submissions.map((submission) => {
                const stageHistory = Array.isArray(submission.stage_history)
                  ? [...submission.stage_history].slice(-3).reverse()
                  : [];

                return (
                <div key={submission.id || submission.resume_filename || submission.resume_file} style={{
                  padding: 16,
                  border: '1px solid #EAECF0',
                  borderRadius: 12,
                  background: 'var(--gray-50)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' }}>
                      {submission.candidate_name || t('Anonymous Candidate')}
                    </div>
                    <Badge
                      color={submission.status === 'MEDIA' ? 'accent' : 'green'}
                      label={submission.status === 'MEDIA' ? t('From Media') : t('From Application')}
                    />
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>
                    {submission.candidate_email || t('No email provided')}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Badge color={getStageColor(submission.review_stage || 'Applied')} label={t(submission.review_stage || 'Applied')} />
                    {submission.talent_pool ? <Badge color="green" label={t('Talent Pool')} /> : null}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 8 }}>
                    {t('CV File:')} {submission.resume_filename || t('Not available')}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
                    {t('Added:')} {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : t('N/A')}
                  </div>

                  {stageHistory.length ? (
                    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: '#fff', border: '1px solid #E7EAEE' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                        {t('Decision timeline')}
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {stageHistory.map((entry, idx) => (
                          <div key={`${submission.id || submission.resume_filename}-history-${idx}`} style={{ padding: '8px 10px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #EEF2F6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <strong style={{ fontSize: 12.5 }}>{t(entry.to_stage || 'Applied')}</strong>
                              <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{entry.updated_at ? new Date(entry.updated_at).toLocaleDateString() : t('N/A')}</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--gray-600)' }}>
                              {t('Updated by')}: {entry.updated_by || t('HR team')}
                            </div>
                            {entry.note ? <div style={{ fontSize: 11.5, color: 'var(--gray-700)', marginTop: 4 }}>{entry.note}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {submission.status !== 'MEDIA' && (
                    <div style={{ marginBottom: 12, display: 'grid', gap: 8 }}>
                      <select
                        value={stageDrafts[submission.id]?.review_stage || submission.review_stage || 'Applied'}
                        onChange={(e) => updateStageDraft(submission.id, 'review_stage', e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #D0D5DD', borderRadius: 10, fontSize: 12.5, outline: 'none' }}
                      >
                        <option value="Applied">{t('Applied')}</option>
                        <option value="Shortlisted">{t('Shortlisted')}</option>
                        <option value="Interview">{t('Interview')}</option>
                        <option value="Hired">{t('Hired')}</option>
                        <option value="Rejected">{t('Rejected')}</option>
                      </select>

                      <textarea
                        value={stageDrafts[submission.id]?.stage_notes || ''}
                        onChange={(e) => updateStageDraft(submission.id, 'stage_notes', e.target.value)}
                        placeholder={t('Add quick review notes')}
                        rows={3}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #D0D5DD', borderRadius: 10, fontSize: 12.5, resize: 'vertical', outline: 'none' }}
                      />

                      {['Rejected', 'Hired'].includes(stageDrafts[submission.id]?.review_stage || submission.review_stage || 'Applied') ? (
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: -2 }}>
                          {t('approval.stageHint')}
                        </div>
                      ) : null}

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gray-700)' }}>
                        <input
                          type="checkbox"
                          checked={stageDrafts[submission.id]?.talent_pool ?? (submission.talent_pool !== false)}
                          onChange={(e) => updateStageDraft(submission.id, 'talent_pool', e.target.checked)}
                        />
                        {t('Keep candidate in talent pool')}
                      </label>

                      <Btn size="sm" onClick={() => handleStageUpdate(submission)} disabled={stageSavingId === submission.id}>
                        {stageSavingId === submission.id ? t('Updating...') : t('Update Stage')}
                      </Btn>
                    </div>
                  )}

                  {submission.candidate_skills && submission.candidate_skills.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {t('Top Skills')}
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
              );})}
            </div>
          )}
        </div>
      )}

      {loading && <Spinner />}
    </div>
  );
}