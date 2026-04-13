import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  CheckCircle2,
  ArrowLeft,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { listWorksheets, createWorksheet, restyleAllSheets } from '../api'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function ManageSheets() {
  const [loading, setLoading] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [subjectCode, setSubjectCode] = useState('')
  const [totalMarks, setTotalMarks] = useState(60)
  const [worksheets, setWorksheets] = useState([])
  const [connectionStatus, setConnectionStatus] = useState(null)

  const checkConnection = async () => {
    try {
      const res = await axios.get(`${API_BASE}/health`)
      setConnectionStatus(res.data.connections)
    } catch {
      setConnectionStatus({ results_db: false, error: true })
    }
  }

  useEffect(() => {
    checkConnection()
    listWorksheets().then((res) => setWorksheets(res.data.worksheets || [])).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!subjectName.trim() || !subjectCode.trim()) { toast.error('Enter subject name and code'); return }
    setLoading(true)
    try {
      const res = await createWorksheet(subjectName.trim(), subjectCode.trim(), totalMarks)
      if (res.data.success) {
        toast.success(res.data.message)
        setWorksheets((prev) => [...prev, res.data])
        setSubjectName(''); setSubjectCode('')
      } else { toast.error(res.data.message) }
    } catch { toast.error('Failed to create') }
    setLoading(false)
  }

  const handleRestyle = async () => {
    setLoading(true)
    try {
      const res = await restyleAllSheets()
      const errs = res.data.errors || []
      if (errs.length > 0) {
        toast.error(`Styled ${res.data.styled_sheets} sheet(s) with ${errs.length} error(s)`)
        console.error('Restyle errors:', errs)
      } else { toast.success(`Styled ${res.data.styled_sheets} sheet(s)`) }
    } catch { toast.error('Failed to restyle') }
    setLoading(false)
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manage Result Sheets</h1>
            <p className="text-slate-500 text-sm mt-1">Create result worksheets and apply styling.</p>
          </div>
          <div className="flex items-center gap-3">
            {connectionStatus && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                connectionStatus.results_db 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {connectionStatus.results_db ? (
                  <><CheckCircle2 size={16} /> Results DB connected</>
                ) : (
                  <><AlertCircle size={16} /> Results DB not connected</>
                )}
                <button onClick={checkConnection} className="ml-1 hover:opacity-70">
                  <RefreshCw size={14} />
                </button>
              </div>
            )}
            <button onClick={handleRestyle} disabled={loading || !connectionStatus?.results_db}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50">
              {loading ? 'Styling...' : '🎨 Restyle All Sheets'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Sheet */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Create Result Sheet</h2>
              <p className="text-sm text-slate-500">New tab in the results Google Sheet.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject Name *</label>
              <input className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Data Structures" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject Code *</label>
              <input className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. CS301" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks *</label>
              <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={totalMarks} onChange={(e) => setTotalMarks(parseInt(e.target.value))}>
                <option value={60}>60 — Internal Assessment</option>
                <option value={100}>100 — Model Exam</option>
              </select>
            </div>

            {subjectCode.trim() && subjectName.trim() && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs text-emerald-600">Sheet name:</p>
                <p className="text-sm font-semibold text-emerald-800">{subjectCode.trim()} - {subjectName.trim()} ({totalMarks}m)</p>
              </div>
            )}

            <button onClick={handleCreate} disabled={loading || !subjectName.trim() || !subjectCode.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Create Result Sheet
            </button>
          </div>
        </div>

        {/* Existing Sheets */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Existing Result Sheets</h2>
          {worksheets.length > 0 ? (
            <div className="space-y-2">
              {worksheets.map((ws) => (
                <div key={ws.sheet_name} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{ws.sheet_name}</p>
                    {ws.subject_name && <p className="text-xs text-slate-500">{ws.subject_code} · {ws.exam_type}</p>}
                  </div>
                  {ws.total_marks > 0 && (
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{ws.total_marks}m</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No result sheets yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
