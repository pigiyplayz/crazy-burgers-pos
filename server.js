const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Debug Log: This will show up in your Render "Logs" tab
app.use((req, res, next) => {
    console.log(`Request received for: ${req.url}`);
    next();
});

// Serve everything inside the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// FORCED ROUTE: If the above fails, this sends the file directly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Real-time Logic
let orders = [];
let cleanups = [];
io.on('connection', (socket) => {
    socket.emit('initial-data', { orders, cleanups });
    socket.on('new-order', (order) => { orders.push(order); io.emit('order-update', orders); });
    socket.on('new-cleanup', (c) => { cleanups.push(c); io.emit('cleanup-update', cleanups); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`POS Server Active on Port ${PORT}`));
