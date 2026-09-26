const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'dist', 'esm');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');
