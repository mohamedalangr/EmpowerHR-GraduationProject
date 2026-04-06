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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
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
                    <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 8 }}>{item.notes || t('No extra notes provided.')}</p>
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
