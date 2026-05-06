import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import AnalysisPage from './pages/AnalysisPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analysis/:id" element={<AnalysisPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
      <footer style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid var(--border)' }}>
        © {new Date().getFullYear()} Repo Analyzer · Powered by Gemini AI & GitHub API
      </footer>
    </BrowserRouter>
  )
}
