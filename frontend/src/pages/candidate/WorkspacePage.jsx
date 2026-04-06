import { useNavigate } from 'react-router-dom';
import { Btn } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';
import { EmployeeCareersPage } from './CareersPage';

function CandidateOwnedShell({ titleKey, subtitleKey, children, mode = 'dashboard' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const shellChips = mode === 'applications'
    ? ['Track My Applications', 'Interview Readiness', 'Latest HR Updates']
    : ['Browse Roles', 'Role Match Radar', 'Interview Readiness'];

  return (
    <div>
      <div className="hr-surface-card workspace-shell-card workspace-shell-candidate" style={{ maxWidth: 1280, margin: '0 auto 18px', padding: '18px 20px' }}>
        <div className="workspace-shell-topline">{t('Candidate Experience')}</div>
        <div className="workspace-shell-header">
          <div className="workspace-shell-copy">
            <div className="workspace-shell-title">{t(titleKey)}</div>
            <div className="workspace-shell-subtitle">{t(subtitleKey)}</div>
            <div className="workspace-shell-meta">
              <span>{t(mode === 'applications' ? 'Application Tracker' : 'Candidate Command Center')}</span>
              <span>{t('Live Openings')}</span>
              <span>{t('Interview Readiness')}</span>
            </div>
          </div>
          <div className="workspace-shell-actions">
            <Btn size="sm" variant="ghost" onClick={() => navigate('/candidate/dashboard')}>{t('Browse Roles')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate('/candidate/applications')}>{t('Track My Applications')}</Btn>
          </div>
        </div>
        <div className="workspace-shell-focus">
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t('Candidate Focus')}</div>
            <div className="workspace-focus-note">{t('Keep your profile ready, watch new openings, and stay prepared for each hiring step.')}</div>
          </div>
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t('Next Steps')}</div>
            <div className="workspace-chip-list">
              {shellChips.map((item) => (
                <span key={item} className="workspace-chip">{t(item)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function CandidateDashboardPage() {
  return (
    <CandidateOwnedShell
      titleKey="Candidate Command Center"
      subtitleKey="Stay close to new openings, application momentum, and interview preparation from one place."
      mode="dashboard"
    >
      <EmployeeCareersPage />
    </CandidateOwnedShell>
  );
}

export function CandidateApplicationsPage() {
  return (
    <CandidateOwnedShell
      titleKey="Application Tracker"
      subtitleKey="See each submitted role, current review stage, and latest HR notes instantly."
      mode="applications"
    >
      <EmployeeCareersPage />
    </CandidateOwnedShell>
  );
}
