const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Logging
app.use((req, res, next) => {
    console.log(`Request received for: ${req.url}`);
    next();
});

// Serve everything inside the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Default entry point
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Real-time State
let orders = [];
let cleanups = [];
let calls = []; // Tracks station-to-station active calls

io.on('connection', (socket) => {
    // Send initial state to newly connected client
    socket.emit('initial-data', { orders, cleanups, calls });

    // Handle New Order
    socket.on('new-order', (order) => { 
        orders.push(order); 
        io.emit('order-update', orders); 
    });

    // Handle Order Status Cycle (pending -> preparing -> ready -> completed)
    socket.on('update-order-status', ({ id, status }) => {
        const idx = orders.findIndex(o => o.id === id);
        if (idx !== -1) {
            orders[idx].status = status;
            io.emit('order-update', orders);
            
            // Trigger specific announcements via socket
            let announceMsg = '';
            if (status === 'preparing') announceMsg = `Order ${id} is now being prepared.`;
            if (status === 'ready') announceMsg = `Order ${id} is ready for pickup!`;
            
            if (announceMsg) {
                io.emit('announcement', { id, status, message: announceMsg, timestamp: Date.now() });
            }
        }
    });

    // Cleanup System
    socket.on('new-cleanup', (c) => { 
        cleanups.push(c); 
        io.emit('cleanup-update', cleanups); 
    });
    
    socket.on('clear-cleanup', (id) => {
        cleanups = cleanups.filter(c => c.id !== id);
        io.emit('cleanup-update', cleanups);
    });

    // Station Call System
    socket.on('station-call', (callData) => {
        // callData might be { id: 123, from: 'POS 1', type: 'Manager Needed' }
        calls.push(callData);
        io.emit('call-update', calls);
        io.emit('announcement', { id: 'call', status: 'alert', message: callData.type });
    });

    socket.on('clear-call', (id) => {
        calls = calls.filter(c => c.id !== id);
        io.emit('call-update', calls);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Base44 Clone Server Active on Port ${PORT}`));
