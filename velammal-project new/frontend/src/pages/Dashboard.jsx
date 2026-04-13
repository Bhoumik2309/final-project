import { useState, useEffect } from 'react'
import {
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  BarChart3,
  ArrowDown,
  ArrowUp,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { getDashboardStats, getResults } from '../api'

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6']

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [results, setResults] = useState([])
  const [filters, setFilters] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, resultsRes] = await Promise.all([
        getDashboardStats(filters),
        getResults(filters),
      ])
      setStats(statsRes.data.stats)
      setResults(resultsRes.data.results)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    }
    setLoading(false)
  }

  const statCards = stats
    ? [
        {
          label: 'Total Students',
          value: stats.total_students,
          icon: Users,
          color: 'bg-indigo-500',
          textColor: 'text-indigo-600',
          bg: 'bg-indigo-50',
        },
        {
          label: 'Passed',
          value: stats.total_passed,
          icon: CheckCircle2,
          color: 'bg-emerald-500',
          textColor: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        {
          label: 'Failed',
          value: stats.total_failed,
          icon: XCircle,
          color: 'bg-rose-500',
          textColor: 'text-rose-600',
          bg: 'bg-rose-50',
        },
        {
          label: 'Pass %',
          value: `${stats.pass_percentage}%`,
          icon: TrendingUp,
          color: 'bg-amber-500',
          textColor: 'text-amber-600',
          bg: 'bg-amber-50',
        },
        {
          label: 'Average',
          value: stats.average_marks,
          icon: BarChart3,
          color: 'bg-blue-500',
          textColor: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Highest',
          value: stats.highest_marks,
          icon: Award,
          color: 'bg-purple-500',
          textColor: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ]
    : []

  const pieData = stats
    ? [
        { name: 'Passed', value: stats.total_passed },
        { name: 'Failed', value: stats.total_failed },
      ]
    : []

  const sectionData = stats
    ? Object.entries(stats.section_wise || {}).map(([key, val]) => ({
        name: key,
        passed: val.passed,
        failed: val.failed,
        avg: val.avg_marks,
      }))
    : []

  const yearData = stats
    ? Object.entries(stats.year_wise || {}).map(([key, val]) => ({
        name: key,
        passed: val.passed,
        failed: val.failed,
        avg: val.avg_marks,
      }))
    : []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of exam results and statistics</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
        <input
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Section"
          value={filters.section || ''}
          onChange={(e) => setFilters({ ...filters, section: e.target.value || undefined })}
        />
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={filters.academic_year || ''}
          onChange={(e) => setFilters({ ...filters, academic_year: e.target.value || undefined })}
        >
          <option value="">All Years</option>
          <option value="1st Year">1st Year</option>
          <option value="2nd Year">2nd Year</option>
          <option value="3rd Year">3rd Year</option>
          <option value="4th Year">4th Year</option>
        </select>
        <input
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Subject Code"
          value={filters.subject_code || ''}
          onChange={(e) => setFilters({ ...filters, subject_code: e.target.value || undefined })}
        />
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={() => setFilters({})}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          Clear
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      ) : !stats || stats.total_students === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <BarChart3 className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-600">No Data Available</h3>
          <p className="text-slate-400 mt-2">
            Start scanning exam sheets to see dashboard statistics.
          </p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                  <card.icon size={20} className={card.textColor} />
                </div>
                <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                <p className="text-xs text-slate-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Pass/Fail Pie */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Pass vs Fail</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f43f5e" />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Section-wise Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Section-wise Results</h3>
              {sectionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sectionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="passed" fill="#10b981" name="Passed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" fill="#f43f5e" name="Failed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-sm text-center py-16">No section data</p>
              )}
            </div>
          </div>

          {/* Year-wise Chart */}
          {yearData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Year-wise Average Marks</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#6366f1" name="Avg Marks" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Results Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Recent Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Reg No', 'Name', 'Year', 'Section', 'Subject', 'Marks', 'Total', 'Status'].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.slice(0, 20).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{r.RegisterNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{r.StudentName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.AcademicYear}</td>
                      <td className="px-4 py-3 text-slate-600">{r.Section}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.SubjectName} ({r.SubjectCode})
                      </td>
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
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No results found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
