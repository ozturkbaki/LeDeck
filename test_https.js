const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
https.get({
    hostname: '192.168.42.129',
    port: 16674,
    path: '/terminal/core/v1/version',
    agent: agent
}, (res) => {
    let body = '';
    res.on('data', d => body+=d);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
}).on('error', e => console.error(e));
