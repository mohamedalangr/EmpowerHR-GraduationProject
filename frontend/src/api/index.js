
const BASE = 'http://127.0.0.1:8000/api';

const authHeaders = () => {
  const token = localStorage.getItem('access');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const clearSession = () => {
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
  localStorage.removeItem('user');
};

const parseJsonSafe = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const refreshAccessToken = async () => {
  const refresh = localStorage.getItem('refresh');
  if (!refresh) return false;

  try {
    const response = await fetch(`${BASE}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    const data = await parseJsonSafe(response);
    if (!response.ok || !data?.access) {
      clearSession();
      return false;
    }

    localStorage.setItem('access', data.access);
    if (data.refresh) localStorage.setItem('refresh', data.refresh);
    return true;
  } catch {
    clearSession();
    return false;
  }
};

const request = async (url, options = {}, canRetry = true) => {
  const response = await fetch(`${BASE}${url}`, options);

  if (response.status === 401 && canRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retriedOptions = {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...authHeaders(),
        },
      };
      return request(url, retriedOptions, false);
    }
  }

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const message = data?.detail || data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const api = {
  get:    (url)       => request(url, { headers: authHeaders() }),
  post:   (url, data) => request(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  put:    (url, data) => request(url, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
  delete: (url)       => request(url, { method: 'DELETE', headers: authHeaders() }),
  postForm: (url, formData) => request(url, {
    method: 'POST',
    headers: localStorage.getItem('access') ? { Authorization: `Bearer ${localStorage.getItem('access')}` } : {},
    body: formData,
  }),
};

// Employee
export const getForms        = async (employeeID) => toList(await api.get(`/feedback/forms/?employee_id=${employeeID}`));
export const getFormDetail   = (formID, employeeID) => api.get(`/feedback/forms/${formID}/?employee_id=${employeeID}`);
export const submitFeedback  = (formID, data) => api.post(`/feedback/forms/${formID}/submit/`, data);
//cd export const changePassword = (data) => api.post('/auth/change-password/', data);

// HR Manager -- Forms
export const hrGetForms      = async ()          => toList(await api.get('/feedback/hr/forms/'));
export const hrCreateForm    = (data)      => api.post('/feedback/hr/forms/', data);
export const hrUpdateForm    = (id, data)  => api.put(`/feedback/hr/forms/${id}/`, data);
export const hrDeleteForm    = (id)        => api.delete(`/feedback/hr/forms/${id}/`);
export const hrActivateForm  = (id)        => api.post(`/feedback/hr/forms/${id}/activate/`, {});
export const hrDeactivateForm= (id)        => api.post(`/feedback/hr/forms/${id}/deactivate/`, {});

// HR Manager -- Questions
export const hrGetQuestions    = async (formID)        => toList(await api.get(`/feedback/hr/forms/${formID}/questions/`));
export const hrAddQuestion     = (formID, data)  => api.post(`/feedback/hr/forms/${formID}/questions/`, data);
export const hrUpdateQuestion  = (qID, data)     => api.put(`/feedback/hr/questions/${qID}/`, data);
export const hrDeleteQuestion  = (qID)           => api.delete(`/feedback/hr/questions/${qID}/`);

// HR Manager -- Submissions
export const hrGetSubmissions  = async (formID) => toList(await api.get(`/feedback/hr/submissions/${formID ? `?form_id=${formID}` : ''}`));

// Recruitment (Jobs & CV Ranking)
export const getJobs           = async ()        => toList(await api.get('/recruitment/jobs/'));
export const createJob         = (data)    => api.post('/recruitment/jobs/', data);
export const updateJob         = (id, data)=> api.put(`/recruitment/jobs/${id}/`, data);
export const updateJobWeights  = (id, data)=> api.put(`/recruitment/jobs/${id}/weights/`, data);
export const getJobSubmissions = async (jobId)   => toList(await api.get(`/recruitment/jobs/${jobId}/submissions/`));
export const deleteSubmission  = (id)      => api.delete(`/recruitment/submissions/${id}/`);
export const submitResume      = (formData)    => api.postForm('/recruitment/submit/', formData);
export const getJobRanking     = async (jobId)   => toList(await api.get(`/recruitment/jobs/${jobId}/ranking/`));
export const uploadAndRankCVs  = async (jobId, formData) => toList(await api.postForm(`/recruitment/jobs/${jobId}/ranking/`, formData));

// Attrition
export const runPrediction     = (formID)  => api.post('/attrition/run/', formID ? { form_id: formID } : {});
export const getPredictions    = async ()        => toList(await api.get('/attrition/predictions/latest/'));

// Auth
export const loginUser           = (data) => api.post('/auth/login/', data);
export const logoutUser          = (refresh) => api.post('/auth/logout/', { refresh });
export const refreshToken        = (refresh) => api.post('/auth/token/refresh/', { refresh });
export const getMe               = () => api.get('/auth/me/');
export const registerCandidate   = (data) => api.post('/auth/candidate/register/', data);
export const changePassword      = (data) => api.post('/auth/change-password/', data);