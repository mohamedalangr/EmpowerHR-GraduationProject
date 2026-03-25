const BASE = 'http://127.0.0.1:8000/api';

export const api = {
  get:    (url)       => fetch(`${BASE}${url}`).then(r => r.json()),
  post:   (url, data) => fetch(`${BASE}${url}`, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  put:    (url, data) => fetch(`${BASE}${url}`, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  delete: (url)       => fetch(`${BASE}${url}`, { method: 'DELETE' }),
};

// Employee
export const getForms        = (employeeID) => api.get(`/feedback/forms/?employee_id=${employeeID}`);
export const getFormDetail   = (formID, employeeID) => api.get(`/feedback/forms/${formID}/?employee_id=${employeeID}`);
export const submitFeedback  = (formID, data) => api.post(`/feedback/forms/${formID}/submit/`, data);

// HR Manager -- Forms
export const hrGetForms      = ()          => api.get('/feedback/hr/forms/');
export const hrCreateForm    = (data)      => api.post('/feedback/hr/forms/', data);
export const hrUpdateForm    = (id, data)  => api.put(`/feedback/hr/forms/${id}/`, data);
export const hrDeleteForm    = (id)        => api.delete(`/feedback/hr/forms/${id}/`);
export const hrActivateForm  = (id)        => api.post(`/feedback/hr/forms/${id}/activate/`, {});
export const hrDeactivateForm= (id)        => api.post(`/feedback/hr/forms/${id}/deactivate/`, {});

// HR Manager -- Questions
export const hrGetQuestions    = (formID)        => api.get(`/feedback/hr/forms/${formID}/questions/`);
export const hrAddQuestion     = (formID, data)  => api.post(`/feedback/hr/forms/${formID}/questions/`, data);
export const hrUpdateQuestion  = (qID, data)     => api.put(`/feedback/hr/questions/${qID}/`, data);
export const hrDeleteQuestion  = (qID)           => api.delete(`/feedback/hr/questions/${qID}/`);

// HR Manager -- Submissions
export const hrGetSubmissions  = (formID) => api.get(`/feedback/hr/submissions/${formID ? `?form_id=${formID}` : ''}`);

// Attrition
export const runPrediction     = (formID)  => api.post('/attrition/run/', formID ? { form_id: formID } : {});
export const getPredictions    = ()        => api.get('/attrition/predictions/latest/');
