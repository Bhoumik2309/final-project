import { useState, useEffect } from 'react'
import { FolderOpen, Clock, Users, CheckCircle2, AlertCircle } from 'lucide-react'
import { listSessions } from '../api'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const res = await listSessions()
      setSessions(res.data.sessions || [])
    } catch (err) {
      console.error('Error fetching sessions:', err)
    }
    setLoading(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Scanning Sessions</h1>
          <p className="text-slate-500 mt-1">History of all exam scanning sessions</p>
        </div>
        <button
          onClick={fetchSessions}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FolderOpen className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-600">No Sessions Yet</h3>
          <p className="text-slate-400 mt-2">Start a scanning session from the "Scan Exam" page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {session.status === 'completed' ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={18} className="text-amber-500" />
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      session.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {session.status === 'completed' ? 'Completed' : 'Active'}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {session.session_id.slice(0, 8)}...
                </span>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mb-1">
                {session.config.subject_name}
              </h3>
              <p className="text-sm text-slate-500 mb-4">{session.config.subject_code}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-slate-500">Branch</p>
                  <p className="font-semibold text-slate-700">{session.config.branch}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-slate-500">Section</p>
                  <p className="font-semibold text-slate-700">{session.config.section}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-slate-500">Year</p>
                  <p className="font-semibold text-slate-700">{session.config.year}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-slate-500">Students</p>
                  <p className="font-semibold text-slate-700">{session.students_processed}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>{new Date(session.created_at).toLocaleString()}</span>
                </div>
                <span>
                  Total: {session.config.total_marks} | Pass: {session.config.pass_marks}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
