const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
socket.on('message', (msg, rinfo) => {
    console.log('Received broadcast from:', rinfo.address, 'length:', msg.length);
    if (msg.length > 24) {
        console.log('JSON:', msg.toString('utf8', 24));
        process.exit(0);
    }
});
socket.bind(16600, () => {
    console.log('Listening for passive broadcast on 16600...');
});
setTimeout(() => { console.log('Timeout!'); process.exit(0); }, 15000);
