import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  ScanLine,
  Upload,
  CheckCircle2,
  XCircle,
  FileImage,
  Trash2,
  ArrowLeft,
  Loader2,
  User,
  BookOpen,
  Table2,
  X,
  Camera,
  HardDrive,
  AlertCircle,
} from 'lucide-react'
import { startSession, uploadPages, completeStudent, endSession, getExamFormat, listWorksheets, uploadStudentExcel, checkScanner, scanDocument } from '../api'
import { getScannerInstructions, SUPPORTED_SCAN_TYPES, validateScannedFile, compressImages } from '../utils/scanner'

const PIPELINE_STEPS = [
  { key: 'department', label: 'Department' },
  { key: 'year', label: 'Batch Year' },
  { key: 'section', label: 'Section' },
  { key: 'academic', label: 'Academic Year' },
  { key: 'details', label: 'Subject & Exam' },
]

const DEPARTMENTS = [
  { name: 'Computer Science and Engineering', code: '104' },
  { name: 'Information Technology', code: '205' },
  { name: 'Electronics and Communication Engineering', code: '106' },
  { name: 'Electrical and Electronics Engineering', code: '105' },
  { name: 'Mechanical Engineering', code: '114' },
  { name: 'Artificial Intelligence and Data Science', code: '243' },
  { name: 'Mechatronics', code: '115' },
]

const SECTIONS = ['Section A', 'Section B', 'Section C', 'Section D']

// ── helpers ──
function buildPartAMarks(fmt) {
  const obj = {}
  for (let i = 1; i <= fmt.part_a.questions; i++) obj[`Q${i}`] = 0
  return obj
}
function buildPartBCMarks(fmt) {
  const obj = {}
  for (let q = fmt.part_bc.questions_start; q <= fmt.part_bc.questions_end; q++) {
    for (const sub of fmt.part_bc.sub_parts) {
      for (const col of fmt.part_bc.mark_columns) {
        obj[`Q${q}${sub}_${col}`] = 0
      }
    }
  }
  return obj
}
function buildCOMarks(fmt) {
  const obj = {}
  for (const label of fmt.course_outcomes.labels) {
    obj[label] = {}
    for (const col of fmt.course_outcomes.columns) {
      obj[label][col] = 0
    }
  }
  return obj
}

