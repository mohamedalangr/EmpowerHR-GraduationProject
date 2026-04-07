import { useNavigate } from 'react-router-dom';
import { Btn } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';
import { EmployeeCareersPage } from './CareersPage';

const CANDIDATE_MODE_CONTENT = {
  dashboard: {
    chips: ['Browse Roles', 'Role Match Radar', 'Interview Readiness'],
    spotlightTitle: 'Candidate Route Highlights',
    spotlightNote: 'Explore roles like a guided trip, compare what fits quickly, and keep your next steps easy to spot.',
    highlights: [
      { label: 'Role Feed', value: 'Fresh', note: 'Discover open positions in a cleaner and more inviting browse flow.' },
      { label: 'Apply Flow', value: 'Easy', note: 'Move from curiosity to application with fewer distractions.' },
      { label: 'Next Steps', value: 'Clear', note: 'Stay ready for interviews and follow-ups from one place.' },
    ],
  },
  applications: {
    chips: ['Track My Applications', 'Interview Readiness', 'Latest HR Updates'],
    spotlightTitle: 'Application Journey',
    spotlightNote: 'Review each submitted role, understand where you stand, and come back with confidence any time.',
    highlights: [
      { label: 'Status View', value: 'Live', note: 'See stage changes and momentum in a more organized layout.' },
      { label: 'Follow-Up', value: 'Ready', note: 'Keep interviews, updates, and HR notes within easy reach.' },
      { label: 'Momentum', value: 'Focused', note: 'Know what to prepare next without losing track of earlier steps.' },
    ],
  },
};

function CandidateOwnedShell({ titleKey, subtitleKey, children, mode = 'dashboard' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const modeContent = CANDIDATE_MODE_CONTENT[mode] || CANDIDATE_MODE_CONTENT.dashboard;
  const shellChips = modeContent.chips;

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

        <div className="workspace-brief-grid">
          <div className="workspace-brief-card">
            <div className="workspace-brief-title">{t(modeContent.spotlightTitle)}</div>
            <div className="workspace-brief-copy">{t(modeContent.spotlightNote)}</div>
            <div className="workspace-chip-list">
              {shellChips.map((item) => (
                <span key={`${mode}-${item}`} className="workspace-chip">{t(item)}</span>
              ))}
            </div>
          </div>
          <div className="workspace-brief-card">
            <div className="workspace-brief-title">{t('What feels easier here')}</div>
            <div className="workspace-signal-list">
              {modeContent.highlights.map((item) => (
                <div key={`${mode}-${item.label}`} className="workspace-signal-item">
                  <div>
                    <strong>{t(item.label)}</strong>
                    <div className="workspace-signal-note">{t(item.note)}</div>
                  </div>
                  <span>{t(item.value)}</span>
                </div>
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
