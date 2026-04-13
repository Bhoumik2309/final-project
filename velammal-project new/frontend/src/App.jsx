import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ScanExam from './pages/ScanExam'
import Results from './pages/Results'
import ResultSheets from './pages/ResultSheets'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="scan" element={<ScanExam />} />
        <Route path="result-sheets" element={<ResultSheets />} />
        <Route path="results" element={<Results />} />
      </Route>
    </Routes>
  )
}