export default function ScanExam() {
  // Pipeline step (0-4)
  const [pipelineStep, setPipelineStep] = useState(0)

  // Selections from pipeline steps 0-2
  const [selectedDept, setSelectedDept] = useState(null) // { name, code }
  const [selectedYear, setSelectedYear] = useState('')   // e.g. "2022"
  const [selectedSection, setSelectedSection] = useState('')
  const [academicYear, setAcademicYear] = useState('')

  // Step 3: subject & exam config
  const [config, setConfig] = useState({
    subject_name: '',
    subject_code: '',
    total_marks: 100,
    pass_marks: 60,
    exam_type: 'Model',
  })

  // Result sheets from the marks DB (for dropdown)
  const [resultSheets, setResultSheets] = useState([])
  const [selectedResultSheet, setSelectedResultSheet] = useState(null)

  // Student Excel file for reference upload
  const [studentExcelFile, setStudentExcelFile] = useState(null)
  const [studentUploadCount, setStudentUploadCount] = useState(0)

  // Build registration number prefix: 1133 + YY + deptCode
  const regPrefix = useMemo(() => {
    if (!selectedDept || !selectedYear) return ''
    const yy = selectedYear.slice(-2)
    return `1133${yy}${selectedDept.code}`
  }, [selectedDept, selectedYear])

  // Session & format
  const [sessionId, setSessionId] = useState(null)
  const [examFormat, setExamFormat] = useState(null)
  const [loading, setLoading] = useState(false)

  // Step 4 sub-phases: 'upload' | 'review'
  const [scanPhase, setScanPhase] = useState('upload')

  // Process dialog state
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [showScannerHelp, setShowScannerHelp] = useState(false)
  const [scannerAvailable, setScannerAvailable] = useState(false)
  const [scannerList, setScannerList] = useState([])
  const [scannerChecking, setScannerChecking] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  // Upload
  const [files, setFiles] = useState([])
  const [ocrResult, setOcrResult] = useState(null)

  // Review marks
  const [regNumber, setRegNumber] = useState('')
  const [partAMarks, setPartAMarks] = useState({})
  const [partBCMarks, setPartBCMarks] = useState({})
  const [coMarks, setCOMarks] = useState({})
  const [writtenTotals, setWrittenTotals] = useState({ part_a: null, part_bc: null, grand: null })

  const [coMapping, setCoMapping] = useState({
    partA: { 1: 'CO-1', 2: 'CO-1', 3: 'CO-2', 4: 'CO-2', 5: 'CO-3', 6: 'CO-3', 7: 'CO-4', 8: 'CO-4', 9: 'CO-5', 10: 'CO-5' },
    partBC: { 11: 'CO-1', 12: 'CO-2', 13: 'CO-3', 14: 'CO-4', 15: 'CO-5', 16: 'CO-1' }
  })

  // Session tracking
  const [processedStudents, setProcessedStudents] = useState([])
  const [sessionEnded, setSessionEnded] = useState(false)

  // Fetch format when total_marks changes
  useEffect(() => {
    const tm = config.total_marks
    const et = config.exam_type
    if (tm === 60 || tm === 100) {
      getExamFormat(tm, et)
        .then((res) => {
          const fmt = res.data.format
          setExamFormat(fmt)
          setPartAMarks(buildPartAMarks(fmt))
          setPartBCMarks(buildPartBCMarks(fmt))
          setCOMarks(buildCOMarks(fmt))
          
          // Initialize CO mapping if format has labels
          const labels = fmt.course_outcomes?.labels || ['CO-1', 'CO-2', 'CO-3', 'CO-4', 'CO-5']
          if (et === 'Mid Term') {
            setCoMapping({
              partA: { 1: labels[0], 2: labels[0], 3: labels[0], 4: labels[0], 5: labels[0], 6: labels[1], 7: labels[1], 8: labels[1], 9: labels[1], 10: labels[1] },
              partBC: { 11: labels[2], 12: labels[3], 13: labels[4], 14: labels[0], 15: labels[1], 16: labels[2] }
            })
          } else {
            // Model Exam defaults
            setCoMapping({
              partA: { 1: labels[0], 2: labels[0], 3: labels[1], 4: labels[1], 5: labels[2], 6: labels[2], 7: labels[3], 8: labels[3], 9: labels[4], 10: labels[4] },
              partBC: { 11: labels[0], 12: labels[1], 13: labels[2], 14: labels[3], 15: labels[4], 16: labels[0] }
            })
          }
        })
        .catch(() => {})
    }
  }, [config.total_marks, config.exam_type])

  // ── Auto-calculate CO Totals ──
  useEffect(() => {
    if (!examFormat || !examFormat.course_outcomes) return

    const newCOMarks = buildCOMarks(examFormat)
    
    // Part A Mapping
    for (let i = 1; i <= 10; i++) {
        const key = `Q${i}`
        const marks = partAMarks[key] || 0
        const coLabel = coMapping.partA[i]
        if (coLabel && newCOMarks[coLabel]) {
            newCOMarks[coLabel]['PART A'] += marks
        }
    }

    // Part B & C Mapping
    for (let q = 11; q <= 16; q++) {
        const coLabel = coMapping.partBC[q]
        if (!coLabel || !newCOMarks[coLabel]) continue
        
        // Sum marks for this question (sub-parts a + b)
        let sumQ = 0
        for (const sub of examFormat.part_bc.sub_parts) {
            for (const col of examFormat.part_bc.mark_columns) {
                sumQ += partBCMarks[`Q${q}${sub}_${col}`] || 0
            }
        }
        
        // Model & Mid Term logic: Q11-15 -> PART B, Q16 -> PART C
        const targetCol = q === 16 ? 'PART C' : 'PART B'
        if (newCOMarks[coLabel][targetCol] !== undefined) {
            newCOMarks[coLabel][targetCol] += sumQ
        }
    }

    // Explicitly calculate TOTAL for each CO row
    for (const label of Object.keys(newCOMarks)) {
        if (newCOMarks[label]['TOTAL'] !== undefined) {
            newCOMarks[label]['TOTAL'] = 
                (newCOMarks[label]['PART A'] || 0) + 
                (newCOMarks[label]['PART B'] || 0) + 
                (newCOMarks[label]['PART C'] || 0)
        }
    }

    setCOMarks(newCOMarks)
  }, [partAMarks, partBCMarks, coMapping, examFormat])

  // Fetch existing result sheets for dropdown
  useEffect(() => {
    listWorksheets()
      .then((res) => setResultSheets(res.data.worksheets || []))
      .catch(() => {})
  }, [])

  // ── Derived totals ──
  const partATotal = useMemo(() => Object.values(partAMarks).reduce((s, v) => s + v, 0), [partAMarks])

  const partBCTotals = useMemo(() => {
    if (!examFormat) return {}
    const totals = {}
    for (let q = examFormat.part_bc.questions_start; q <= examFormat.part_bc.questions_end; q++) {
      for (const sub of examFormat.part_bc.sub_parts) {
        let sum = 0
        for (const col of examFormat.part_bc.mark_columns) {
          sum += partBCMarks[`Q${q}${sub}_${col}`] || 0
        }
        totals[`Q${q}${sub}`] = sum
      }
    }
    return totals
  }, [partBCMarks, examFormat])

  const partBCQuestionTotals = useMemo(() => {
    if (!examFormat) return {}
    const totals = {}
    for (let q = examFormat.part_bc.questions_start; q <= examFormat.part_bc.questions_end; q++) {
      let sum = 0
      for (const sub of examFormat.part_bc.sub_parts) {
        sum += partBCTotals[`Q${q}${sub}`] || 0
      }
      totals[`Q${q}`] = sum
    }
    return totals
  }, [partBCTotals, examFormat])

  const partBCTotal = useMemo(() => Object.values(partBCQuestionTotals).reduce((s, v) => s + v, 0), [partBCQuestionTotals])

  const grandTotal = partATotal + partBCTotal

  // ── Dropzone ──
  const onDrop = useCallback((acceptedFiles) => {
    setFiles((prev) => [...prev, ...acceptedFiles])
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'] },
    multiple: true,
  })
  const removeFile = (idx) => setFiles(files.filter((_, i) => i !== idx))

  // ── Process dialog handlers ──
  const handleProcessClick = () => {
    setShowProcessDialog(true)
  }

  const handleChooseUpload = () => {
    if (files.length === 0) {
      toast.error('Upload at least one page first')
      return
    }
    setShowProcessDialog(false)
    handleUploadPages()
  }

  const handleShowScannerHelp = () => {
    setShowScannerHelp(true)
  }

  // ── Scanner functions ──
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron

  const handleCheckScanner = async () => {
    setScannerChecking(true)
    try {
      if (isElectron) {
        // Use Electron IPC for scanner detection
        const result = await window.electronAPI.scanner.check()
        setScannerAvailable(result.available)
        setScannerList(result.scanners || [])
        if (result.available) {
          toast.success(`Found ${result.scanners.length} scanner(s)! ${result.scanners[0].simulated ? '(SIMULATED)' : ''}`)
        } else {
          toast.info('No scanner detected. Connect USB scanner and try again.')
        }
      } else {
        // Web mode - try backend API
        const res = await checkScanner()
        setScannerAvailable(res.data.available)
        setScannerList(res.data.scanners || [])
        if (res.data.available) {
          toast.success(`Found ${res.data.scanners.length} scanner(s)! ${res.data.scanners[0].simulated ? '(SIMULATED)' : ''}`)
        } else {
          toast.info('No scanner detected. See troubleshooting below.')
        }
      }
    } catch (err) {
      console.error('Scanner check error:', err)
      setScannerAvailable(false)
      toast.error('Scanner detection failed. Check backend connection.')
    }
    setScannerChecking(false)
  }

  const handleScanDocument = async () => {
    setIsScanning(true)
    try {
      if (isElectron) {
        // Use Electron IPC for scanning
        const result = await window.electronAPI.scanner.scan({})
        if (result.success && result.filePath) {
          // Get the scanned file data
          const fileData = await window.electronAPI.scanner.getFile(result.filePath)
          if (fileData.success) {
            // Convert base64 to blob
            const byteString = atob(fileData.data)
            const ab = new ArrayBuffer(byteString.length)
            const ia = new Uint8Array(ab)
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i)
            }
            const blob = new Blob([ab], { type: fileData.mimeType })
            const file = new File([blob], `scan_${Date.now()}.png`, { type: 'image/png' })
            setFiles(prev => [...prev, file])
            toast.success('Page scanned successfully!')
          }
        } else {
          toast.error(result.error || 'Scan failed')
        }
      } else {
        // Web mode - try backend API
        const res = await scanDocument({ colorMode: 'color', dpi: 200 })
        if (res.data.success && res.data.file_path) {
          const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/uploads/${res.data.file_path.split('/').pop()}`)
          const blob = await response.blob()
          const file = new File([blob], `scan_${Date.now()}.png`, { type: 'image/png' })
          setFiles(prev => [...prev, file])
          toast.success('Page scanned successfully!')
        }
      }
    } catch (err) {
      console.error('Scan error:', err)
      toast.error(err?.response?.data?.detail || 'Failed to scan. Check scanner connection.')
    }
    setIsScanning(false)
  }

  // ── Pipeline navigation ──
  const goBack = () => {
    if (pipelineStep === 4 && scanPhase === 'review') {
      setScanPhase('upload')
      setOcrResult(null)
      setShowProcessDialog(true)
      return
    }
    if (pipelineStep > 0) setPipelineStep(pipelineStep - 1)
  }

  // ── Step 3 → 4: Start session then go to scan ──
  const handleStartSession = async () => {
    if (!config.subject_name || !config.subject_code) {
      toast.error('Please fill subject name and code')
      return
    }
    setLoading(true)
    try {
      const payload = {
        section: selectedSection,
        branch: selectedDept?.name || '',
        year: selectedYear,
        academic_year: academicYear,
        subject_name: config.subject_name,
        subject_code: config.subject_code,
        total_marks: config.total_marks,
        pass_marks: config.pass_marks,
        result_sheet: selectedResultSheet?.sheet_name || '',
        reg_prefix: regPrefix,
      }
      const res = await startSession(payload)
      const sid = res.data.session_id
      setSessionId(sid)
      if (res.data.format) setExamFormat(res.data.format)

      // Upload student Excel if provided
      if (studentExcelFile) {
        try {
          const excelRes = await uploadStudentExcel(sid, studentExcelFile)
          if (excelRes.data.success) {
            setStudentUploadCount(excelRes.data.count || 0)
            toast.success(`${excelRes.data.count} student(s) loaded for reference`)
          } else {
            toast.error(excelRes.data.message || 'Failed to load students')
          }
        } catch (excelErr) {
          console.error('Student Excel upload error:', excelErr?.response?.data || excelErr)
          toast.error(excelErr?.response?.data?.message || 'Failed to upload student file')
        }
      }

      setScanPhase('upload')
      setShowProcessDialog(true)  // Show upload/scan dialog immediately
      toast.success('Session started! Upload or scan exam pages.')
    } catch (err) {
      toast.error('Failed to start session')
    }
    setLoading(false)
  }

  // ── Upload & OCR ──
  const handleUploadPages = async () => {
    if (files.length === 0) { toast.error('Upload at least one page'); return }
    setLoading(true)
    try {
      // Compress images to reduce size for Cloudinary/Groq
      toast.loading('Compressing images...')
      const compressedFiles = await compressImages(files)

      toast.dismiss()
      toast.loading('Processing pages with OCR...')

      const res = await uploadPages(sessionId, compressedFiles)
      const data = res.data.ocr_result
      setOcrResult(data)
      setRegNumber(data.registration_number || '')

      if (examFormat) {
        const defaultA = buildPartAMarks(examFormat)
        const ocrA = data.part_a_marks || {}
        const mergedA = { ...defaultA }
        for (const key of Object.keys(mergedA)) {
          if (ocrA[key] !== undefined) mergedA[key] = parseInt(ocrA[key]) || 0
        }
        setPartAMarks(mergedA)

        const defaultBC = buildPartBCMarks(examFormat)
        const ocrBC = data.part_bc_marks || {}
        const mergedBC = { ...defaultBC }
        for (const key of Object.keys(mergedBC)) {
          if (ocrBC[key] !== undefined) mergedBC[key] = parseInt(ocrBC[key]) || 0
        }
        setPartBCMarks(mergedBC)

        const defaultCO = buildCOMarks(examFormat)
        const ocrCO = data.course_outcomes || {}
        const mergedCO = { ...defaultCO }
        for (const label of Object.keys(mergedCO)) {
          if (ocrCO[label]) {
            for (const col of Object.keys(mergedCO[label])) {
              if (ocrCO[label][col] !== undefined) mergedCO[label][col] = parseInt(ocrCO[label][col]) || 0
            }
          }
        }
        setCOMarks(mergedCO)
      }

      setWrittenTotals({
        part_a: data.written_totals?.part_a ?? null,
        part_bc: data.written_totals?.part_bc ?? null,
        grand: data.written_totals?.grand ?? null,
      })

      setScanPhase('review')
      const engine = data.engine || 'unknown'
      toast.dismiss()
      toast.success(`Processed ${files.length} page(s) via ${engine === 'groq_vision' ? 'Groq AI Vision' : engine}`)
    } catch (err) {
      toast.dismiss()
      toast.error(err?.response?.data?.message || 'Failed to process pages')
    }
    setLoading(false)
  }

  // ── Complete student ──
  const handleCompleteStudent = async () => {
    if (!regNumber) { toast.error('Enter registration number'); return }
    setLoading(true)
    try {
      const res = await completeStudent(sessionId, {
        register_number: regNumber,
        marks_obtained: grandTotal,
        part_a_total: partATotal,
        part_bc_total: partBCTotal,
        section_marks: { part_a: partAMarks, part_bc: partBCMarks, course_outcomes: coMarks },
      })
      setProcessedStudents((prev) => [...prev, res.data.result])
      toast.success(res.data.message)

      // Reset for next student
      setFiles([])
      setOcrResult(null)
      setRegNumber('')
      setWrittenTotals({ part_a: null, part_bc: null, grand: null })
      if (examFormat) {
        setPartAMarks(buildPartAMarks(examFormat))
        setPartBCMarks(buildPartBCMarks(examFormat))
        setCOMarks(buildCOMarks(examFormat))
      }
      setScanPhase('upload')
    } catch (err) {
      toast.error('Failed to save marks')
    }
    setLoading(false)
  }

  // ── End Session ──
  const handleEndSession = async () => {
    setLoading(true)
    try {
      await endSession(sessionId)
      setSessionEnded(true)
      toast.success('Session completed!')
    } catch (err) {
      toast.error('Failed to end session')
    }
    setLoading(false)
  }

  // ── Full Reset ──
  const handleNewSession = () => {
    setPipelineStep(0)
    setSelectedDept(null)
    setSelectedYear('')
    setSelectedSection('')
    setAcademicYear('')
    setSessionId(null)
    setConfig({ subject_name: '', subject_code: '', total_marks: 60, pass_marks: 24 })
    setSelectedResultSheet(null)
    setStudentExcelFile(null)
    setStudentUploadCount(0)
    setFiles([])
    setOcrResult(null)
    setRegNumber('')
    setExamFormat(null)
    setPartAMarks({})
    setPartBCMarks({})
    setCOMarks({})
    setWrittenTotals({ part_a: null, part_bc: null, grand: null })
    setProcessedStudents([])
    setSessionEnded(false)
    setScanPhase('upload')
  }

  // ═══════════════════ SESSION ENDED ═══════════════════
  if (sessionEnded) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Session Complete!</h2>
          <p className="text-slate-500 mb-6">Processed {processedStudents.length} student(s) for {config.subject_name}</p>
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-indigo-600">{processedStudents.length}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{processedStudents.filter((s) => s.status === 'PASS').length}</p>
                <p className="text-xs text-slate-500">Passed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-600">{processedStudents.filter((s) => s.status === 'FAIL').length}</p>
                <p className="text-xs text-slate-500">Failed</p>
              </div>
            </div>
          </div>
          {processedStudents.length > 0 && (
            <div className="text-left mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Processed Students</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {processedStudents.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
                    <div>
                      <span className="font-medium text-slate-700">{s.register_number}</span>
                      <span className="text-slate-400 mx-2">—</span>
                      <span className="text-slate-600">{s.student_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">A:{s.part_a_total} B&C:{s.part_bc_total}</span>
                      <span className="font-semibold text-slate-700">{s.marks_obtained}/{s.total_marks}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleNewSession} className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            Start New Session
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════ MAIN RENDER ═══════════════════
  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Exam Paper Scanning Portal</h1>
            <p className="text-slate-500 text-sm mt-1">Complete each step in order to configure and start scanning.</p>
          </div>
          <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700">
            Examiner Workflow
          </div>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <p className="text-sm font-semibold text-slate-700 mb-4">Scanning Pipeline</p>
        <div className="flex items-center">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.key} className="contents">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  i < pipelineStep
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : i === pipelineStep
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}>
                  {i < pipelineStep ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                <span className={`text-sm font-medium whitespace-nowrap ${i <= pipelineStep ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="flex-1 mx-3">
                  <div className={`h-0.5 rounded-full transition-all duration-500 ${
                    i < pipelineStep ? 'bg-emerald-400' : i === pipelineStep ? 'bg-gradient-to-r from-indigo-400 to-slate-200' : 'bg-slate-200'
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Processed students badge */}
      {sessionId && processedStudents.length > 0 && (
        <div className="mb-6 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3">
          <span className="text-sm text-indigo-700 font-medium">{processedStudents.length} student(s) processed</span>
          <button onClick={handleEndSession} disabled={loading} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            End Session
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ═══ Left: Step Content (3 cols) ═══ */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[400px]">

            {/* ── STEP 0: Department ── */}
            {pipelineStep === 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Select Department</h2>
                <p className="text-sm text-slate-500 mb-5">Choose the department to continue.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEPARTMENTS.map((dept) => (
                    <button
                      key={dept.code}
                      onClick={() => { setSelectedDept(dept); setPipelineStep(1) }}
                      className={`p-4 rounded-xl border text-left text-sm font-medium transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        selectedDept?.code === dept.code
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      <span>{dept.name}</span>
                      <span className="ml-2 text-xs text-slate-400">({dept.code})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 1: Year ── */}
            {pipelineStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Enter Batch Year</h2>
                <p className="text-sm text-slate-500 mb-5">Enter the student batch admission year (e.g. 2022, 2023).</p>
                <div className="max-w-xs">
                  <input
                    type="number"
                    min={2000}
                    max={2099}
                    placeholder="e.g. 2022"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && selectedYear.length === 4) setPipelineStep(2) }}
                  />
                  {selectedYear.length === 4 && (
                    <p className="mt-2 text-sm text-indigo-600">Reg prefix will use: <span className="font-mono font-bold">1133{selectedYear.slice(-2)}{selectedDept?.code || '???'}</span></p>
                  )}
                </div>
                <div className="mt-5 flex justify-between">
                  <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button
                    onClick={() => setPipelineStep(2)}
                    disabled={selectedYear.length !== 4}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Section ── */}
            {pipelineStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Select Section</h2>
                <p className="text-sm text-slate-500 mb-5">Choose the section for {selectedDept?.name}, Batch {selectedYear}.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SECTIONS.map((sec) => (
                    <button
                      key={sec}
                      onClick={() => { setSelectedSection(sec); setPipelineStep(3) }}
                      className={`p-4 rounded-xl border text-center text-sm font-medium transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        selectedSection === sec
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
                <div className="mt-5">
                  <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                    <ArrowLeft size={16} /> Back
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Academic Year ── */}
            {pipelineStep === 3 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Select Academic Year</h2>
                <p className="text-sm text-slate-500 mb-5">Choose the current academic year of the students.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((yr) => (
                    <button
                      key={yr}
                      onClick={() => { setAcademicYear(yr); setPipelineStep(4) }}
                      className={`p-4 rounded-xl border text-center text-sm font-medium transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        academicYear === yr
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
                <div className="mt-5">
                  <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                    <ArrowLeft size={16} /> Back
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Subject & Exam Details ── */}
            {pipelineStep === 4 && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <BookOpen size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Subject & Exam Details</h2>
                    <p className="text-sm text-slate-500">Select an existing result sheet or enter details manually.</p>
                  </div>
                </div>

                {/* Existing result sheets dropdown */}
                {resultSheets.length > 0 && (
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Existing Result Sheet</label>
                    <select
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      value={selectedResultSheet?.sheet_name || ''}
                      onChange={(e) => {
                        const sheet = resultSheets.find((s) => s.sheet_name === e.target.value)
                        if (sheet) {
                          setSelectedResultSheet(sheet)
                          setConfig({
                            subject_name: sheet.subject_name,
                            subject_code: sheet.subject_code,
                            total_marks: sheet.total_marks || 100,
                            pass_marks: sheet.pass_marks || 60,
                            exam_type: sheet.exam_type || 'Model',
                          })
                        } else {
                          setSelectedResultSheet(null)
                        }
                      }}
                    >
                      <option value="">— Choose a result sheet —</option>
                      {resultSheets.map((ws) => (
                        <option key={ws.sheet_name} value={ws.sheet_name}>
                          {ws.sheet_name}{ws.subject_name ? ` (${ws.exam_type || ''})` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedResultSheet && (
                      <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-indigo-700 font-semibold">{selectedResultSheet.subject_code}</span>
                          <span className="text-slate-600">{selectedResultSheet.subject_name}</span>
                          <span className="text-slate-500">{selectedResultSheet.total_marks} marks</span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">{selectedResultSheet.exam_type}</span>
                        </div>
                      </div>
                    )}
                    <div className="my-4 flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">or enter manually</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject Name *</label>
                    <input className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Data Structures" value={config.subject_name} onChange={(e) => { setConfig({ ...config, subject_name: e.target.value }); setSelectedResultSheet(null) }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject Code *</label>
                    <input className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. CS301" value={config.subject_code} onChange={(e) => { setConfig({ ...config, subject_code: e.target.value }); setSelectedResultSheet(null) }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Exam Type *</label>
                    <select
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      value={config.exam_type}
                      onChange={(e) => {
                        const et = e.target.value
                        setConfig({ ...config, exam_type: et, total_marks: 100, pass_marks: 60 })
                        setSelectedResultSheet(null)
                      }}
                    >
                      <option value="Mid Term">Mid Term (100 Marks)</option>
                      <option value="Model">Model (100 Marks)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pass Marks *</label>
                    <input type="number" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={config.pass_marks} onChange={(e) => setConfig({ ...config, pass_marks: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>

                {/* Student Excel Upload */}
                <div className="mt-5 p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <Upload size={20} className="text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">Upload Student Reference Data (Optional)</p>
                      <p className="text-xs text-slate-500">Excel file with student reg numbers & names. Used to auto-fill student info during scanning.</p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    onChange={(e) => setStudentExcelFile(e.target.files[0] || null)}
                  />
                  {studentExcelFile && (
                    <div className="mt-2 flex items-center gap-2">
                      <FileImage size={14} className="text-indigo-500" />
                      <span className="text-xs text-slate-600">{studentExcelFile.name}</span>
                      <button onClick={() => setStudentExcelFile(null)} className="text-xs text-rose-500 hover:text-rose-700 ml-2">Remove</button>
                    </div>
                  )}
                </div>

                {/* Format Preview & CO Mapping */}
                {examFormat && (
                  <div className="mt-5 space-y-4">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                        <Table2 size={16} /> {examFormat.exam_type} — {examFormat.total_marks} marks
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="bg-white rounded-lg p-3 border border-indigo-100">
                          <p className="font-semibold text-indigo-700">{examFormat.part_a.label}</p>
                          <p className="text-slate-600">Q1 – Q{examFormat.part_a.questions}</p>
                          <p className="text-slate-500">{examFormat.part_a.questions} × {examFormat.part_a.marks_each} = {examFormat.part_a.max_marks} marks</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-indigo-100">
                          <p className="font-semibold text-indigo-700">{examFormat.part_bc.label}</p>
                          <p className="text-slate-600">Q{examFormat.part_bc.questions_start} – Q{examFormat.part_bc.questions_end}</p>
                          <p className="text-slate-500">Max: {examFormat.part_bc.max_marks} marks</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-indigo-100">
                          <p className="font-semibold text-indigo-700">Course Outcomes</p>
                          <p className="text-slate-600">{examFormat.course_outcomes.labels.join(', ')}</p>
                        </div>
                      </div>
                    </div>

                    {/* CO Mapping Section */}
                    {(config.exam_type === 'Mid Term' || config.exam_type === 'Model') && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 border-b border-amber-100 pb-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Table2 size={16} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">Course Outcome (CO) Mapping</p>
                            <p className="text-xs text-slate-500">Assign each question to a CO for automatic grading.</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {/* Part A Mapping */}
                          {config.exam_type === 'Mid Term' ? (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Part A: Q1-Q5</p>
                                <select 
                                  value={coMapping.partA[1]}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setCoMapping({ ...coMapping, partA: { ...coMapping.partA, 1: val, 2: val, 3: val, 4: val, 5: val } })
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                  {examFormat.course_outcomes.labels.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Part A: Q6-Q10</p>
                                <select 
                                  value={coMapping.partA[6]}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setCoMapping({ ...coMapping, partA: { ...coMapping.partA, 6: val, 7: val, 8: val, 9: val, 10: val } })
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                  {examFormat.course_outcomes.labels.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Part A (Fixed Mapping)</p>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                {[1, 3, 5, 7, 9].map((q) => (
                                  <div key={q} className="flex flex-col gap-1 items-center bg-white/50 border border-amber-100 rounded p-2">
                                    <label className="text-[10px] font-bold text-slate-400">Q{q}-{q+1}</label>
                                    <span className="text-sm font-bold text-amber-700">{coMapping.partA[q]}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Part B & C Mapping */}
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
                              {config.exam_type === 'Model' ? 'Part B (Fixed) & Part C (Selectable)' : 'Part B & C: Q11-Q16'}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[11, 12, 13, 14, 15, 16].map((q) => {
                                const isPartC = q === 16;
                                const isModelFixed = config.exam_type === 'Model' && !isPartC;

                                return (
                                  <div key={q} className="flex flex-col gap-1.5">
                                    <label className={`text-xs font-semibold ml-1 ${isPartC ? 'text-indigo-600' : 'text-slate-600'}`}>
                                      Q{q} {isPartC && '(Part C)'}
                                    </label>
                                    {isModelFixed ? (
                                      <div className="w-full px-3 py-1.5 bg-white/50 border border-amber-100 rounded-lg text-sm font-bold text-amber-700 text-center">
                                        {coMapping.partBC[q]}
                                      </div>
                                    ) : (
                                      <select 
                                        value={coMapping.partBC[q]}
                                        onChange={(e) => setCoMapping({ 
                                            ...coMapping, 
                                            partBC: { ...coMapping.partBC, [q]: e.target.value } 
                                        })}
                                        className={`w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:ring-2 outline-none ${isPartC ? 'border-indigo-300 focus:ring-indigo-400' : 'focus:ring-amber-500'}`}
                                      >
                                        {examFormat.course_outcomes.labels.map(l => <option key={l} value={l}>{l}</option>)}
                                      </select>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 flex justify-between">
                  <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button onClick={handleStartSession} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                    Start Scanning Session
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Scan (shown in dialog, this is just the page background) ── */}
            {pipelineStep === 4 && scanPhase === 'upload' && sessionId && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Upload size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Upload Exam Pages</h2>
                    <p className="text-sm text-slate-500">Upload all pages for one student. First page should have the registration number.</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-sm text-blue-700">
                  <span className="font-semibold">{examFormat?.exam_type || 'Exam'}:</span> {config.subject_name} ({config.subject_code}) | Total: {config.total_marks} | Pass: {config.pass_marks}
                  {studentUploadCount > 0 && <span className="ml-3 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">{studentUploadCount} students loaded</span>}
                </div>

                <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'}`}>
                  <input {...getInputProps()} />
                  <Upload className="mx-auto text-slate-400 mb-3" size={40} />
                  <p className="text-sm font-medium text-slate-600">{isDragActive ? 'Drop the files here...' : 'Drag & drop exam pages, or click to browse'}</p>
                  <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, JPEG, BMP, TIFF</p>
                </div>

                {files.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Uploaded Pages ({files.length})</h3>
                    <div className="space-y-2">
                      {files.map((file, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <FileImage size={16} className="text-indigo-500" />
                            <span className="text-sm text-slate-700">{file.name}</span>
                            <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button onClick={handleProcessClick} disabled={loading || files.length === 0} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                    Process Pages
                  </button>
                </div>

                {/* Upload/Scan Dialog */}
                {showProcessDialog && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-indigo-50">
                        <div className="flex items-center gap-3">
                          <ScanLine size={24} className="text-indigo-600" />
                          <h3 className="text-lg font-semibold text-slate-800">Upload or Scan Exam Pages</h3>
                        </div>
                        <button onClick={() => setShowProcessDialog(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-6 space-y-5">
                        {/* Upload Area */}
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-2">Step 1: Upload scanned pages</p>
                          <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                          >
                            <input {...getInputProps()} />
                            <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                            <p className="text-sm text-slate-600">
                              {isDragActive ? 'Drop files here...' : 'Drag & drop scanned images, or click to browse'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">PNG, JPG, TIFF, PDF supported</p>
                          </div>
                        </div>

                        {/* Uploaded files preview */}
                        {files.length > 0 && (
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-sm font-medium text-slate-700 mb-2">{files.length} page(s) ready</p>
                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                              {files.map((f, i) => (
                                <div key={i} className="flex items-center gap-1 bg-white px-2 py-1 rounded border text-xs">
                                  <FileImage size={12} className="text-slate-400" />
                                  <span className="truncate max-w-[100px]">{f.name}</span>
                                  <button onClick={() => removeFile(i)} className="text-rose-500 hover:text-rose-700">
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Process button */}
                        <button
                          onClick={handleChooseUpload}
                          disabled={files.length === 0 || loading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} />
                              Process {files.length} Page(s) with OCR
                            </>
                          )}
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-slate-200"></div>
                          <span className="text-xs text-slate-400">Or scan directly</span>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>

                        {/* Direct Scanner Control */}
                        <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <HardDrive size={18} className="text-emerald-600" />
                              <span className="text-sm font-medium text-slate-700">USB Scanner</span>
                              {scannerAvailable && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">Connected</span>
                              )}
                            </div>
                            <button
                              onClick={handleCheckScanner}
                              disabled={scannerChecking}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              {scannerChecking ? 'Checking...' : 'Detect Scanner'}
                            </button>
                          </div>
                          
                          {scannerAvailable ? (
                            <div className="space-y-2">
                              {scannerList.length > 0 && (
                                <p className="text-xs text-slate-600">
                                  Found: {scannerList[0]?.name || 'Scanner'}
                                </p>
                              )}
                              <button
                                onClick={handleScanDocument}
                                disabled={isScanning}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              >
                                {isScanning ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Scanning...
                                  </>
                                ) : (
                                  <>
                                    <ScanLine size={16} />
                                    Scan Page Now
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">
                              <p>Click "Detect Scanner" to check for connected USB scanners.</p>
                              <p className="mt-1">Requires backend running locally with scanner connected.</p>
                              <div className="mt-4 pt-3 border-t border-emerald-100">
                                <p className="font-semibold text-slate-600 mb-1">Troubleshooting:</p>
                                <ul className="space-y-1 list-disc pl-3 mt-1 text-[11px]">
                                  <li>Ensure scanner is connected via <b>USB</b></li>
                                  <li>Check if <b>WIA Service</b> is running</li>
                                  <li>Try <b>restarting backend</b> terminal</li>
                                  <li>If no hardware, use <code>SCANNER_MODE=simulation</code></li>
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Manual scan help */}
                        <button
                          onClick={handleShowScannerHelp}
                          className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-left"
                        >
                          <AlertCircle size={18} className="text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-600">Manual scanning guide</p>
                            <p className="text-xs text-slate-400">Use Windows Scan app if direct scan doesn't work</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scanner Help Dialog */}
                {showScannerHelp && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50">
                        <div className="flex items-center gap-3">
                          <HardDrive size={24} className="text-emerald-600" />
                          <h3 className="text-lg font-semibold text-slate-800">How to Scan Documents</h3>
                        </div>
                        <button onClick={() => setShowScannerHelp(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-6">
                        {(() => {
                          const instructions = getScannerInstructions()
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                                <span className="text-lg">{instructions.title}</span>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">FREE</span>
                              </div>
                              <ol className="space-y-3">
                                {instructions.steps.map((step, idx) => (
                                  <li key={idx} className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-medium">
                                      {idx + 1}
                                    </span>
                                    <span className="text-slate-700">{step}</span>
                                  </li>
                                ))}
                              </ol>
                              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800">{instructions.tip}</p>
                              </div>
                              <div className="mt-4 pt-4 border-t border-slate-200">
                                <p className="text-sm text-slate-600 mb-3">Supported formats: <span className="font-medium">PNG, JPG, TIFF, PDF</span></p>
                                <button
                                  onClick={() => setShowScannerHelp(false)}
                                  className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                                >
                                  Got it, I'll upload scanned files
                                </button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {pipelineStep === 4 && scanPhase === 'review' && examFormat && (
              <div className="space-y-5">
                {/* OCR header */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">Review & Enter Marks</h2>
                      <p className="text-sm text-slate-500">Verify OCR results and correct if needed.</p>
                    </div>
                  </div>

                  {ocrResult && (
                    <div className={`rounded-lg p-3 mb-4 ${ocrResult.confidence >= 0.8 ? 'bg-emerald-50 border border-emerald-200' : ocrResult.confidence >= 0.5 ? 'bg-amber-50 border border-amber-200' : 'bg-rose-50 border border-rose-200'}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          OCR Confidence: <span className="font-bold">{(ocrResult.confidence * 100).toFixed(0)}%</span>
                          {ocrResult.confidence < 0.5 && <span className="text-rose-600 ml-2">(Low — verify manually)</span>}
                        </p>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ocrResult.engine === 'groq_vision' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                          {ocrResult.engine === 'groq_vision' ? 'Groq AI Vision' : ocrResult.engine || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  )}

                  {ocrResult?.validation_error && (
                    <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-4 mb-4 animate-pulse">
                      <div className="flex items-center gap-3">
                        <XCircle size={28} className="text-rose-600 shrink-0" />
                        <div>
                          <p className="text-rose-800 font-bold text-base">⚠️ MARKS MISMATCH DETECTED!</p>
                          <p className="text-rose-600 text-sm font-medium leading-relaxed">
                            The calculated sum of marks does NOT match the Teacher's written totals. 
                            <br />
                            <span className="italic">"{ocrResult.validation_msg}"</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Registration Number *</label>
                    <input className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={regNumber} onChange={(e) => setRegNumber(e.target.value.toUpperCase())} placeholder="Enter or correct registration number" />
                    <p className="text-xs text-slate-400 mt-1">OCR detected: {ocrResult?.registration_number || 'Not detected'}</p>
                  </div>
                </div>

                {/* Part A */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded flex items-center justify-center text-xs font-bold">A</span>
                    {examFormat.part_a.label} — {examFormat.part_a.questions} × {examFormat.part_a.marks_each} = {examFormat.part_a.max_marks} marks
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 border-b border-slate-200">Q No.</th>
                          {Array.from({ length: examFormat.part_a.questions }, (_, i) => (
                            <th key={i} className="px-3 py-2 text-center text-xs font-medium text-slate-600 border-b border-slate-200 w-14">Q{i + 1}</th>
                          ))}
                          <th className="px-3 py-2 text-center text-xs font-bold text-blue-700 border-b border-slate-200 bg-blue-100 w-16">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">Marks</td>
                          {Array.from({ length: examFormat.part_a.questions }, (_, i) => {
                            const key = `Q${i + 1}`
                            return (
                              <td key={i} className="px-1 py-1 text-center border-b border-slate-100">
                                <input type="number" min={0} max={examFormat.part_a.marks_each}
                                  className="w-12 px-1 py-1.5 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={partAMarks[key] || 0}
                                  onChange={(e) => { const val = Math.min(parseInt(e.target.value) || 0, examFormat.part_a.marks_each); setPartAMarks((p) => ({ ...p, [key]: val })) }}
                                />
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-center font-bold text-blue-700 bg-blue-50 border-b border-slate-100">{partATotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Part B & C */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded flex items-center justify-center text-xs font-bold">B&C</span>
                    {examFormat.part_bc.label} — Q{examFormat.part_bc.questions_start} to Q{examFormat.part_bc.questions_end} (Max {examFormat.part_bc.max_marks})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-purple-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 border-b border-slate-200">Q</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 border-b border-slate-200">Sub</th>
                          {examFormat.part_bc.mark_columns.map((col) => (
                            <th key={col} className="px-3 py-2 text-center text-xs font-medium text-slate-600 border-b border-slate-200 w-14">{col}</th>
                          ))}
                          <th className="px-3 py-2 text-center text-xs font-bold text-purple-700 border-b border-slate-200 bg-purple-100 w-16">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rows = []
                          for (let q = examFormat.part_bc.questions_start; q <= examFormat.part_bc.questions_end; q++) {
                            examFormat.part_bc.sub_parts.forEach((sub, si) => {
                              const isFirst = si === 0
                              const subCount = examFormat.part_bc.sub_parts.length
                              rows.push(
                                <tr key={`${q}${sub}`} className={isFirst ? 'border-t border-slate-200' : ''}>
                                  {isFirst && (
                                    <td rowSpan={subCount} className="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 bg-slate-50">
                                      Q{q}
                                      <div className="text-xs font-normal text-purple-600 mt-1">{partBCQuestionTotals[`Q${q}`] || 0}</div>
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-center text-xs font-medium text-slate-500 border-b border-slate-100">{sub}</td>
                                  {examFormat.part_bc.mark_columns.map((col) => {
                                    const key = `Q${q}${sub}_${col}`
                                    return (
                                      <td key={col} className="px-1 py-1 text-center border-b border-slate-100">
                                        <input type="number" min={0}
                                          className="w-12 px-1 py-1.5 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                          value={partBCMarks[key] || 0}
                                          onChange={(e) => { const val = Math.max(0, parseInt(e.target.value) || 0); setPartBCMarks((p) => ({ ...p, [key]: val })) }}
                                        />
                                      </td>
                                    )
                                  })}
                                  <td className="px-3 py-2 text-center font-semibold text-purple-700 bg-purple-50 border-b border-slate-100">{partBCTotals[`Q${q}${sub}`] || 0}</td>
                                </tr>
                              )
                            })
                          }
                          return rows
                        })()}
                        <tr className="bg-purple-100">
                          <td colSpan={2 + examFormat.part_bc.mark_columns.length} className="px-3 py-2 text-right text-xs font-bold text-purple-800">Part B & C Total</td>
                          <td className="px-3 py-2 text-center font-bold text-purple-800">{partBCTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Course Outcomes */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded flex items-center justify-center text-xs font-bold">CO</span>
                    Course Outcomes — {examFormat.course_outcomes.labels.join(', ')}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 border-b border-slate-200">CO</th>
                          {examFormat.course_outcomes.columns.map((col) => (
                            <th key={col} className="px-3 py-2 text-center text-xs font-medium text-slate-600 border-b border-slate-200 w-20">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {examFormat.course_outcomes.labels.map((label) => (
                          <tr key={label}>
                            <td className="px-3 py-2 font-medium text-slate-700 border-b border-slate-100">{label}</td>
                            {examFormat.course_outcomes.columns.map((col) => {
                              if (col === 'TOTAL') {
                                const rowTotal = examFormat.course_outcomes.columns.filter((c) => c !== 'TOTAL').reduce((s, c) => s + (coMarks[label]?.[c] || 0), 0)
                                return <td key={col} className="px-3 py-2 text-center font-bold text-amber-700 bg-amber-50 border-b border-slate-100">{rowTotal}</td>
                              }
                              return (
                                <td key={col} className="px-1 py-1 text-center border-b border-slate-100 italic text-slate-400 bg-slate-50/30">
                                  {coMarks[label]?.[col] || 0}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grand Total & Actions */}
                <div>
                  {writtenTotals.grand !== null && (
                    <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <p className="text-xs font-semibold text-emerald-800">Verified Against Sheet Totals</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-emerald-700">
                          {writtenTotals.part_a !== null && <span>Part A: <strong>{writtenTotals.part_a}</strong></span>}
                          {writtenTotals.part_bc !== null && <span>Part B&C: <strong>{writtenTotals.part_bc}</strong></span>}
                          <span>Grand: <strong>{writtenTotals.grand}/{config.total_marks}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Part A</p>
                      <p className="text-lg font-bold text-blue-700">{partATotal}<span className="text-sm font-normal text-slate-400">/{examFormat.part_a.max_marks}</span></p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Part B & C</p>
                      <p className="text-lg font-bold text-purple-700">{partBCTotal}<span className="text-sm font-normal text-slate-400">/{examFormat.part_bc.max_marks}</span></p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${grandTotal >= config.pass_marks ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <p className="text-xs text-slate-500">Grand Total</p>
                      <p className={`text-lg font-bold ${grandTotal >= config.pass_marks ? 'text-emerald-700' : 'text-rose-700'}`}>{grandTotal}<span className="text-sm font-normal text-slate-400">/{config.total_marks}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 mb-4">
                    <div className="flex items-center gap-3">
                      <User size={18} className="text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">{regNumber || '---'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-800">{grandTotal} / {config.total_marks}</span>
                      {grandTotal >= config.pass_marks ? (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 size={14} /> PASS</span>
                      ) : (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-rose-100 text-rose-700"><XCircle size={14} /> FAIL</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                      <ArrowLeft size={16} /> Re-upload
                    </button>
                    <button onClick={handleCompleteStudent} disabled={loading || !regNumber} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Save & Next Student
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ═══ Right: Selection Summary (2 cols) ═══ */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Selection Summary</h3>

            <div className="space-y-0 divide-y divide-slate-100">
              {[
                { label: 'Department', value: selectedDept ? `${selectedDept.name} (${selectedDept.code})` : 'Not Selected' },
                { label: 'Batch Year', value: selectedYear || 'Not Selected' },
                { label: 'Section', value: selectedSection || 'Not Selected' },
                { label: 'Academic Year', value: academicYear || 'Not Selected' },
                { label: 'Reg Prefix', value: regPrefix || 'Not Built' },
                { label: 'Subject Name', value: config.subject_name || 'Not Entered' },
                { label: 'Subject Code', value: config.subject_code || 'Not Entered' },
                { label: 'Total Marks', value: config.total_marks ? `${config.total_marks}` : 'Not Set' },
                { label: 'Pass Marks', value: config.pass_marks ? `${config.pass_marks}` : 'Not Set' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className={`text-sm font-semibold ${value.startsWith('Not') ? 'text-slate-400' : 'text-slate-800'}`}>{value}</span>
                </div>
              ))}
            </div>

            {sessionId && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-xs font-semibold text-emerald-700">Session Active</p>
                <p className="text-xs text-emerald-600 mt-1">{processedStudents.length} student(s) scanned</p>
              </div>
            )}

            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700 leading-relaxed">
              Select each step in order. After choosing, the pipeline advances automatically. All your scanning logic and OCR processing remains the same.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
