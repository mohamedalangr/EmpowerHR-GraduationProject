import { useState } from 'react';
import { runPrediction } from '../../api/index.js';
import { Spinner, Btn, Badge, useToast } from '../../components/shared/index.jsx';

const RISK_COLORS = { High: '#E8321A', Medium: '#F59E0B', Low: '#22C55E' };
const RISK_BG     = { High: '#FFF0ED', Medium: '#FFF7ED', Low: '#F0FDF4' };

export function HRDashboardPage() {
  const toast = useToast();
  const [predictions, setPredictions] = useState([]);
  const [running, setRunning]         = useState(false);
  const [lastRun, setLastRun]         = useState(null);
  const [formTitle, setFormTitle]     = useState('');
  const [hasRun, setHasRun]           = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const data = await runPrediction();
      if (data.error) throw new Error(data.error);
      setPredictions(data.predictions || []);
      setFormTitle(data.formTitle || '');
      setLastRun(new Date());
      setHasRun(true);
      toast(`Prediction complete -- ${data.totalProcessed} employees analysed`);
    } catch (e) {
      toast('Prediction failed: ' + e.message, 'error');
    }
    setRunning(false);
  };

  const sorted = [...predictions].sort((a, b) => b.riskScore - a.riskScore);
  const high   = sorted.filter(p => p.riskLevel === 'High').length;
  const medium = sorted.filter(p => p.riskLevel === 'Medium').length;
  const low    = sorted.filter(p => p.riskLevel === 'Low').length;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Attrition Risk Dashboard</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>Run predictions based on the latest completed feedback submissions</p>
        </div>
        <div>
          <Btn onClick={handleRun} disabled={running} style={{ minWidth: 160 }}>
            {running
              ? <><Spinner size={16} />&nbsp;Running...</>
              : <><svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>Run Prediction</>
            }
          </Btn>
          {lastRun && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6, textAlign: 'right' }}>
              Last run: {lastRun.toLocaleTimeString()} {formTitle && `-- ${formTitle}`}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'High Risk',   value: high,   color: 'var(--red)', bg: 'var(--red-light)',   icon: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
          { label: 'Medium Risk', value: medium, color: '#F59E0B',    bg: '#FFF7ED',             icon: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
          { label: 'Low Risk',    value: low,    color: '#22C55E',    bg: '#F0FDF4',             icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--white)', borderRadius: 20, padding: '20px 24px', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{hasRun ? s.value : '—'}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" fill="none" stroke={s.color} strokeWidth="2" viewBox="0 0 24 24"><path d={s.icon}/></svg>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {!hasRun ? (
        <div style={{ textAlign: 'center', padding: '80px 32px', background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0' }}>
          <svg width="48" height="48" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 16px', display: 'block' }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 4 }}>No predictions yet</p>
          <p style={{ fontSize: 12, color: 'var(--gray-300)' }}>Click Run Prediction to analyse attrition risk</p>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-300)' }}>No submissions found for the latest active form.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['Employee', 'Job Title', 'Department', 'Team', 'Risk Level', 'Risk Score'].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #EAECF0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const pct   = Math.round(p.riskScore * 100);
                const color = RISK_COLORS[p.riskLevel] || 'var(--gray-500)';
                const bg    = RISK_BG[p.riskLevel]    || 'var(--gray-100)';
                return (
                  <tr key={p.predictionID || i} style={{ borderBottom: '1px solid #F3F4F6' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.fullName || p.employeeID}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{p.employeeID}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{p.jobTitle || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                    <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{p.department || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                    <td style={{ padding: '16px 20px', fontSize: 13.5 }}>{p.team || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: bg, color }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }}/>
                        {p.riskLevel}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden', maxWidth: 120 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .8s' }}/>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
