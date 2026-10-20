const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
socket.on('message', (msg, rinfo) => {
    console.log('Received:', msg.toString());
    process.exit(0);
});
socket.bind(() => {
    socket.setBroadcast(true);
    const PROBE = Buffer.from('{"type":"search"}');
    socket.send(PROBE, 0, PROBE.length, 9999, '255.255.255.255');
    console.log('Sent probe to 9999...');
});
setTimeout(() => { console.log('Timeout!'); process.exit(0); }, 3000);
