import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  ClipboardList, ChevronDown, ChevronUp, Users, CheckCircle2,
  XCircle, BarChart2, RefreshCw, ScanLine, Upload, Loader2,
  TrendingUp, Award, AlertCircle, FileText,
} from 'lucide-react'
import {
  listResultSheets, getSheetResults, getSheetStats,
  uploadStudentExcel, startSession, uploadPages, completeStudent, endSession,
} from '../api'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function ResultSheets() {
  const [sheets, setSheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [sheetData, setSheetData] = useState({}) // { sheetName: { stats, results } }
  const [loadingSheet, setLoadingSheet] = useState(null)

  // Re-scan modal state
  const [scanModal, setScanModal] = useState(null) // { sheetName, sheet }
  const [scanStep, setScanStep] = useState('upload') // upload | scanning | result
  const [sessionId, setSessionId] = useState(null)
  const [studentFile, setStudentFile] = useState(null)
  const [scanFiles, setScanFiles] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const [scannerChecking, setScannerChecking] = useState(false)
  const [scannerAvailable, setScannerAvailable] = useState(false)
  const fileInputRef = useRef()
  const studentFileRef = useRef()

  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron

  useEffect(() => { loadSheets() }, [])

  const loadSheets = async () => {
    setLoading(true)
    try {
      const res = await listResultSheets()
      setSheets(res.data.sheets || [])
    } catch {
      toast.error('Failed to load result sheets')
    }
    setLoading(false)
  }

  const toggleExpand = async (sheetName) => {
    if (expanded === sheetName) { setExpanded(null); return }
    setExpanded(sheetName)
    if (sheetData[sheetName]) return
    setLoadingSheet(sheetName)
    try {
      const [statsRes, resultsRes] = await Promise.all([
        getSheetStats(sheetName),
        getSheetResults(sheetName),
      ])
      setSheetData(prev => ({
        ...prev,
        [sheetName]: { stats: statsRes.data.stats, results: resultsRes.data.results || [] }
      }))
    } catch {
      toast.error('Failed to load sheet data')
    }
    setLoadingSheet(null)
  }

  const refreshSheet = async (sheetName) => {
    setLoadingSheet(sheetName)
    try {
      const [statsRes, resultsRes] = await Promise.all([
        getSheetStats(sheetName),
        getSheetResults(sheetName),
      ])
      setSheetData(prev => ({
        ...prev,
        [sheetName]: { stats: statsRes.data.stats, results: resultsRes.data.results || [] }
      }))
      toast.success('Refreshed')
    } catch {
      toast.error('Refresh failed')
    }
    setLoadingSheet(null)
  }

  // ── Re-scan missing students ──
  const openScanModal = (sheet) => {
    setScanModal(sheet)
    setScanStep('upload')
    setSessionId(null)
    setStudentFile(null)
    setScanFiles([])
    setOcrResult(null)
  }

  const startReScanSession = async () => {
    if (!scanModal) return
    setIsScanning(true)
    try {
      const config = {
        section: scanModal.section || '',
        branch: scanModal.branch || '',
        year: '',
        academic_year: scanModal.academic_year || '',
        subject_name: scanModal.subject_name || '',
        subject_code: scanModal.subject_code || '',
        total_marks: scanModal.total_marks || 60,
        pass_marks: scanModal.pass_marks || 24,
        result_sheet: scanModal.sheet_name,
      }
      const res = await startSession(config)
      const sid = res.data.session_id
      setSessionId(sid)

      if (studentFile) {
        await uploadStudentExcel(sid, studentFile)
        toast.success('Student list uploaded')
      }
      setScanStep('scanning')
    } catch (e) {
      toast.error('Failed to start session')
    }
    setIsScanning(false)
  }

  const handleScanFileAdd = (e) => {
    const files = Array.from(e.target.files)
    setScanFiles(prev => [...prev, ...files])
  }

  const handleCheckScanner = async () => {
    setScannerChecking(true)
    try {
      if (isElectron) {
        const result = await window.electronAPI.scanner.check()
        setScannerAvailable(result.available)
        if (result.available) toast.success(`Found ${result.scanners.length} scanner(s)!`)
        else toast.info('No scanner detected')
      }
    } catch { toast.error('Scanner check failed') }
    setScannerChecking(false)
  }

  const handleScanDocument = async () => {
    setIsScanning(true)
    try {
      if (isElectron) {
        const result = await window.electronAPI.scanner.scan({})
        if (result.success && result.filePath) {
          const fileData = await window.electronAPI.scanner.getFile(result.filePath)
          if (fileData.success) {
            const bytes = atob(fileData.data)
            const ab = new ArrayBuffer(bytes.length)
            const ia = new Uint8Array(ab)
            for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i)
            const blob = new Blob([ab], { type: 'image/png' })
            const file = new File([blob], `scan_${Date.now()}.png`, { type: 'image/png' })
            setScanFiles(prev => [...prev, file])
            toast.success('Page scanned!')
          }
        } else toast.error(result.error || 'Scan failed')
      }
    } catch { toast.error('Scan failed') }
    setIsScanning(false)
  }

  const handleProcessScans = async () => {
    if (!sessionId || scanFiles.length === 0) return
    setIsScanning(true)
    try {
      const res = await uploadPages(sessionId, scanFiles)
      setOcrResult(res.data.ocr_result)
      setScanStep('result')
    } catch { toast.error('OCR processing failed') }
    setIsScanning(false)
  }

  const handleSaveResult = async () => {
    if (!ocrResult || !sessionId) return
    try {
      await completeStudent(sessionId, {
        register_number: ocrResult.registration_number || 'UNKNOWN',
        marks_obtained: ocrResult.grand_total || ocrResult.marks_obtained || 0,
        part_a_total: ocrResult.part_a_total || 0,
        part_bc_total: ocrResult.part_bc_total || 0,
        section_marks: ocrResult,
      })
      await endSession(sessionId)
      toast.success('Result saved to sheet!')
      setScanModal(null)
      // Refresh the sheet data
      if (scanModal) refreshSheet(scanModal.sheet_name)
    } catch { toast.error('Failed to save result') }
  }

  const handleScanAnother = () => {
    setScanFiles([])
    setOcrResult(null)
    setScanStep('scanning')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-orange-500" size={36} />
    </div>
  )

  return (
    <div className="p-6" style={{ background: '#FFF8F0', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#E87722' }}>
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>Result Sheets</h1>
            <p className="text-sm text-slate-500">View all created sheets, analysis & scan missing students</p>
          </div>
        </div>
        <button onClick={loadSheets} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-orange-50"
          style={{ borderColor: '#E87722', color: '#E87722' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {sheets.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-orange-100">
          <ClipboardList size={48} className="mx-auto mb-4 text-orange-200" />
          <p className="text-slate-500 text-lg">No result sheets yet</p>
          <p className="text-slate-400 text-sm mt-1">Sheets are auto-created when you start a Scan Exam session</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sheets.map((sheet) => {
            const isOpen = expanded === sheet.sheet_name
            const data = sheetData[sheet.sheet_name]
            const stats = data?.stats
            const results = data?.results || []
            const isLoadingThis = loadingSheet === sheet.sheet_name

            return (
              <div key={sheet.sheet_name} className="bg-white rounded-2xl border overflow-hidden shadow-sm"
                style={{ borderColor: isOpen ? '#E87722' : '#e5e7eb' }}>
                {/* Sheet Header Row */}
                <div className="p-4 cursor-pointer hover:bg-orange-50 transition-colors" onClick={() => toggleExpand(sheet.sheet_name)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#FFF0E0' }}>
                        <FileText size={18} style={{ color: '#E87722' }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 truncate">{sheet.sheet_name}</h3>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {sheet.section && <span className="text-xs text-slate-500">Section: <b>{sheet.section}</b></span>}
                          {sheet.academic_year && <span className="text-xs text-slate-500">Year: <b>{sheet.academic_year}</b></span>}
                          {sheet.branch && <span className="text-xs text-slate-500">Dept: <b>{sheet.branch}</b></span>}
                          {sheet.total_marks > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: '#FFF0E0', color: '#E87722' }}>{sheet.total_marks} marks</span>}
                          {sheet.exam_type && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{sheet.exam_type}</span>}
                          {sheet.created_at && <span className="text-xs text-slate-400">{sheet.created_at}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); openScanModal(sheet) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                        style={{ background: '#E87722' }}>
                        <ScanLine size={13} /> Scan Missing
                      </button>
                      {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isOpen && (
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: '#FDE8CC' }}>
                    {isLoadingThis ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-orange-400" size={24} />
                      </div>
                    ) : stats ? (
                      <>
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                          {[
                            { label: 'Total Students', value: stats.total, icon: Users, color: '#8B1A1A' },
                            { label: 'Passed', value: stats.passed, icon: CheckCircle2, color: '#16a34a' },
                            { label: 'Failed', value: stats.failed, icon: XCircle, color: '#dc2626' },
                            { label: 'Pass %', value: `${stats.pass_pct}%`, icon: TrendingUp, color: '#E87722' },
                            { label: 'Average', value: stats.avg, icon: BarChart2, color: '#7c3aed' },
                            { label: 'Highest', value: stats.highest, icon: Award, color: '#0891b2' },
                            { label: 'Lowest', value: stats.lowest, icon: AlertCircle, color: '#d97706' },
                          ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="bg-white rounded-xl p-3 border text-center" style={{ borderColor: '#f0e0d0' }}>
                              <Icon size={16} className="mx-auto mb-1" style={{ color }} />
                              <div className="text-lg font-bold" style={{ color }}>{value}</div>
                              <div className="text-xs text-slate-500">{label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Pass/Fail bar */}
                        {stats.total > 0 && (
                          <div className="mb-4">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>Pass Rate</span>
                              <span>{stats.passed}/{stats.total}</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-red-100 overflow-hidden">
                              <div className="h-full rounded-full bg-green-500 transition-all"
                                style={{ width: `${stats.pass_pct}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Refresh + results count */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-slate-700">{results.length} students recorded</span>
                          <button onClick={(e) => { e.stopPropagation(); refreshSheet(sheet.sheet_name) }}
                            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800">
                            <RefreshCw size={12} /> Refresh
                          </button>
                        </div>

                        {/* Results Table */}
                        {results.length > 0 && (
                          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#f0e0d0' }}>
                            <table className="w-full text-xs">
                              <thead style={{ background: '#8B1A1A' }}>
                                <tr>
                                  {['S.No', 'Reg No', 'Name', 'Section', 'Part A', 'Part B&C', 'Total', 'Status'].map(h => (
                                    <th key={h} className="px-3 py-2 text-left font-medium text-white">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {results.map((r, i) => {
                                  const status = String(r['Status'] || r['status'] || '').toUpperCase()
                                  const isPass = status === 'PASS'
                                  const grandKey = Object.keys(r).find(k => k.startsWith('Grand Total'))
                                  const partAKey = Object.keys(r).find(k => k.startsWith('Part A'))
                                  const partBCKey = Object.keys(r).find(k => k.startsWith('Part B'))
                                  return (
                                    <tr key={i} style={{ background: isPass ? '#f0fdf4' : '#fff5f5' }}>
                                      <td className="px-3 py-2 text-slate-500">{r['S.No'] || i + 1}</td>
                                      <td className="px-3 py-2 font-mono font-medium text-slate-800">{r['Register Number'] || r['RegisterNumber']}</td>
                                      <td className="px-3 py-2 text-slate-700">{r['Student Name'] || r['StudentName']}</td>
                                      <td className="px-3 py-2 text-slate-600">{r['Section']}</td>
                                      <td className="px-3 py-2 text-center">{partAKey ? r[partAKey] : r['PartATotal'] || '-'}</td>
                                      <td className="px-3 py-2 text-center">{partBCKey ? r[partBCKey] : r['PartBCTotal'] || '-'}</td>
                                      <td className="px-3 py-2 text-center font-bold">{grandKey ? r[grandKey] : r['MarksObtained'] || '-'}</td>
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          {status}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-sm">
                        Click to load sheet data...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Re-Scan Modal ── */}
      {scanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#f0e0d0' }}>
              <div>
                <h2 className="font-bold text-slate-800">Scan Missing Students</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{scanModal.sheet_name}</p>
              </div>
              <button onClick={() => setScanModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
            </div>

            <div className="p-5">
              {/* Step: Upload student list */}
              {scanStep === 'upload' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Optionally upload the student list Excel to match names with reg numbers.</p>
                  <div onClick={() => studentFileRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-orange-50 transition-colors"
                    style={{ borderColor: '#E87722' }}>
                    <Upload size={24} className="mx-auto mb-2" style={{ color: '#E87722' }} />
                    <p className="text-sm text-slate-600">{studentFile ? studentFile.name : 'Click to upload student Excel (optional)'}</p>
                    <p className="text-xs text-slate-400 mt-1">.xlsx / .xls / .csv</p>
                    <input ref={studentFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                      onChange={(e) => setStudentFile(e.target.files[0])} />
                  </div>
                  <button onClick={startReScanSession} disabled={isScanning}
                    className="w-full py-3 rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: '#E87722' }}>
                    {isScanning ? <><Loader2 size={16} className="animate-spin" /> Starting...</> : 'Start Scanning Session'}
                  </button>
                </div>
              )}

              {/* Step: Scanning */}
              {scanStep === 'scanning' && (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600 bg-orange-50 p-3 rounded-lg">
                    Session active. Upload or scan the student's answer sheet.
                  </div>

                  {/* File upload */}
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:bg-orange-50 transition-colors"
                    style={{ borderColor: '#E87722' }}>
                    <Upload size={22} className="mx-auto mb-2" style={{ color: '#E87722' }} />
                    <p className="text-sm text-slate-600">Click to upload scan image(s)</p>
                    <p className="text-xs text-slate-400">PNG, JPG, PDF, TIFF</p>
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf,.tiff" multiple className="hidden"
                      onChange={handleScanFileAdd} />
                  </div>

                  {/* USB Scanner */}
                  {isElectron && (
                    <div className="border rounded-xl p-4" style={{ borderColor: '#f0e0d0' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-700">USB Scanner</p>
                          {scannerAvailable && <p className="text-xs text-green-600 mt-0.5">Scanner detected ✓</p>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleCheckScanner} disabled={scannerChecking}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E87722', color: '#E87722' }}>
                            {scannerChecking ? 'Checking...' : 'Detect'}
                          </button>
                          {scannerAvailable && (
                            <button onClick={handleScanDocument} disabled={isScanning}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#E87722' }}>
                              {isScanning ? 'Scanning...' : 'Scan Page'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Files list */}
                  {scanFiles.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-green-700">{scanFiles.length} page(s) ready</p>
                      {scanFiles.map((f, i) => (
                        <p key={i} className="text-xs text-green-600 truncate">{f.name}</p>
                      ))}
                    </div>
                  )}

                  <button onClick={handleProcessScans} disabled={isScanning || scanFiles.length === 0}
                    className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    style={{ background: '#8B1A1A' }}>
                    {isScanning ? <><Loader2 size={16} className="animate-spin" /> Processing OCR...</> : `Process ${scanFiles.length} Page(s) with OCR`}
                  </button>
                </div>
              )}

              {/* Step: OCR Result */}
              {scanStep === 'result' && ocrResult && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="font-semibold text-green-800 mb-3">OCR Result</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Reg Number', ocrResult.registration_number || 'Not detected'],
                        ['Part A Total', ocrResult.part_a_total ?? '-'],
                        ['Part B&C Total', ocrResult.part_bc_total ?? '-'],
                        ['Grand Total', ocrResult.grand_total ?? ocrResult.marks_obtained ?? '-'],
                      ].map(([label, val]) => (
                        <div key={label} className="bg-white rounded-lg p-3 border border-green-100">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="font-bold text-slate-800 text-lg">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleScanAnother}
                      className="flex-1 py-2.5 rounded-xl font-medium border text-sm" style={{ borderColor: '#E87722', color: '#E87722' }}>
                      Scan Another
                    </button>
                    <button onClick={handleSaveResult}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm" style={{ background: '#8B1A1A' }}>
                      Save to Sheet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
