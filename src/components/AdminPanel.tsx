import { useState, useEffect, useRef } from 'react';

interface Student {
  id: string;
  name: string;
  lastFrame: string | null;
  lastUpdate: number;
  isActive: boolean;
}

// Get WebSocket URL - works for both local and production
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}`;
};

const AdminPanel: React.FC = () => {
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    setConnectionStatus('connecting');
    const ws = new WebSocket(getWebSocketUrl());
    
    ws.onopen = () => {
      console.log('Admin connected to WebSocket');
      setConnectionStatus('connected');
      
      // Register as admin
      ws.send(JSON.stringify({ type: 'register-admin' }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'student-list':
            // Initial list of students
            const initial: Record<string, Student> = {};
            message.students.forEach((s: { id: string; name: string }) => {
              initial[s.id] = {
                id: s.id,
                name: s.name,
                lastFrame: null,
                lastUpdate: Date.now(),
                isActive: true
              };
            });
            setStudents(initial);
            break;
            
          case 'student-joined':
            setStudents(prev => ({
              ...prev,
              [message.studentId]: {
                id: message.studentId,
                name: message.studentName,
                lastFrame: null,
                lastUpdate: Date.now(),
                isActive: true
              }
            }));
            break;
            
          case 'screen-frame':
            setStudents(prev => ({
              ...prev,
              [message.studentId]: {
                ...prev[message.studentId],
                lastFrame: message.frame,
                lastUpdate: message.timestamp,
                isActive: true
              }
            }));
            break;
            
          case 'student-left':
            setStudents(prev => {
              const updated = { ...prev };
              if (updated[message.studentId]) {
                updated[message.studentId] = { ...updated[message.studentId], isActive: false };
              }
              return updated;
            });
            if (selectedStudent === message.studentId) {
              setSelectedStudent(null);
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };
    
    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setConnectionStatus('disconnected');
    };
    
    ws.onclose = () => {
      console.log('WebSocket closed');
      setConnectionStatus('disconnected');
      
      // Try to reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }
      }, 3000);
    };
    
    wsRef.current = ws;
  };

  const activeStudents = Object.values(students).filter(s => s.isActive);
  const selectedStudentData = selectedStudent ? students[selectedStudent] : null;

  // Terminate a student's test
  const terminateStudentTest = (studentId: string, studentName: string) => {
    const reason = window.prompt(
      `⚠️ TERMINATE TEST\n\nYou are about to terminate the test for:\n${studentName}\n\nEnter the reason for termination:`,
      'Malpractice detected during proctoring'
    );

    if (reason === null) return; // User cancelled

    const confirmed = window.confirm(
      `Are you sure you want to terminate the test for ${studentName}?\n\nReason: ${reason}\n\nThis will immediately end their test.`
    );

    if (confirmed && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'terminate-exam',
        studentId: studentId,
        reason: reason
      }));
      console.log(`Sent termination request for student: ${studentId}`);
      alert(`Termination notice sent to ${studentName}`);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🎓 Proctoring Admin Panel</h1>
        <div className="stats">
          <span className={`stat connection-status ${connectionStatus}`}>
            {connectionStatus === 'connected' ? '🟢 Connected' : 
             connectionStatus === 'connecting' ? '🟡 Connecting...' : '🔴 Disconnected'}
          </span>
          <span className="stat">
            <strong>{activeStudents.length}</strong> Active Students
          </span>
        </div>
      </div>

      <div className="admin-content">
        {/* Student List */}
        <div className="students-sidebar">
          <h2>Active Students</h2>
          
          {connectionStatus !== 'connected' ? (
            <div className="no-students">
              <p>⚠️ Connecting to server...</p>
              <p className="hint">Please wait...</p>
            </div>
          ) : activeStudents.length === 0 ? (
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
                <button 
                  className="terminate-btn"
                  onClick={() => terminateStudentTest(selectedStudentData.id, selectedStudentData.name)}
                >
                  🚫 Terminate Test
                </button>
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
