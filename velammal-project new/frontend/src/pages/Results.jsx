import { useState, useEffect } from 'react'
import {
  FileText,
  Search,
  Download,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react'
import { getResults } from '../api'

export default function Results() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    section: '',
    branch: '',
    year: '',
    subject_code: '',
  })
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    setLoading(true)
    try {
      const cleanFilters = {}
      if (filters.section) cleanFilters.section = filters.section
      if (filters.branch) cleanFilters.branch = filters.branch
      if (filters.year) cleanFilters.year = filters.year
      if (filters.subject_code) cleanFilters.subject_code = filters.subject_code
      const res = await getResults(cleanFilters)
      setResults(res.data.results || [])
    } catch (err) {
      console.error('Error fetching results:', err)
    }
    setLoading(false)
  }

  const filteredResults = results.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      String(r.RegisterNumber || '').toLowerCase().includes(q) ||
      String(r.StudentName || '').toLowerCase().includes(q) ||
      String(r.SubjectName || '').toLowerCase().includes(q) ||
      String(r.SubjectCode || '').toLowerCase().includes(q)
    )
  })

  const exportCSV = () => {
    if (filteredResults.length === 0) return
    const headers = [
      'RegisterNumber', 'StudentName', 'Email', 'Section', 'Branch', 'Year',
      'SubjectName', 'SubjectCode', 'TotalMarks', 'MarksObtained', 'PassMarks', 'Status', 'ExamDate',
    ]
    const csvRows = [headers.join(',')]
    filteredResults.forEach((r) => {
      const row = headers.map((h) => `"${String(r[h] || '').replace(/"/g, '""')}"`)
      csvRows.push(row.join(','))
    })
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'exam_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Exam Results</h1>
          <p className="text-slate-500 mt-1">View and manage all exam results</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filteredResults.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
            placeholder="Section"
            value={filters.section}
            onChange={(e) => setFilters({ ...filters, section: e.target.value })}
          />
          <input
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
            placeholder="Branch"
            value={filters.branch}
            onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
          />
          <input
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
            placeholder="Year"
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          />
          <input
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
            placeholder="Subject Code"
            value={filters.subject_code}
            onChange={(e) => setFilters({ ...filters, subject_code: e.target.value })}
          />
          <button
            onClick={fetchResults}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setFilters({ section: '', branch: '', year: '', subject_code: '' })
              setTimeout(fetchResults, 100)
            }}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Clear
          </button>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search by name, reg no, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">
            {filteredResults.length} result(s) found
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    'Reg No', 'Name', 'Email', 'Branch', 'Section', 'Year',
                    'Subject', 'Code', 'Marks', 'Total', 'Status', 'Date',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{r.RegisterNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{r.StudentName}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.Email}</td>
                    <td className="px-4 py-3 text-slate-600">{r.Branch}</td>
                    <td className="px-4 py-3 text-slate-600">{r.Section}</td>
                    <td className="px-4 py-3 text-slate-600">{r.Year}</td>
                    <td className="px-4 py-3 text-slate-600">{r.SubjectName}</td>
                    <td className="px-4 py-3 text-slate-500">{r.SubjectCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{r.MarksObtained}</td>
                    <td className="px-4 py-3 text-slate-500">{r.TotalMarks}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          String(r.Status).toUpperCase() === 'PASS'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {String(r.Status).toUpperCase() === 'PASS' ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )}
                        {r.Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.ExamDate}</td>
                  </tr>
                ))}
                {filteredResults.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <FileText className="mx-auto text-slate-300 mb-3" size={36} />
                      <p className="text-slate-400">No results found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
