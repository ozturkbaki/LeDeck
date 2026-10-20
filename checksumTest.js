const bufs = [
  Buffer.from('55AA0001FC0008000000010004000000010001', 'hex'), // HDMI1
  Buffer.from('55AA0001FC00060000000000040000000100', 'hex'), // GetSource
];

for(let b of bufs) {
  let sum = 0;
  for(let i=0; i<b.length; i++) sum += b[i];
  console.log('Hex: ', b.toString('hex'), ' Sum: ', sum.toString(16), ' XOR: ', b.reduce((a,c)=>a^c, 0).toString(16));
}
