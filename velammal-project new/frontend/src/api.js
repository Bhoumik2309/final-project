import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Exam Session APIs
export const getExamFormat = (totalMarks, examType) => {
  const url = `/exam/exam-format/${totalMarks}${examType ? `?exam_type=${encodeURIComponent(examType)}` : ''}`
  return api.get(url)
}

export const startSession = (config) => api.post('/exam/start-session', config)

export const uploadPages = (sessionId, files) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  return api.post(`/exam/upload-pages/${sessionId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const completeStudent = (sessionId, data) => {
  const formData = new FormData()
  formData.append('register_number', data.register_number)
  formData.append('marks_obtained', data.marks_obtained)
  formData.append('part_a_total', data.part_a_total || 0)
  formData.append('part_bc_total', data.part_bc_total || 0)
  formData.append('section_marks_json', JSON.stringify(data.section_marks || {}))
  return api.post(`/exam/complete-student/${sessionId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getSession = (sessionId) => api.get(`/exam/session/${sessionId}`)

export const endSession = (sessionId) => api.post(`/exam/end-session/${sessionId}`)

export const listSessions = () => api.get('/exam/sessions')

// Student Excel upload (MongoDB)
export const uploadStudentExcel = (sessionId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/students/upload-excel/${sessionId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getSessionStudents = (sessionId) => api.get(`/students/session/${sessionId}`)

// Results Worksheets APIs
export const listWorksheets = () => api.get('/students/worksheets/list')
export const createWorksheet = (subjectName, subjectCode, totalMarks) =>
  api.post('/students/worksheets/create', { subject_name: subjectName, subject_code: subjectCode, total_marks: totalMarks })
export const restyleAllSheets = () => api.post('/students/restyle-all')

// Result Sheets (new screen)
export const listResultSheets = () => api.get('/results/sheets')
export const getSheetResults = (sheetName) => api.get(`/results/sheets/${encodeURIComponent(sheetName)}/results`)
export const getSheetStats = (sheetName) => api.get(`/results/sheets/${encodeURIComponent(sheetName)}/stats`)

// Results APIs
export const getResults = (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.section) params.append('section', filters.section)
  if (filters.academic_year) params.append('academic_year', filters.academic_year)
  if (filters.subject_code) params.append('subject_code', filters.subject_code)
  return api.get(`/results/?${params.toString()}`)
}

export const getStudentResults = (registerNumber) =>
  api.get(`/results/student/${registerNumber}`)

export const getDashboardStats = (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.section) params.append('section', filters.section)
  if (filters.academic_year) params.append('academic_year', filters.academic_year)
  if (filters.subject_code) params.append('subject_code', filters.subject_code)
  return api.get(`/results/dashboard?${params.toString()}`)
}

// Scanner APIs (for local backend with connected scanner)
export const checkScanner = () => api.get('/scanner/check')
export const listScanners = () => api.get('/scanner/list')
export const scanDocument = (options = {}) => api.post('/scanner/scan', {
  scanner_id: options.scannerId || null,
  color_mode: options.colorMode || 'color',
  dpi: options.dpi || 200
})

export default api
