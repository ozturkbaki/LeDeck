const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
socket.on('message', (msg, rinfo) => {
    console.log('Received length:', msg.length);
    console.log('Received hex:', msg.toString('hex', 0, 32));
    
    // The JSON starts after the 24 byte header
    if (msg.length > 24) {
        console.log('JSON:', msg.toString('utf8', 24));
    }
    process.exit(0);
});
socket.bind(() => {
    socket.setBroadcast(true);
    // Payload from user's packet capture:
    const hex = '41564f4effffffff55888100010000000000000000008f00';
    const PROBE = Buffer.from(hex, 'hex');
    socket.send(PROBE, 0, PROBE.length, 16610, '255.255.255.255');
    console.log('Sent AVON probe to 16610...');
});
setTimeout(() => { console.log('Timeout!'); process.exit(0); }, 3000);
