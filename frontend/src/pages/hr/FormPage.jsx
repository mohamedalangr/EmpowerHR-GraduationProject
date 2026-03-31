import { useState, useEffect } from 'react';
import { hrGetForms, hrCreateForm, hrUpdateForm, hrDeleteForm, hrActivateForm, hrDeactivateForm, hrAddQuestion, hrDeleteQuestion } from '../../api/index.js';
import { Spinner, Modal, Input, Textarea, Btn, Badge, useToast } from '../../components/shared/index.jsx';

const FIELD_TYPES = ['score_1_4', 'boolean', 'decimal'];
const FIELD_LABELS = { score_1_4: 'Score 1-4', boolean: 'Yes / No', decimal: 'Decimal' };

export function HRFormsPage() {
  const toast         = useToast();
  const [forms, setForms]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedForm, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showAddQ, setShowAddQ]     = useState(false);
  const [formData, setFormData]     = useState({ title: '', description: '' });
  const [qData, setQData]           = useState({ questionText: '', fieldType: 'score_1_4', order: 0 });
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await hrGetForms();
      setForms(Array.isArray(data) ? data : []);
    } catch { toast('Failed to load forms', 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!formData.title.trim()) { toast('Title is required', 'error'); return; }
    setSaving(true);
    const res = await hrCreateForm(formData);
    setSaving(false);
    if (res.formID) { toast('Form created'); setShowCreate(false); setFormData({ title: '', description: '' }); load(); }
    else toast('Failed to create form', 'error');
  };

  const handleUpdate = async () => {
    if (!formData.title.trim()) { toast('Title is required', 'error'); return; }
    setSaving(true);
    const res = await hrUpdateForm(selectedForm.formID, formData);
    setSaving(false);
    if (res.formID) { toast('Form updated'); setShowEdit(false); load(); }
    else toast('Failed to update form', 'error');
  };

  const handleDelete = async (form) => {
    if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    await hrDeleteForm(form.formID);
    toast('Form deleted');
    if (selectedForm?.formID === form.formID) setSelected(null);
    load();
  };

  const handleToggleActive = async (form) => {
    if (form.isActive) {
      await hrDeactivateForm(form.formID);
      toast(`"${form.title}" deactivated`);
    } else {
      await hrActivateForm(form.formID);
      toast(`"${form.title}" is now active`);
    }
    load();
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
      const updated = await hrGetForms();
      setForms(Array.isArray(updated) ? updated : []);
      const fresh = updated.find(f => f.formID === selectedForm.formID);
      if (fresh) setSelected(fresh);
    } else toast('Failed to add question', 'error');
  };

  const handleDeleteQuestion = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    await hrDeleteQuestion(q.questionID);
    toast('Question deleted');
    const updated = await hrGetForms();
    setForms(Array.isArray(updated) ? updated : []);
    const fresh = updated.find(f => f.formID === selectedForm.formID);
    if (fresh) setSelected(fresh);
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Feedback Forms</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>Create, manage and activate employee feedback forms</p>
        </div>
        <Btn onClick={() => { setFormData({ title: '', description: '' }); setShowCreate(true); }}>
          <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Form
        </Btn>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>

          {/* Forms list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {forms.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)' }}>
                <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>No forms yet. Create one to get started.</p>
              </div>
            )}
            {forms.map(form => (
              <div key={form.formID}
                onClick={() => setSelected(form)}
                style={{
                  background: 'var(--white)', borderRadius: 20, padding: '20px 22px',
                  border: `2px solid ${selectedForm?.formID === form.formID ? 'var(--red)' : '#EAECF0'}`,
                  cursor: 'pointer', transition: 'all .2s',
                  boxShadow: selectedForm?.formID === form.formID ? '0 0 0 4px rgba(232,50,26,.08)' : 'none',
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.title}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={form.isActive ? 'Active' : 'Inactive'} color={form.isActive ? 'green' : 'gray'} />
                      <Badge label={`${form.questionCount || 0} questions`} color="accent" />
                      <Badge label={`${form.submissionCount || 0} submissions`} color="gray" />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <Btn size="sm" variant={form.isActive ? 'ghost' : 'primary'}
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(form); }}
                    style={{ flex: 1 }}>
                    {form.isActive ? 'Deactivate' : 'Activate'}
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
            <div style={{ background: 'var(--white)', borderRadius: 24, border: '1px solid #EAECF0', overflow: 'hidden' }}>
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedForm.title}</div>
                  {selectedForm.description && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>{selectedForm.description}</p>}
                </div>
                <Btn size="sm" onClick={() => setShowAddQ(true)}>
                  <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Question
                </Btn>
              </div>
              <div style={{ padding: '16px 28px 28px' }}>
                {(!selectedForm.questions || selectedForm.questions.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gray-300)', fontSize: 13 }}>
                    No questions yet. Add your first question.
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
            <div style={{ background: 'var(--white)', borderRadius: 24, border: '2px dashed var(--gray-300)', padding: '80px 32px', textAlign: 'center' }}>
              <svg width="44" height="44" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 12px', display: 'block' }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <p style={{ fontSize: 13, color: 'var(--gray-300)', fontWeight: 500 }}>Select a form to manage its questions</p>
            </div>
          )}
        </div>
      )}

      {/* Create form modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Form">
        <Input label="Form Title *" value={formData.title} onChange={e => setFormData(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Q1 2026 Employee Satisfaction" />
        <Textarea label="Description (optional)" value={formData.description} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} placeholder="Brief description of the form..." />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleCreate} style={{ flex: 1 }} disabled={saving}>{saving ? 'Creating...' : 'Create Form'}</Btn>
        </div>
      </Modal>

      {/* Edit form modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Form">
        <Input label="Form Title *" value={formData.title} onChange={e => setFormData(d => ({ ...d, title: e.target.value }))} />
        <Textarea label="Description" value={formData.description} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowEdit(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleUpdate} style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
        </div>
      </Modal>

      {/* Add question modal */}
      <Modal open={showAddQ} onClose={() => setShowAddQ(false)} title="Add Question">
        <Textarea label="Question Text *" value={qData.questionText} onChange={e => setQData(d => ({ ...d, questionText: e.target.value }))} placeholder="e.g. How would you rate your work-life balance?" />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>Field Type *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {FIELD_TYPES.map(t => (
              <button key={t} onClick={() => setQData(d => ({ ...d, fieldType: t }))} style={{
                flex: 1, padding: '10px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                border: '2px solid', cursor: 'pointer', transition: 'all .15s',
                borderColor: qData.fieldType === t ? 'var(--red)' : '#EAECF0',
                background: qData.fieldType === t ? 'var(--red-light)' : 'var(--white)',
                color: qData.fieldType === t ? 'var(--red)' : 'var(--gray-500)',
              }}>{FIELD_LABELS[t]}</button>
            ))}
          </div>
        </div>
        <Input label="Display Order" type="number" value={qData.order} onChange={e => setQData(d => ({ ...d, order: parseInt(e.target.value) || 0 }))} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowAddQ(false)} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={handleAddQuestion} style={{ flex: 1 }} disabled={saving}>{saving ? 'Adding...' : 'Add Question'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
