const fs = require('fs');
const content = fs.readFileSync('/Users/gafardgnane/Downloads/icc-webradio-app/src/components/BibleReader.tsx', 'utf8');
const lines = content.split('\n');
let balance = 0;
for (let i = 1526-1; i < 2518; i++) {
  const line = lines[i];
  if (!line) continue;
  const opens = (line.match(/<div(?![^>]*\/>)/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  balance += opens;
  balance -= closes;
  if (opens !== closes) {
     process.stdout.write(`${i+1}:${balance} `);
  }
}
process.stdout.write(`\nFinal balance: ${balance}\n`);
