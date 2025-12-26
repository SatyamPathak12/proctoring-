import { useState, useEffect, useRef } from 'react';

interface Student {
  id: string;
  name: string;
  lastFrame: string | null;
  lastUpdate: number;
  isActive: boolean;
}

const AdminPanel: React.FC = () => {
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel('proctoring-channel');
    
    channelRef.current.onmessage = (event) => {
      const { type, studentId, studentName, frame, timestamp } = event.data;
      
      switch (type) {
        case 'student-joined':
          setStudents(prev => ({
            ...prev,
            [studentId]: {
              id: studentId,
              name: studentName,
              lastFrame: null,
              lastUpdate: Date.now(),
              isActive: true
            }
          }));
          break;
          
        case 'screen-frame':
          setStudents(prev => ({
            ...prev,
            [studentId]: {
              ...prev[studentId],
              lastFrame: frame,
              lastUpdate: timestamp,
              isActive: true
            }
          }));
          break;
          
        case 'student-left':
          setStudents(prev => {
            const updated = { ...prev };
            if (updated[studentId]) {
              updated[studentId] = { ...updated[studentId], isActive: false };
            }
            return updated;
          });
          if (selectedStudent === studentId) {
            setSelectedStudent(null);
          }
          break;
      }
    };

    return () => {
      channelRef.current?.close();
    };
  }, [selectedStudent]);

  const activeStudents = Object.values(students).filter(s => s.isActive);
  const selectedStudentData = selectedStudent ? students[selectedStudent] : null;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🎓 Proctoring Admin Panel</h1>
        <div className="stats">
          <span className="stat">
            <strong>{activeStudents.length}</strong> Active Students
          </span>
        </div>
      </div>

      <div className="admin-content">
        {/* Student List */}
        <div className="students-sidebar">
          <h2>Active Students</h2>
          
          {activeStudents.length === 0 ? (
            <div className="no-students">
              <p>👀 Waiting for students...</p>
              <p className="hint">Students will appear here once they start a test.</p>
            </div>
          ) : (
            <div className="students-list">
              {activeStudents.map(student => (
                <div
                  key={student.id}
                  className={`student-card ${selectedStudent === student.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStudent(student.id)}
                >
                  <div className="student-avatar">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="student-info">
                    <span className="student-name">{student.name}</span>
                    <span className="student-status">
                      <span className="status-dot active"></span>
                      Taking test
                    </span>
                  </div>
                  {student.lastFrame && (
                    <div className="thumbnail">
                      <img src={student.lastFrame} alt="Screen preview" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main View */}
        <div className="main-view">
          {selectedStudentData ? (
            <div className="screen-view">
              <div className="view-header">
                <h2>Viewing: {selectedStudentData.name}</h2>
                <button 
                  className="close-view-btn"
                  onClick={() => setSelectedStudent(null)}
                >
                  ✕ Close
                </button>
              </div>
              <div className="screen-container">
                {selectedStudentData.lastFrame ? (
                  <img 
                    src={selectedStudentData.lastFrame} 
                    alt={`${selectedStudentData.name}'s screen`}
                    className="screen-image"
                  />
                ) : (
                  <div className="loading-screen">
                    <p>⏳ Waiting for screen data...</p>
                  </div>
                )}
              </div>
              <div className="view-footer">
                <span>Last update: {new Date(selectedStudentData.lastUpdate).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <div className="placeholder-content">
                <span className="big-icon">🖥️</span>
                <h2>Select a Student</h2>
                <p>Click on a student from the list to view their live screen</p>
              </div>
            </div>
          )}
        </div>

        {/* Grid View for all students */}
        {activeStudents.length > 1 && !selectedStudent && (
          <div className="grid-view">
            <h2>All Screens</h2>
            <div className="screens-grid">
              {activeStudents.map(student => (
                <div 
                  key={student.id} 
                  className="grid-item"
                  onClick={() => setSelectedStudent(student.id)}
                >
                  <div className="grid-screen">
                    {student.lastFrame ? (
                      <img src={student.lastFrame} alt={`${student.name}'s screen`} />
                    ) : (
                      <div className="grid-loading">Loading...</div>
                    )}
                  </div>
                  <div className="grid-label">{student.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
