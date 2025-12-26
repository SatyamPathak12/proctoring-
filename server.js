const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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
          students.set(message.studentId, ws);
          console.log(`✅ Student "${message.studentName}" connected. Total students:`, students.size);
          
          // Notify all admins about new student
          admins.forEach(adminWs => {
            if (adminWs.readyState === 1) {
              adminWs.send(JSON.stringify({
                type: 'student-joined',
                studentId: message.studentId,
                studentName: message.studentName
              }));
            }
          });
          break;
          
        case 'screen-frame':
          // Forward screen frame to all admins
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

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WebSocket Server running on port ${PORT}`);
  console.log(`📡 Students and Admins can connect via ws://YOUR_IP:${PORT}`);
});
