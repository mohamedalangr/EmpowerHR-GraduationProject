import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  hrGetForms,
  hrGetFormDetail,
  hrGetFormResponseSnapshot,
  hrCreateForm,
  hrUpdateForm,
  hrDeleteForm,
  hrActivateForm,
  hrDeactivateForm,
  hrAddQuestion,
  hrDeleteQuestion,
} from '../../api/index.js';
import { Spinner, Modal, Input, Textarea, Btn, Badge, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const downloadTextFile = (filename, content, mimeType = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const FIELD_TYPES = ['score_1_4', 'boolean', 'decimal'];
const FIELD_LABELS = { score_1_4: 'Score 1-4', boolean: 'Yes / No', decimal: 'Decimal' };
const EMPTY_RESPONSE_SNAPSHOT = { summary: {}, followUpItems: [] };

export function HRFormsPage() {
  const toast = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, resolvePath } = useAuth();
  const isAdminView = user?.role === 'Admin';
  const [forms, setForms]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedForm, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showAddQ, setShowAddQ]     = useState(false);
  const [formData, setFormData]     = useState({ title: '', description: '' });
  const [qData, setQData]           = useState({ questionText: '', fieldType: 'score_1_4', order: 0 });
  const [saving, setSaving]         = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [responseSnapshot, setResponseSnapshot] = useState(EMPTY_RESPONSE_SNAPSHOT);

  const loadFormDetail = async (formId, sourceForms = forms) => {
    if (!formId) {
      setSelected(null);
      return null;
    }

    try {
      const detail = await hrGetFormDetail(formId);
      if (detail?.formID) {
        setSelected(detail);
        return detail;
      }
    } catch {
      // Fall back to the list payload when detail loading is unavailable.
    }

    const fallback = (sourceForms || []).find((form) => form.formID === formId) || null;
    setSelected(fallback);
    return fallback;
  };

  const load = async (preferredFormId = null) => {
    setLoading(true);
    try {
      const [data, snapshot] = await Promise.all([
        hrGetForms(),
        hrGetFormResponseSnapshot().catch(() => EMPTY_RESPONSE_SNAPSHOT),
      ]);
      const nextForms = Array.isArray(data) ? data : [];
      setForms(nextForms);
      setResponseSnapshot(snapshot && typeof snapshot === 'object' ? snapshot : EMPTY_RESPONSE_SNAPSHOT);

      const formToSelect = preferredFormId || selectedForm?.formID || nextForms[0]?.formID || null;
      if (formToSelect) {
        await loadFormDetail(formToSelect, nextForms);
      } else {
        setSelected(null);
      }
    } catch {
      toast('Failed to load forms', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredForms = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return forms.filter((form) => {
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? form.isActive : !form.isActive);
      const matchesSearch = !search || [form.title, form.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [forms, searchTerm, statusFilter]);

  const activeCount = forms.filter((form) => form.isActive).length;
  const draftCount = forms.filter((form) => !form.isActive).length;
  const totalQuestions = forms.reduce((sum, form) => sum + Number(form.questionCount || form.questions?.length || 0), 0);
  const totalSubmissions = forms.reduce((sum, form) => sum + Number(form.submissionCount || 0), 0);
  const avgQuestions = forms.length ? Math.round(totalQuestions / forms.length) : 0;
  const responseSummary = responseSnapshot?.summary || {};

  const handleExportForms = () => {
    const rows = [
      ['Form Title', 'Status', 'Question Count', 'Submission Count', 'Description'],
      ...filteredForms.map((form) => [
        form.title || '',
        form.isActive ? 'Active' : 'Inactive',
        form.questionCount || form.questions?.length || 0,
        form.submissionCount || 0,
        form.description || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadTextFile(`forms-library-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(t('Forms exported.'));
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) { toast('Title is required', 'error'); return; }
    setSaving(true);
    const res = await hrCreateForm(formData);
    setSaving(false);
    if (res.formID) {
      toast('Form created');
      setShowCreate(false);
      setFormData({ title: '', description: '' });
      await load(res.formID);
    } else toast('Failed to create form', 'error');
  };

  const handleUpdate = async () => {
    if (!formData.title.trim()) { toast('Title is required', 'error'); return; }
    setSaving(true);
    const res = await hrUpdateForm(selectedForm.formID, formData);
    setSaving(false);
    if (res.formID) {
      toast('Form updated');
      setShowEdit(false);
      await load(selectedForm.formID);
    } else toast('Failed to update form', 'error');
  };

  const handleDelete = async (form) => {
    if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    await hrDeleteForm(form.formID);
    toast('Form deleted');
    const remainingForms = forms.filter((item) => item.formID !== form.formID);
    const nextSelection = selectedForm?.formID === form.formID
      ? (remainingForms[0]?.formID || null)
      : selectedForm?.formID;
    await load(nextSelection);
  };

  const handleToggleActive = async (form) => {
    if (form.isActive) {
      await hrDeactivateForm(form.formID);
      toast(`"${form.title}" deactivated`);
    } else {
      await hrActivateForm(form.formID);
      toast(`"${form.title}" is now active`);
    }
    await load(form.formID);
  };

  const handleAddQuestion = async () => {
    if (!qData.questionText.trim()) { toast('Question text is required', 'error'); return; }
    setSaving(true);
    const res = await hrAddQuestion(selectedForm.formID, qData);
    setSaving(false);
    if (res.questionID) {
      toast('Question added');
      setShowAddQ(false);
      setQData({ questionText: '', fieldType: 'score_1_4', order: 0 });
      await load(selectedForm.formID);
    } else toast('Failed to add question', 'error');
  };

  const handleDeleteQuestion = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    await hrDeleteQuestion(q.questionID);
    toast('Question deleted');
    await load(selectedForm.formID);
  };

  const handleExportResponseHealth = () => {
    const items = responseSnapshot?.followUpItems || [];
    if (!items.length) {
      toast('No response follow-up items to export.', 'error');
      return;
    }

    const rows = [
      ['Form', 'Status', 'Risk Level', 'Pending Responses', 'Completion Rate', 'Submission Count', 'Recommended Action'],
      ...items.map((item) => [
        item.title,
        item.status,
        item.riskLevel,
        item.pendingResponses,
        `${item.completionRate}%`,
        item.submissionCount,
        item.recommendedAction,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadTextFile(`form-response-health-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(t('Response health exported.'));
  };

  return (
    <div className="hr-page-shell">
      {/* Header */}
      <div className="hr-page-header is-split">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('page.forms.title')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>{t('page.forms.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="outline" onClick={handleExportForms} disabled={filteredForms.length === 0}>{t('Export CSV')}</Btn>
          <Btn variant="ghost" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>{t('Clear Filters')}</Btn>
          <Btn onClick={() => { setFormData({ title: '', description: '' }); setShowCreate(true); }}>
            <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('New Form')}
          </Btn>
        </div>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>
              {t(isAdminView ? 'Admin Control Center' : 'HR Operations')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {t(isAdminView
                ? 'Oversee users, access coverage, and operational readiness across the platform.'
                : 'People operations, compliance, and service delivery.')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/dashboard'))}>{t('nav.dashboard')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('nav.approvals')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/submissions'))}>{t('nav.submissions')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Total Forms'), value: forms.length, color: 'var(--gray-900)' },
            { label: t('Active Forms'), value: activeCount, color: '#22C55E' },
            { label: t('Pending Responses'), value: responseSummary.pendingResponses ?? 0, color: '#E8321A' },
            { label: t('Avg Completion'), value: `${responseSummary.averageCompletionRate ?? 0}%`, color: '#2563EB' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hr-stats-grid" style={{ marginBottom: 22 }}>
        {[
          { label: 'Total Forms', value: forms.length, color: 'var(--gray-900)' },
          { label: 'Active Forms', value: activeCount, color: '#22C55E' },
          { label: 'Pending Responses', value: responseSummary.pendingResponses ?? 0, color: '#E8321A' },
          { label: 'Low Coverage Forms', value: responseSummary.lowCoverageForms ?? draftCount, color: '#F59E0B' },
          { label: 'Avg Questions', value: avgQuestions, color: '#7C3AED' },
          { label: 'Avg Completion', value: `${responseSummary.averageCompletionRate ?? 0}%`, color: '#2563EB' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 22 }}>
        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Publishing Control')}</div>
          {selectedForm ? (
            <div style={{ display: 'grid', gap: 10, fontSize: 13.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Selected form')}</span><strong>{selectedForm.title}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Question count')}</span><strong>{selectedForm.questionCount || selectedForm.questions?.length || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Submission count')}</span><strong>{selectedForm.submissionCount || 0}</strong></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge label={selectedForm.isActive ? t('Live') : t('Draft')} color={selectedForm.isActive ? 'green' : 'orange'} />
                <Badge label={`${t('Questions')} ${selectedForm.questionCount || selectedForm.questions?.length || 0}`} color="accent" />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Select a form to review its lifecycle and publishing health.')}</div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Management Filters')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 10 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('Search forms by title or description')}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid #E7EAEE', outline: 'none' }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid #E7EAEE', outline: 'none', background: '#fff' }}
            >
              <option value="all">{t('All')}</option>
              <option value="active">{t('Active')}</option>
              <option value="inactive">{t('Inactive')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.15fr .85fr', marginBottom: 22 }}>
        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Response Health Snapshot')}</div>
            <Btn size="sm" variant="ghost" onClick={handleExportResponseHealth}>{t('Export Follow-up CSV')}</Btn>
          </div>

          {(responseSnapshot?.followUpItems || []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('All tracked forms are currently on pace for response collection.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {(responseSnapshot?.followUpItems || []).map((item) => (
                <div key={item.formID} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #E7EAEE', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
                    <Badge label={t(item.riskLevel)} color={item.riskLevel === 'High' ? 'red' : 'orange'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{t(item.status)} • {t('Pending Responses')}: {item.pendingResponses} • {t('Completion Rate')}: {item.completionRate}%</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)' }}>{t(item.recommendedAction)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Response Overview')}</div>
          <div style={{ display: 'grid', gap: 10, fontSize: 13.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Live forms')}</span><strong>{responseSummary.liveForms ?? activeCount}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Low coverage forms')}</span><strong>{responseSummary.lowCoverageForms ?? 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Zero response forms')}</span><strong>{responseSummary.zeroResponseForms ?? 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Tracked submissions')}</span><strong>{totalSubmissions}</strong></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : (
        <div className="hr-panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

          {/* Forms list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {forms.length === 0 && (
              <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>{t('No forms yet. Create one to get started.')}</p>
              </div>
            )}
            {forms.length > 0 && filteredForms.length === 0 && (
              <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '32px 24px' }}>
                <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>{t('No forms match the current management filter.')}</p>
              </div>
            )}
            {filteredForms.map(form => (
              <div key={form.formID}
                className="hr-click-card"
                onClick={() => loadFormDetail(form.formID, forms)}
                style={{
                  padding: '20px 22px',
                  border: `2px solid ${selectedForm?.formID === form.formID ? 'var(--red)' : '#EAECF0'}`,
                  cursor: 'pointer',
                  boxShadow: selectedForm?.formID === form.formID ? '0 0 0 4px rgba(232,50,26,.08)' : 'none',
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.title}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={form.isActive ? t('Active') : t('Inactive')} color={form.isActive ? 'green' : 'gray'} />
                      <Badge label={`${form.questionCount || 0} ${t('questions')}`} color="accent" />
                      <Badge label={`${form.submissionCount || 0} ${t('submissions')}`} color="gray" />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <Btn size="sm" variant={form.isActive ? 'ghost' : 'primary'}
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(form); }}
                    style={{ flex: 1 }}>
                    {form.isActive ? t('Deactivate') : t('Activate')}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(form); setFormData({ title: form.title, description: form.description || '' }); setShowEdit(true); }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleDelete(form); }}>
                    <svg width="13" height="13" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </Btn>
                </div>
              </div>
            ))}
          </div>

          {/* Form detail / questions */}
          {selectedForm ? (
            <div className="hr-table-card">
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedForm.title}</div>
                  {selectedForm.description && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>{selectedForm.description}</p>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    <Badge label={selectedForm.isActive ? t('Live') : t('Draft')} color={selectedForm.isActive ? 'green' : 'orange'} />
                    <Badge label={`${selectedForm.questionCount || selectedForm.questions?.length || 0} ${t('questions')}`} color="accent" />
                    <Badge label={`${selectedForm.submissionCount || 0} ${t('submissions')}`} color="slate" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn size="sm" variant="outline" onClick={() => navigate(resolvePath('/hr/submissions'))}>
                    {t('Open Submissions')}
                  </Btn>
                  <Btn size="sm" onClick={() => setShowAddQ(true)}>
                    <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {t('Add Question')}
                  </Btn>
                </div>
              </div>
              <div style={{ padding: '16px 28px 28px' }}>
                {(!selectedForm.questions || selectedForm.questions.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gray-300)', fontSize: 13 }}>
                    {t('No questions yet. Add your first question.')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                    {selectedForm.questions.map((q, i) => (
                      <div key={q.questionID} style={{
                        background: 'var(--gray-50)', borderRadius: 16, padding: '16px 20px',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
                            {FIELD_LABELS[q.fieldType]}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{i + 1}. {q.questionText}</div>
                        </div>
                        <Btn size="sm" variant="danger" onClick={() => handleDeleteQuestion(q)}>
                          <svg width="13" height="13" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </Btn>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hr-soft-empty" style={{ padding: '80px 32px', textAlign: 'center' }}>
              <svg width="44" height="44" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 12px', display: 'block' }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>{t('Select a form to manage its questions')}</p>
            </div>
          )}
        </div>
      )}

      {/* Create form modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('Create New Form')}>
        <Input label={t('Form Title *')} value={formData.title} onChange={e => setFormData(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Q1 2026 Employee Satisfaction" />
        <Textarea label={t('Description (optional)')} value={formData.description} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} placeholder="Brief description of the form..." />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleCreate} style={{ flex: 1 }} disabled={saving}>{saving ? t('Creating...') : t('Create Form')}</Btn>
        </div>
      </Modal>

      {/* Edit form modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={t('Edit Form')}>
        <Input label={t('Form Title *')} value={formData.title} onChange={e => setFormData(d => ({ ...d, title: e.target.value }))} />
        <Textarea label={t('Description')} value={formData.description} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowEdit(false)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleUpdate} style={{ flex: 1 }} disabled={saving}>{saving ? t('Saving...') : t('Save Changes')}</Btn>
        </div>
      </Modal>

      {/* Add question modal */}
      <Modal open={showAddQ} onClose={() => setShowAddQ(false)} title={t('Add Question')}>
        <Textarea label={t('Question Text *')} value={qData.questionText} onChange={e => setQData(d => ({ ...d, questionText: e.target.value }))} placeholder="e.g. How would you rate your work-life balance?" />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{t('Field Type *')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {FIELD_TYPES.map((fieldType) => (
              <button key={fieldType} onClick={() => setQData((d) => ({ ...d, fieldType }))} style={{
                flex: 1, padding: '10px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                border: '2px solid', cursor: 'pointer', transition: 'all .15s',
                borderColor: qData.fieldType === fieldType ? 'var(--red)' : '#EAECF0',
                background: qData.fieldType === fieldType ? 'var(--red-light)' : 'var(--white)',
                color: qData.fieldType === fieldType ? 'var(--red)' : 'var(--gray-500)',
              }}>{t(FIELD_LABELS[fieldType])}</button>
            ))}
          </div>
        </div>
        <Input label={t('Display Order')} type="number" value={qData.order} onChange={e => setQData(d => ({ ...d, order: parseInt(e.target.value) || 0 }))} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowAddQ(false)} style={{ flex: 1 }}>{t('Cancel')}</Btn>
          <Btn onClick={handleAddQuestion} style={{ flex: 1 }} disabled={saving}>{saving ? t('Adding...') : t('Add Question')}</Btn>
        </div>
      </Modal>
    </div>
  );
}
