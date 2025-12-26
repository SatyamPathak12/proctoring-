import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import StudentTest from './components/StudentTest';
import AdminPanel from './components/AdminPanel';
import './Proctoring.css';

function Home() {
  return (
    <div className="home-container">
      <div className="home-card">
        <h1>🎓 Proctoring System</h1>
        <p className="subtitle">Choose your role to continue</p>
        
        <div className="home-buttons">
          <Link to="/student" className="home-btn">
            <span className="icon">📝</span>
            <strong>Student</strong>
            <span>Take a test</span>
          </Link>
          
          <Link to="/admin" className="home-btn">
            <span className="icon">👁️</span>
            <strong>Admin</strong>
            <span>Monitor students</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/student" element={<StudentTest />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}

export default App;
