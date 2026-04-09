import { useEffect, useMemo, useState } from 'react';
import { getMyDocuments, submitDocumentRequest } from '../../api/index.js';
import { Badge, Btn, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  documentType: 'Employment Letter',
  purpose: '',
  notes: '',
};

const STATUS_COLORS = {
  Pending: 'orange',
  'In Progress': 'accent',
  Issued: 'green',
  Declined: 'red',
};

const daysSinceDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today - date) / (1000 * 60 * 60 * 24));
};

const getDocumentTone = (item) => {
  if (item?.status === 'Pending' && daysSinceDate(item?.createdAt) > 3) return 'red';
  if (item?.status === 'Issued') return 'green';
  if (item?.status === 'In Progress') return 'orange';
  return STATUS_COLORS[item?.status] || 'gray';
};

const getDocumentAgeLabel = (value, t) => {
  const days = daysSinceDate(value);
  if (!Number.isFinite(days)) return t('No date recorded');
  if (days === 0) return t('Today');
  if (days === 1) return t('1 day ago');
  return `${days} ${t('days ago')}`;
};

export function EmployeeDocumentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadDocuments = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyDocuments(user.employee_id);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(error.message || 'Failed to load document requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: documents.length,
    pending: documents.filter((item) => ['Pending', 'In Progress'].includes(item.status)).length,
    issued: documents.filter((item) => item.status === 'Issued').length,
  }), [documents]);

  const inProgressCount = documents.filter((item) => item.status === 'In Progress').length;
  const declinedCount = documents.filter((item) => item.status === 'Declined').length;
  const recentRequestsCount = documents.filter((item) => daysSinceDate(item.createdAt) <= 30).length;

  const documentFocusQueue = useMemo(() => {
    const statusRank = { Pending: 4, 'In Progress': 3, Declined: 2, Issued: 1 };
    return [...documents]
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || daysSinceDate(b.createdAt) - daysSinceDate(a.createdAt)
        || String(a.documentType || '').localeCompare(String(b.documentType || '')))
      .slice(0, 4);
  }, [documents]);

  const documentTypePressureMap = useMemo(() => {
    const grouped = documents.reduce((acc, item) => {
      const key = item.documentType || 'Other';
      if (!acc[key]) {
        acc[key] = { documentType: key, count: 0, openCount: 0, issuedCount: 0 };
      }
      acc[key].count += 1;
      if (['Pending', 'In Progress'].includes(item.status)) acc[key].openCount += 1;
      if (item.status === 'Issued') acc[key].issuedCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.openCount - a.openCount || b.count - a.count || b.issuedCount - a.issuedCount)
      .slice(0, 4);
  }, [documents]);

  const documentPlaybook = useMemo(() => {
    const plays = [];

    if (stats.pending > 0) {
      plays.push({
        title: t('Watch open document requests'),
        note: t('Pending or in-progress requests are the clearest place to monitor fulfillment timing and follow-up.'),
      });
    }
    if (inProgressCount > 0) {
      plays.push({
        title: t('Track requests already underway'),
        note: t('Requests in progress usually need less follow-up, but they are worth checking before urgent deadlines.'),
      });
    }
    if (declinedCount > 0) {
      plays.push({
        title: t('Review declined requests for rework'),
        note: t('A declined request often just needs clearer purpose or supporting detail before resubmission.'),
      });
    }
    if (recentRequestsCount > 0) {
      plays.push({
        title: t('Keep recent requests organized'),
        note: t('Newer document requests are easier to track when their purpose and urgency stay clear.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Document flow looks stable'),
      note: t('Your document-request activity is currently light, so keep using clear request notes when new needs come up.'),
    }];
  }, [declinedCount, inProgressCount, recentRequestsCount, stats.pending, t]);

  const strongestSignal = stats.pending > 0
    ? t('Some document requests are still open, so fulfillment timing is the clearest thing to watch next.')
    : inProgressCount > 0
      ? t('One or more requests are already in progress, making follow-through timing the main signal right now.')
      : declinedCount > 0
        ? t('A declined request suggests one rework or clarification may unlock the next document outcome fastest.')
        : t('Your document-request activity looks steady right now, with no major fulfillment pressure standing out.');

  const handleSubmit = async () => {
    if (!form.purpose.trim()) {
      toast('Purpose is required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitDocumentRequest({
        documentType: form.documentType,
        purpose: form.purpose.trim(),
        notes: form.notes.trim(),
      });
      toast('Document request submitted');
      setForm(INITIAL_FORM);
      await loadDocuments();
    } catch (error) {
      toast(error.message || 'Failed to submit document request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Document Requests')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Request HR letters and certificates, then track their issuance status.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Requests'), value: stats.total, accent: '#111827' },
          { label: t('Open'), value: stats.pending, accent: '#E8321A' },
          { label: t('Issued'), value: stats.issued, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Document Fulfillment Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Open Requests'), value: stats.pending, color: '#E8321A', note: t('Document requests still waiting for issue or completion.') },
                { label: t('In Progress'), value: inProgressCount, color: '#B54708', note: t('Requests already being prepared or processed by HR.') },
                { label: t('Declined'), value: declinedCount, color: '#175CD3', note: t('Requests that may need clarification or a fresh submission.') },
                { label: t('Recent'), value: recentRequestsCount, color: '#027A48', note: t('Requests created during the latest request window.') },
              ].map((item) => (
                <div key={item.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 12px', background: '#fff' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 23, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid #FDE68A', background: '#FFFBEB', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#B45309', marginBottom: 6 }}>{t('Strongest signal')}</div>
              <div style={{ fontSize: 13.5, color: '#92400E' }}>{strongestSignal}</div>
            </div>
          </div>

          <div className="hr-table-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Request Queue')}</h3>
            </div>
            {documentFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority document requests will appear here as they are submitted.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {documentFocusQueue.map((item) => (
                  <div key={`queue-${item.requestID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{t(item.documentType)}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.purpose}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{getDocumentAgeLabel(item.createdAt, t)}</div>
                    </div>
                    <Badge label={t(item.status)} color={getDocumentTone(item)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Document Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {documentPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Document Type Pressure')}</div>
            {documentTypePressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No document-type pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {documentTypePressureMap.map((item) => (
                  <div key={item.documentType} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.documentType)}</div>
                      <Badge label={`${item.count} ${t('requests')}`} color={item.openCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Open')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.openCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Issued')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.issuedCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Request a Document')}</h3>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Document Type')}</label>
            <select value={form.documentType} onChange={(e) => setForm((prev) => ({ ...prev, documentType: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 16 }}>
              {['Salary Certificate', 'Employment Letter', 'Experience Letter', 'ID Verification'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </select>
          </div>

          <Input label={t('Purpose')} value={form.purpose} onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))} placeholder={t('Bank account update / embassy request')} />
          <Textarea label={t('Notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t('Add any specific wording or urgency details')} />

          <Btn onClick={handleSubmit} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Submitting...') : t('Submit Request')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('My Requests')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : documents.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No document requests yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12, padding: 16 }}>
              {documents.map((item) => (
                <div key={item.requestID} className="hr-surface-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{item.documentType}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{item.purpose}</div>
                    </div>
                    <Badge label={t(item.status)} color={getDocumentTone(item)} />
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 8 }}>{item.notes || t('No extra notes provided.')}</p>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginBottom: 8 }}>{getDocumentAgeLabel(item.createdAt, t)}</div>
                  {item.reviewNote ? (
                    <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                      <strong>{t('HR update:')}</strong> {item.reviewNote}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
