const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- [ GLOBAL STATE ] ---
let orders = [];
let calls = [];
let jukebox = {
    playlist: [], 
    currentIndex: -1,
    playing: false,
    locked: false,
    volume: 50,
    position: 0,
    defaultQueue: []
};

io.on('connection', (socket) => {
    socket.emit('initial-data', { orders, calls });
    socket.emit('jukebox-update', jukebox);

    // --- [ ORDERS ] ---
    socket.on('new-order', (order) => { 
        orders.push(order); 
        io.emit('order-update', orders); 
        io.emit('kds-ding'); // Trigger sound on KDS
    });

    socket.on('update-order-status', ({ id, status }) => {
        const idx = orders.findIndex(o => o.id === id);
        if (idx !== -1) {
            if (status === 'Complete') orders.splice(idx, 1);
            else orders[idx].status = status;
            io.emit('order-update', orders);
            
            let announceMsg = '';
            if (status === 'ready') announceMsg = `Order ${id} is ready!`;
            if (announceMsg) io.emit('announcement', { id, status, message: announceMsg });
        }
    });

    // --- [ ALERTS ] ---
    socket.on('station-call', (d) => { calls.push(d); io.emit('announcement', { id: 'call', status: 'alert', message: d.type }); });
    socket.on('clear-call', (id) => { calls = calls.filter(c => c.id !== id); });
    socket.on('clear-completed', () => { orders = orders.filter(o => o.status !== 'ready' && o.status !== 'Complete'); io.emit('order-update', orders); });

    // --- [ JUKEBOX ] ---
    socket.on('jukebox-action', (action) => {
        if (jukebox.locked && action.from !== 'Manager') return;

        switch(action.type) {
            case 'add': 
                jukebox.playlist.push({ url: action.url, title: action.title || 'Unknown Track', addedBy: action.from });
                if (jukebox.currentIndex === -1) jukebox.currentIndex = 0;
                break;
            case 'skip':
                if (jukebox.playlist.length > 0) {
                    jukebox.currentIndex = (jukebox.currentIndex + 1) % jukebox.playlist.length;
                    if (jukebox.currentIndex === 0 && !action.loop) jukebox.currentIndex = -1; // End of list
                }
                break;
            case 'toggle': jukebox.playing = action.play; break;
            case 'lock': jukebox.locked = action.lock; break;
            case 'volume': jukebox.volume = action.val; break;
            case 'seek': jukebox.position = action.val; break;
            case 'clear': jukebox.playlist = []; jukebox.currentIndex = -1; jukebox.playing = false; break;
        }
        io.emit('jukebox-update', jukebox);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Base44 Jukebox POS Active on Port ${PORT}`));
