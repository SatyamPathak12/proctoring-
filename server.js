import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from the dist folder (production build)
app.use(express.static(path.join(__dirname, 'dist')));

// Store connected clients
const students = new Map(); // studentId -> ws
const admins = new Set(); // Set of admin websockets

console.log('🚀 Proctoring WebSocket Server Starting...');

wss.on('connection', (ws) => {
  console.log('New connection established');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'register-admin':
          admins.add(ws);
          ws.isAdmin = true;
          console.log('✅ Admin connected. Total admins:', admins.size);
          
          // Send current student list to new admin
          const studentList = [];
          students.forEach((studentWs, studentId) => {
            studentList.push({
              id: studentId,
              name: studentWs.studentName
            });
          });
          ws.send(JSON.stringify({
            type: 'student-list',
            students: studentList
          }));
          break;
          
        case 'register-student':
          ws.studentId = message.studentId;
          ws.studentName = message.studentName;
          ws.examId = message.examId || null;
          ws.examName = message.examName || 'Unknown Exam';
          students.set(message.studentId, ws);
          console.log(`✅ Student "${message.studentName}" connected for exam "${message.examName}". Total students:`, students.size);
          
          // Notify all admins about new student
          admins.forEach(adminWs => {
            if (adminWs.readyState === 1) {
              adminWs.send(JSON.stringify({
                type: 'student-joined',
                studentId: message.studentId,
                studentName: message.studentName,
                examId: message.examId,
                examName: message.examName
              }));
            }
          });
          break;
          
        case 'screen-frame':
          // Forward screen frame to all admins
          console.log(`📸 Received frame from ${message.studentId}, forwarding to ${admins.size} admins`);
          admins.forEach(adminWs => {
            if (adminWs.readyState === 1) {
              adminWs.send(JSON.stringify({
                type: 'screen-frame',
                studentId: message.studentId,
                frame: message.frame,
                timestamp: message.timestamp
              }));
            }
          });
          break;
          
        case 'student-left':
          students.delete(message.studentId);
          console.log(`👋 Student "${message.studentId}" left. Remaining students:`, students.size);
          
          // Notify all admins
          admins.forEach(adminWs => {
            if (adminWs.readyState === 1) {
              adminWs.send(JSON.stringify({
                type: 'student-left',
                studentId: message.studentId
              }));
            }
          });
          break;
          
        case 'terminate-exam':
          // Admin wants to terminate a student's exam
          console.log(`🚫 Admin terminating exam for student: ${message.studentId}, reason: ${message.reason}`);
          const studentWs = students.get(message.studentId);
          if (studentWs && studentWs.readyState === 1) {
            studentWs.send(JSON.stringify({
              type: 'exam-terminated',
              reason: message.reason || 'Exam terminated by administrator due to policy violation.'
            }));
            console.log(`✅ Termination notice sent to student ${message.studentId}`);
          } else {
            console.log(`⚠️ Student ${message.studentId} not found or disconnected`);
          }
          break;
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  ws.on('close', () => {
    if (ws.isAdmin) {
      admins.delete(ws);
      console.log('👋 Admin disconnected. Total admins:', admins.size);
    } else if (ws.studentId) {
      students.delete(ws.studentId);
      console.log(`👋 Student "${ws.studentName}" disconnected. Remaining students:`, students.size);
      
      // Notify all admins
      admins.forEach(adminWs => {
        if (adminWs.readyState === 1) {
          adminWs.send(JSON.stringify({
            type: 'student-left',
            studentId: ws.studentId
          }));
        }
      });
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// Handle all routes for SPA (Single Page Application)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
});
