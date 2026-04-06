import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getCandidateApplications, getJobs, submitResume } from '../../api/index.js';
import { Spinner, Modal, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const APPLICATION_STAGES = ['Applied', 'Shortlisted', 'Interview', 'Hired'];

const formatApplicationDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const getStageProgressIndex = (stage) => {
  const index = APPLICATION_STAGES.indexOf(stage);
  return index === -1 ? 0 : index;
};

const getApplicationGuidance = (stage) => {
  if (stage === 'Interview') return 'Prepare for the next conversation and keep an eye on recruiter updates.';
  if (stage === 'Shortlisted') return 'Your profile is moving forward — keep your phone and inbox ready.';
  if (stage === 'Hired') return 'Congratulations — expect onboarding and final HR communication next.';
  if (stage === 'Rejected') return 'This role is closed, but you can keep tracking new openings and stay in the talent pool.';
  return 'Your application is under review. Keep checking for stage updates and notes.';
};

const getStageTone = (stage) => {
  if (stage === 'Hired') return 'green';
  if (stage === 'Rejected') return 'red';
  if (stage === 'Interview') return 'accent';
  if (stage === 'Shortlisted') return 'blue';
  return 'slate';
};

export function EmployeeCareersPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const name = user?.full_name ?? '';
  const email = user?.email ?? '';
  const isSignedInCandidate = user?.role === 'Candidate';
  const queryEmail = searchParams.get('email') || '';
  const isApplicationsView = location.pathname.includes('/applications');
  const isCandidateDashboard = location.pathname.includes('/candidate/dashboard');
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [trackingEmail, setTrackingEmail] = useState(email);
  const [trackingCode, setTrackingCode] = useState('');
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [trackerLoaded, setTrackerLoaded] = useState(false);
  const [applications, setApplications] = useState([]);
  const [applicationDetails, setApplicationDetails] = useState({
    candidate_name: name,
    candidate_email: email,
  });

  const heroTitle = isApplicationsView
    ? t('Track your job applications in one place.')
    : isCandidateDashboard
      ? t('Candidate Command Center')
      : t('page.careers.title');
  const heroSubtitle = isApplicationsView
    ? t('See each submitted role, current review stage, and latest HR notes instantly.')
    : isCandidateDashboard
      ? t('Stay close to new openings, application momentum, and interview preparation from one place.')
      : t('page.careers.subtitle');

  const filtered = jobs.filter((job) =>
    job.title?.toLowerCase().includes(search.toLowerCase()) ||
    (job.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const featuredJob = selected || filtered[0] || jobs[0] || null;
  const activeApplications = applications.filter((item) => !['Hired', 'Rejected'].includes(item.review_stage)).length;
  const interviewApplications = applications.filter((item) => item.review_stage === 'Interview').length;
  const closedApplications = applications.filter((item) => ['Hired', 'Rejected'].includes(item.review_stage)).length;
  const latestApplication = applications[0] || null;
  const nextActionText = latestApplication ? getApplicationGuidance(latestApplication.review_stage || 'Applied') : t('Submit an application to unlock live tracking and recruiter updates.');
  const applicationCompletion = applications.length ? Math.round((closedApplications / applications.length) * 100) : 0;
  const searchSummary = useMemo(() => {
    if (!search.trim()) return `${jobs.length} ${t('roles available now')}`;
    return filtered.length === 0
      ? t('No roles match your current search.')
      : `${filtered.length} ${t('matching roles found')}`;
  }, [filtered.length, jobs.length, search, t]);

  const averageMatchScore = applications.length
    ? Math.round(applications.reduce((sum, item) => sum + Number(item.ats_score || 0), 0) / applications.length)
    : null;

  const roleSignals = useMemo(() => {
    const departmentMap = new Map();
    const skillMap = new Map();

    filtered.forEach((job) => {
      const department = job.department || 'General';
      departmentMap.set(department, (departmentMap.get(department) || 0) + 1);
      (job.required_skills || []).forEach((skill) => {
        skillMap.set(skill, (skillMap.get(skill) || 0) + 1);
      });
    });

    return {
      topDepartments: Array.from(departmentMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4),
      topSkills: Array.from(skillMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [filtered]);

  const interviewReadinessItems = useMemo(() => (
    applications
      .filter((item) => !['Hired', 'Rejected'].includes(item.review_stage || 'Applied'))
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        title: item.job_title || t('Untitled'),
        stage: item.review_stage || 'Applied',
        guidance: getApplicationGuidance(item.review_stage || 'Applied'),
        updatedAt: formatApplicationDate(item.stage_updated_at || item.submitted_at) || t('N/A'),
      }))
  ), [applications, t]);

  const loadApplications = async (emailToLookup = trackingEmail, options = {}) => {
    const { silent = false, codeToLookup = trackingCode } = options;
    const normalizedEmail = (emailToLookup || '').trim().toLowerCase();
    const normalizedCode = (codeToLookup || '').trim().toUpperCase();
    if (!normalizedEmail) {
      toast(t('Please enter your email address to track your applications.'), 'error');
      return;
    }
    if (!isSignedInCandidate && !normalizedCode) {
      toast(t('Enter your tracking code to view application updates securely.'), 'error');
      return;
    }

    setApplicationLoading(true);
    try {
      const data = await getCandidateApplications(
        isSignedInCandidate
          ? { email: normalizedEmail }
          : { email: normalizedEmail, trackingCode: normalizedCode }
      );
      setApplications(Array.isArray(data) ? data : []);
      setTrackerLoaded(true);
      if (!silent && Array.isArray(data) && data.length > 0) {
        toast(t('Application tracker updated.'));
      }
    } catch (error) {
      toast(error.message || t('Could not load your application tracker.'), 'error');
    } finally {
      setApplicationLoading(false);
    }
  };

  useEffect(() => {
    getJobs()
      .then((data) => { setJobs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { toast('Could not reach API', 'error'); setLoading(false); });
  }, []);

  useEffect(() => {
    setApplicationDetails((current) => ({
      candidate_name: current.candidate_name || name,
      candidate_email: current.candidate_email || email,
    }));
    if (!trackingEmail && email) {
      setTrackingEmail(email);
    }
  }, [name, email, trackingEmail]);

  useEffect(() => {
    const initialEmail = queryEmail || email;
    const initialCode = searchParams.get('tracking_code') || '';
    if (!initialEmail) return;
    setTrackingEmail(initialEmail);
    if (initialCode) {
      setTrackingCode(initialCode);
    }

    if (isApplicationsView || queryEmail) {
      loadApplications(initialEmail, { silent: true, codeToLookup: initialCode || trackingCode });
    }
  }, [email, isApplicationsView, queryEmail, searchParams]);

  useEffect(() => {
    const requestedJobId = searchParams.get('job');
    if (!requestedJobId || jobs.length === 0) return;
    const matchedJob = jobs.find((job) => String(job.id) === String(requestedJobId));
    if (matchedJob) {
      setSelected(matchedJob);
      setShowApply(true);
      setResult(null);
    }
  }, [jobs, searchParams]);

  const handleApply = async () => {
    if (!selected) { toast('Please choose a job first', 'error'); return; }
    if (!applicationDetails.candidate_name.trim()) { toast('Please enter your name', 'error'); return; }
    if (!applicationDetails.candidate_email.trim()) { toast('Please enter your email', 'error'); return; }
    if (!file) { toast('Please upload your resume', 'error'); return; }

    setSubmitting(true);
    setResult(null);
    const fd = new FormData();
    fd.append('job', selected.id);
    fd.append('resume_file', file, file.name);
    fd.append('candidate_name', applicationDetails.candidate_name.trim());
    fd.append('candidate_email', applicationDetails.candidate_email.trim());

    try {
      const data = await submitResume(fd);
      setResult(data);
      setTrackingEmail(applicationDetails.candidate_email.trim());
      setTrackingCode(data.tracking_code || '');
      setTrackerLoaded(true);
      setApplications((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      toast('Application submitted successfully');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <section className="careers-hero">
        <div className="careers-hero-inner">
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px,5vw,56px)', fontWeight: 400, lineHeight: 1.12, maxWidth: 760 }}>
            {heroTitle}
          </h1>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 560, lineHeight: 1.6 }}>{heroSubtitle}</p>
          <div style={{ width: '100%', maxWidth: 560, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, stroke: 'var(--gray-300)', fill: 'none', pointerEvents: 'none' }} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search by role or department...')}
              style={{ width: '100%', padding: '16px 20px 16px 50px', border: '2px solid transparent', background: 'var(--gray-100)', borderRadius: 9999, fontSize: 15, fontFamily: 'var(--sans)', fontWeight: 500, color: 'var(--gray-900)', outline: 'none' }}
              onFocus={(e) => { e.target.style.background = 'var(--white)'; e.target.style.borderColor = 'var(--red)'; }}
              onBlur={(e) => { e.target.style.background = 'var(--gray-100)'; e.target.style.borderColor = 'transparent'; }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn variant={isApplicationsView ? 'ghost' : 'primary'} onClick={() => navigate('/careers')}>
              {t('Browse Roles')}
            </Btn>
            <Btn variant={isApplicationsView ? 'primary' : 'outline'} onClick={() => navigate('/candidate/applications')}>
              {t('Track My Applications')}
            </Btn>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 28px 0' }}>
        <div className="hr-surface-card" style={{ padding: 24, borderRadius: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('Candidate Journey Board')}
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{t('See your current pipeline, role demand, and next best moves across the hiring journey.')}</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--gray-500)', maxWidth: 720 }}>
                {t('Own the job journey, applications, and hiring updates.')}
              </p>
            </div>
            <Badge color="accent" label={searchSummary} />
          </div>

          <div className="hr-stats-grid" style={{ marginBottom: 18 }}>
            {[
              [t('Live Openings'), jobs.length, 'var(--red-light)'],
              [t('Applications'), applications.length, '#EEF6FF'],
              [t('Interviews'), interviewApplications, '#ECFDF3'],
              [t('Average ATS Match'), averageMatchScore != null ? `${averageMatchScore}%` : '—', '#FFF7ED'],
            ].map(([label, value, bg]) => (
              <div key={label} style={{ background: bg, borderRadius: 18, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid #E7EAEE', borderRadius: 18, padding: '14px 16px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{t('Role Match Radar')}</div>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Spot the hottest departments and most requested skills before you apply.')}</p>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>{t('Top hiring departments')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {roleSignals.topDepartments.length
                    ? roleSignals.topDepartments.map(([department, count]) => (
                        <Badge key={`${department}-${count}`} color="blue" label={`${department} · ${count}`} />
                      ))
                    : <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No roles match your current search.')}</span>}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>{t('Skill demand')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {roleSignals.topSkills.length
                    ? roleSignals.topSkills.map(([skill, count]) => (
                        <Badge key={`${skill}-${count}`} color="slate" label={`${skill} · ${count}`} />
                      ))
                    : <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No roles match your current search.')}</span>}
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{t('Featured Role')}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{featuredJob?.title || t('Explore your next opportunity')}</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                  {featuredJob ? `${featuredJob.department || t('General role')} • ${featuredJob.min_experience_years || 0}+ ${t('yrs')}` : t('Start your application journey')}
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid #E7EAEE', borderRadius: 18, padding: '14px 16px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{t('Interview Readiness')}</div>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Get ready for the next recruiter step with focused actions for each live application.')}</p>

              {interviewReadinessItems.length === 0 ? (
                <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '24px 18px' }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{t('No active application prep yet. Apply to a role to start building your readiness queue.')}</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {interviewReadinessItems.map((item) => (
                    <div key={item.id} style={{ padding: '12px 14px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13.5, color: 'var(--gray-900)' }}>{item.title}</strong>
                        <Badge color={getStageTone(item.stage)} label={t(item.stage)} />
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-600)', lineHeight: 1.55 }}>{t(item.guidance)}</div>
                      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--gray-500)' }}>{t('Last updated')}: {item.updatedAt}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 24, borderRadius: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('Application Tracker')}
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{t('Follow every hiring step')}</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--gray-500)', maxWidth: 720 }}>
                {t(isSignedInCandidate
                  ? 'Your signed-in account can view your application updates automatically.'
                  : 'Use the same email and secure tracking code from your submission confirmation to view hiring progress and recruiter notes.')}
              </p>
            </div>
            <Badge color="accent" label={`${applications.length} ${t('Applications')}`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, .9fr) auto', gap: 12, alignItems: 'center', marginBottom: 18 }}>
            <div>
              <input
                type="email"
                value={trackingEmail}
                onChange={(e) => setTrackingEmail(e.target.value)}
                placeholder={t('Enter your application email')}
                disabled={isSignedInCandidate}
                style={{ width: '100%', padding: '13px 14px', border: '1px solid #E7EAEE', borderRadius: 14, fontSize: 13.5, outline: 'none', background: isSignedInCandidate ? '#F8FAFC' : '#fff' }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-500)' }}>{t(isSignedInCandidate ? 'Signed in as your candidate account.' : 'Use the same email address you applied with.')}</div>
            </div>
            <div>
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                placeholder={t('Tracking code')}
                disabled={isSignedInCandidate}
                style={{ width: '100%', padding: '13px 14px', border: '1px solid #E7EAEE', borderRadius: 14, fontSize: 13.5, outline: 'none', background: isSignedInCandidate ? '#F8FAFC' : '#fff' }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-500)' }}>{t(isSignedInCandidate ? 'No code needed while signed in.' : 'This secure code is shown after you apply.')}</div>
            </div>
            <Btn onClick={() => loadApplications()} disabled={applicationLoading} style={{ minWidth: 170, justifyContent: 'center' }}>
              {applicationLoading ? t('common.loading') : t('Track Applications')}
            </Btn>
          </div>

          <div className="hr-stats-grid" style={{ marginBottom: 18 }}>
            {[
              [t('Applications'), applications.length, 'var(--red-light)'],
              [t('Active pipelines'), activeApplications, '#EEF6FF'],
              [t('Interviews'), interviewApplications, '#ECFDF3'],
              [t('Closed updates'), closedApplications, '#FFF7ED'],
            ].map(([label, value, bg]) => (
              <div key={label} style={{ background: bg, borderRadius: 18, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 12, marginBottom: 18 }}>
            <div style={{ border: '1px solid #E7EAEE', borderRadius: 18, padding: '14px 16px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{t('Next Best Step')}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 4 }}>
                {latestApplication ? `${t(latestApplication.job_title || 'Latest application')} · ${t(latestApplication.review_stage || 'Applied')}` : t('Start your application journey')}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)', lineHeight: 1.55 }}>{t(nextActionText)}</div>
            </div>
            <div style={{ border: '1px solid #E7EAEE', borderRadius: 18, padding: '14px 16px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{t('Tracker Health')}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>{applications.length ? `${applicationCompletion}%` : '—'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{applications.length ? t('of your tracked applications are already closed.') : t('Your tracker will update after the first submitted application.')}</div>
            </div>
          </div>

          {!trackerLoaded ? (
            <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('No applications yet')}</p>
              <p style={{ margin: '8px 0 0', color: 'var(--gray-500)' }}>{t('Once you submit a resume, your hiring stage updates will appear here.')}</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('No applications found for this email yet.')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {applications.map((application) => {
                const currentStage = application.review_stage || 'Applied';
                const progressIndex = getStageProgressIndex(currentStage);
                const isRejected = currentStage === 'Rejected';
                const updatedAt = formatApplicationDate(application.stage_updated_at || application.submitted_at) || t('N/A');
                const submittedAt = formatApplicationDate(application.submitted_at) || t('N/A');
                const history = Array.isArray(application.stage_history)
                  ? [...application.stage_history].slice(-3).reverse()
                  : [];

                return (
                  <div key={application.id} style={{ border: '1px solid #E7EAEE', borderRadius: 22, padding: 18, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{application.job_title || t('Untitled')}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          <Badge color={isRejected ? 'red' : currentStage === 'Hired' ? 'green' : 'accent'} label={`${t('Current stage')}: ${t(currentStage)}`} />
                          {application.talent_pool ? <Badge color="green" label={t('Talent Pool')} /> : <Badge color="slate" label={t('In review')} />}
                        </div>
                      </div>
                      <div style={{ minWidth: 120, textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('ATS Match Score')}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>
                          {application.ats_score != null ? Number(application.ats_score).toFixed(1) : '--'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                      {[
                        [t('Submitted'), submittedAt],
                        [t('Last updated'), updatedAt],
                        [t('Current stage'), t(currentStage)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: '#F8FAFC', borderRadius: 14, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                      {APPLICATION_STAGES.map((stage, index) => {
                        const isComplete = !isRejected && index <= progressIndex;
                        const isCurrent = !isRejected && stage === currentStage;
                        return (
                          <div
                            key={`${application.id}-${stage}`}
                            style={{
                              borderRadius: 14,
                              padding: '10px 8px',
                              textAlign: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              background: isCurrent ? 'rgba(232,50,26,.12)' : isComplete ? '#FEEDEA' : '#F8FAFC',
                              color: isCurrent || isComplete ? 'var(--red)' : 'var(--gray-500)',
                              border: `1px solid ${isCurrent ? 'rgba(232,50,26,.28)' : '#E7EAEE'}`,
                            }}
                          >
                            {t(stage)}
                          </div>
                        );
                      })}
                    </div>

                    {isRejected ? (
                      <div style={{ marginBottom: 12, color: '#B42318', fontWeight: 700 }}>
                        {t('Current decision:')} {t('Rejected')}
                      </div>
                    ) : null}

                    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{t('What to expect next')}</div>
                      <div style={{ fontSize: 12.5, color: '#344054', lineHeight: 1.55 }}>{t(getApplicationGuidance(currentStage))}</div>
                    </div>

                    {history.length ? (
                      <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 14, background: '#fff', border: '1px solid #E7EAEE' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{t('Decision timeline')}</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {history.map((entry, index) => (
                            <div key={`${application.id}-history-${index}`} style={{ padding: '8px 10px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #EEF2F6' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                <strong style={{ fontSize: 12.5 }}>{t(entry.to_stage || 'Applied')}</strong>
                                <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{formatApplicationDate(entry.updated_at) || t('N/A')}</span>
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--gray-600)' }}>{t('Updated by')}: {entry.updated_by || t('HR team')}</div>
                              {entry.note ? <div style={{ fontSize: 11.5, color: 'var(--gray-700)', marginTop: 4 }}>{entry.note}</div> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.6 }}>
                      {application.stage_notes?.trim() || t('No stage notes yet.')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="careers-layout">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{loading ? t('common.loading') : `${filtered.length} ${t('Open Positions')}`}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{searchSummary}</div>
            </div>
            {search.trim() ? <Btn variant="ghost" onClick={() => setSearch('')}>{t('Clear Search')}</Btn> : null}
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div> : filtered.length === 0 ? (
            <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '48px 28px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>{t('No roles match your current search.')}</p>
              <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 14 }}>{t('Try a broader keyword or return to all current openings.')}</p>
              <Btn variant="ghost" onClick={() => setSearch('')}>{t('Reset Search')}</Btn>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filtered.map((job) => (
                <div
                  key={job.id}
                  className="careers-job-card"
                  onClick={() => setSelected(job)}
                  style={{
                    border: `2px solid ${selected?.id === job.id ? 'var(--red)' : '#EAECF0'}`,
                    boxShadow: selected?.id === job.id ? '0 0 0 4px rgba(232,50,26,.08)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (selected?.id !== job.id) {
                      e.currentTarget.style.borderColor = 'var(--red-mid)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selected?.id !== job.id) {
                      e.currentTarget.style.borderColor = '#EAECF0';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{job.title}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>{t(job.department || 'General')}</div>
                    </div>
                    <div style={{ width: 32, height: 32, background: 'var(--gray-100)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" fill="none" stroke="var(--gray-400)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[[t('Remote'), 'Remote'], [`${job.min_experience_years || 0}+ ${t('yrs')}`, 'Experience']].map(([value]) => (
                      <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 500 }}>
                        <svg width="14" height="14" fill="none" stroke="var(--gray-300)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                        {value}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                    {(job.required_skills || []).slice(0, 3).map((skill) => (
                      <Badge key={`${job.id}-${skill}`} color="slate" label={skill} />
                    ))}
                    {(job.required_skills || []).length === 0 ? <Badge color="slate" label={t('General role')} /> : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{t('Req.')} {job.min_experience_years || 0}+ {t('yrs')}</span>
                    <Btn size="sm" onClick={(e) => { e.stopPropagation(); setSelected(job); setShowApply(true); setResult(null); setFile(null); }}>{t('Apply Now')}</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside>
          {!selected ? (
            <div className="careers-sidebar-card" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <span style={{ display: 'inline-flex', padding: '5px 12px', background: 'var(--accent-light)', color: '#8B4A42', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', marginBottom: 16 }}>
                {t('Candidate Spotlight')}
              </span>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, lineHeight: 1.2, marginBottom: 6 }}>{featuredJob?.title || t('Explore your next opportunity')}</h2>
              <p style={{ fontSize: 13.5, color: 'var(--gray-500)', lineHeight: 1.65, marginBottom: 16 }}>
                {featuredJob?.description || t('Select a role to review its details, required skills, and application path.')}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                {(featuredJob?.required_skills || []).slice(0, 4).map((skill) => (
                  <Badge key={`featured-${skill}`} color="slate" label={skill} />
                ))}
              </div>
              <Btn onClick={() => featuredJob ? setSelected(featuredJob) : null} style={{ width: '100%', padding: 15 }}>
                {t('Preview Role')}
              </Btn>
            </div>
          ) : (
            <div className="careers-sidebar-card" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <span style={{ display: 'inline-flex', padding: '5px 12px', background: 'var(--accent-light)', color: '#8B4A42', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', marginBottom: 16 }}>
                JP-{String(selected.id).padStart(3, '0')}
              </span>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, lineHeight: 1.2, marginBottom: 6 }}>{selected.title}</h2>
              <p style={{ fontSize: 13.5, color: 'var(--gray-500)', lineHeight: 1.65, marginBottom: 18 }}>{selected.description}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{t('Experience')}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{selected.min_experience_years || 0}+ {t('yrs')}</div>
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{t('Degree')}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{selected.required_degree || t('Open')}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{t('Required skills')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                {(selected.required_skills || []).length ? (selected.required_skills || []).map((skill) => (
                  <Badge key={`selected-${skill}`} color="slate" label={skill} />
                )) : <Badge color="slate" label={t('General role')} />}
              </div>
              <Btn onClick={() => { setShowApply(true); setResult(null); setFile(null); }} style={{ width: '100%', padding: 15 }}>
                {t('Apply Now')}
                <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Btn>
            </div>
          )}
        </aside>
      </div>

      <Modal open={showApply} onClose={() => { setShowApply(false); setResult(null); }} title={result ? t('Pipeline Results') : `${t('Apply for')} ${selected?.title || ''}`} maxWidth={580}>
        {result ? (
          <div>
            <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid #F3F4F6', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.15em', color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('ATS Match Score')}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 68, color: result.ats_score >= 70 ? '#22C55E' : 'var(--red)' }}>{(result.ats_score || 0).toFixed(1)}</div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge color="accent" label={`${t('Stage:')} ${t(result.review_stage || 'Applied')}`} />
                {result.talent_pool ? <Badge color="green" label={t('Talent Pool')} /> : null}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 12 }}>
                {t('Your application is now in the hiring pipeline and ready for HR review.')}
              </p>
              {result.tracking_code ? (
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{t('Tracking code')}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.08em', color: 'var(--red)' }}>{result.tracking_code}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{t('Save this code if you want to track updates without signing in.')}</div>
                </div>
              ) : null}
            </div>
            {[['Skills', result.skills_score, '#E8321A'], ['Experience', result.experience_score, '#3B82F6'], ['Education', result.education_score, '#F59E0B'], ['Semantic', result.semantic_score, '#10B981']].map(([label, value, color]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  <span style={{ color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
                  <span style={{ fontWeight: 700 }}>{(value || 0).toFixed(1)}%</span>
                </div>
                <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${value || 0}%`, background: color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 18 }}>
              <Btn onClick={() => { setShowApply(false); loadApplications(result.candidate_email || applicationDetails.candidate_email, { silent: true, codeToLookup: result.tracking_code || trackingCode }); }} style={{ width: '100%', justifyContent: 'center' }}>
                {t('Track Applications')}
              </Btn>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16, fontSize: 12.5, color: 'var(--gray-500)' }}>
              {t('You can apply publicly without logging in. HR will review your application after submission.')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <input
                type="text"
                placeholder={t('Full name')}
                value={applicationDetails.candidate_name}
                onChange={(e) => setApplicationDetails((current) => ({ ...current, candidate_name: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #E7EAEE', borderRadius: 12, fontSize: 13.5, outline: 'none' }}
              />
              <input
                type="email"
                placeholder={t('Email address')}
                value={applicationDetails.candidate_email}
                onChange={(e) => setApplicationDetails((current) => ({ ...current, candidate_email: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #E7EAEE', borderRadius: 12, fontSize: 13.5, outline: 'none' }}
              />
            </div>
            <div
              onClick={() => document.getElementById('resume-input').click()}
              style={{ padding: 28, background: 'var(--red-light)', border: '2px dashed var(--red-mid)', borderRadius: 24, textAlign: 'center', cursor: 'pointer', marginBottom: 20 }}
            >
              <input type="file" id="resume-input" accept=".pdf,.txt" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
              <svg width="22" height="22" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24" style={{ margin: '0 auto 8px', display: 'block' }}><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" /></svg>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{file ? `${t('Selected:')} ${file.name}` : t('Upload Resume (PDF or TXT)')}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn variant="ghost" onClick={() => setShowApply(false)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
              <Btn onClick={handleApply} style={{ flex: 1 }} disabled={submitting}>{submitting ? t('Analysing...') : t('Submit Application')}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
