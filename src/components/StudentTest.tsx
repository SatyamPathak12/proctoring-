import { useState, useRef, useEffect } from 'react';

interface StudentTestProps {}

const StudentTest: React.FC<StudentTestProps> = () => {
  const [studentName, setStudentName] = useState('');
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  const questions = [
    {
      id: 1,
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid']
    },
    {
      id: 2,
      question: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Mars', 'Jupiter', 'Saturn']
    },
    {
      id: 3,
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6']
    },
    {
      id: 4,
      question: 'Who wrote Romeo and Juliet?',
      options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain']
    },
    {
      id: 5,
      question: 'What is the largest ocean on Earth?',
      options: ['Atlantic', 'Indian', 'Arctic', 'Pacific']
    }
  ];

  useEffect(() => {
    channelRef.current = new BroadcastChannel('proctoring-channel');
    
    return () => {
      if (channelRef.current) {
        // Notify admin that student left
        channelRef.current.postMessage({
          type: 'student-left',
          studentId: studentName
        });
        channelRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [studentName]);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Notify admin that student joined
      channelRef.current?.postMessage({
        type: 'student-joined',
        studentId: studentName,
        studentName: studentName
      });

      // Capture and send frames
      intervalRef.current = window.setInterval(() => {
        captureAndSendFrame();
      }, 500); // Send frame every 500ms

      stream.getVideoTracks()[0].onended = () => {
        handleEndTest();
      };

      setIsTestStarted(true);
    } catch (err) {
      console.error('Error starting screen share:', err);
      alert('Screen sharing is required to take the test. Please try again and allow screen sharing.');
    }
  };

  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) return;

    canvas.width = video.videoWidth / 2;
    canvas.height = video.videoHeight / 2;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const frameData = canvas.toDataURL('image/jpeg', 0.5);
    
    channelRef.current?.postMessage({
      type: 'screen-frame',
      studentId: studentName,
      frame: frameData,
      timestamp: Date.now()
    });
  };

  const handleStartTest = () => {
    if (!studentName.trim()) {
      alert('Please enter your name to start the test');
      return;
    }
    startScreenShare();
  };

  const handleEndTest = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    channelRef.current?.postMessage({
      type: 'student-left',
      studentId: studentName
    });
    setIsTestStarted(false);
    alert('Test submitted successfully!');
  };

  const handleAnswerSelect = (answer: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: answer }));
  };

  if (!isTestStarted) {
    return (
      <div className="student-container">
        <div className="start-test-card">
          <h1>📝 Online Test Portal</h1>
          <p>Enter your name to begin the test. Screen sharing will be required for proctoring.</p>
          
          <div className="input-group">
            <label htmlFor="studentName">Your Name</label>
            <input
              id="studentName"
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          
          <button className="start-btn" onClick={handleStartTest}>
            🚀 Start Test
          </button>
          
          <p className="note">
            ⚠️ You will be asked to share your screen. This is required for test integrity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-container">
      {/* Hidden video and canvas for screen capture */}
      <video ref={videoRef} autoPlay muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="test-header">
        <div className="student-info">
          <span className="recording-indicator">🔴 Recording</span>
          <span>Student: <strong>{studentName}</strong></span>
        </div>
        <div className="progress">
          Question {currentQuestion + 1} of {questions.length}
        </div>
      </div>

      <div className="question-card">
        <h2>Question {currentQuestion + 1}</h2>
        <p className="question-text">{questions[currentQuestion].question}</p>
        
        <div className="options-grid">
          {questions[currentQuestion].options.map((option, idx) => (
            <button
              key={idx}
              className={`option-btn ${answers[currentQuestion] === option ? 'selected' : ''}`}
              onClick={() => handleAnswerSelect(option)}
            >
              {String.fromCharCode(65 + idx)}. {option}
            </button>
          ))}
        </div>

        <div className="navigation-btns">
          <button 
            className="nav-btn prev"
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            ← Previous
          </button>
          
          {currentQuestion < questions.length - 1 ? (
            <button 
              className="nav-btn next"
              onClick={() => setCurrentQuestion(prev => prev + 1)}
            >
              Next →
            </button>
          ) : (
            <button className="nav-btn submit" onClick={handleEndTest}>
              Submit Test ✓
            </button>
          )}
        </div>
      </div>

      <div className="question-palette">
        <h3>Questions</h3>
        <div className="palette-grid">
          {questions.map((_, idx) => (
            <button
              key={idx}
              className={`palette-btn ${answers[idx] ? 'answered' : ''} ${currentQuestion === idx ? 'current' : ''}`}
              onClick={() => setCurrentQuestion(idx)}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentTest;
