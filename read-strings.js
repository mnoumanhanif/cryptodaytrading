const fs = require('fs');
const file = 'C:/Users/HP-PC/.gemini/antigravity-ide/conversations/109c5c63-06dd-45f2-898d-4b85abf0eb95.pb';
try {
  const buf = fs.readFileSync(file);
  let nonZeroIndex = -1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0) {
      nonZeroIndex = i;
      break;
    }
  }
  console.log('First non-zero byte index:', nonZeroIndex);
  if (nonZeroIndex !== -1) {
    console.log('Header at non-zero:', buf.slice(nonZeroIndex, nonZeroIndex + 100).toString('hex'));
    console.log('Text at non-zero:', buf.slice(nonZeroIndex, nonZeroIndex + 100).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
  }
} catch (e) {
  console.error(e);
}
