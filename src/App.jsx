import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Profile from './pages/profile'
import FrontOffice from './pages/frontoffice'
import './styles/Profile.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Profile />} />
        <Route path="/front-office" element={<FrontOffice />} />
      </Routes>
    </Router>
  )
}

export default App 
