const BASE = '/api';

const parseJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const body = await parseJson(res);
    const message = body && body.detail ? body.detail : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return parseJson(res);
};

export const api = {
  get:    (url)       => fetch(`${BASE}${url}`).then(handleResponse),
  post:   (url, data) => fetch(`${BASE}${url}`, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
  put:    (url, data) => fetch(`${BASE}${url}`, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
  patch:  (url, data) => fetch(`${BASE}${url}`, { method: 'PATCH',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
  delete: (url)       => fetch(`${BASE}${url}`, { method: 'DELETE' }).then(handleResponse),
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

// Recruitment (CV ranking + Job Management)
export const getJobs           = ()        => api.get('/recruitment/jobs/');
export const createJob         = (data)    => api.post('/recruitment/jobs/', data);
export const updateJob         = (id, data) => api.put(`/recruitment/jobs/${id}/`, data);
export const deleteJob         = (id)      => api.delete(`/recruitment/jobs/${id}/`);
export const updateJobWeights  = (id, data) => api.patch(`/recruitment/jobs/${id}/weights/`, data);
export const getJobSubmissions = (jobId)  => api.get(`/recruitment/jobs/${jobId}/submissions/`);
export const deleteSubmission  = (id)     => api.delete(`/recruitment/submissions/${id}/`);
export const submitResume      = (formData) => {
  return fetch(`${BASE}/recruitment/submit/`, {
    method: 'POST',
    body: formData,
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.detail || 'Upload failed'); }));
};

export const submitResumeAllJobs = (formData) => {
  // Same endpoint, but we'll display results across all jobs
  return submitResume(formData);
};


// Attrition
export const runPrediction     = (formID)  => api.post('/attrition/run/', formID ? { form_id: formID } : {});
export const getPredictions    = ()        => api.get('/attrition/predictions/latest/');
