const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
socket.on('message', (msg, rinfo) => {
    console.log('Received length:', msg.length);
    if (msg.length > 24) {
        console.log('JSON:', msg.toString('utf8', 24));
        process.exit(0);
    }
});
socket.bind(16600, () => {
    socket.setBroadcast(true);
    const hex = '41564f4effffffff55888100010000000000000000008f00';
    const PROBE = Buffer.from(hex, 'hex');
    socket.send(PROBE, 0, PROBE.length, 16601, '255.255.255.255');
    console.log('Sent probe from 16600 to 16601...');
});
setTimeout(() => { console.log('Timeout!'); process.exit(0); }, 3000);
