// Force deployment trigger script
const fs = require('fs');
const path = require('path');

// Create a timestamp file to trigger deployment
const timestamp = new Date().toISOString();
const triggerFile = path.join(__dirname, 'deployment-trigger.txt');

fs.writeFileSync(triggerFile, `Deployment triggered at: ${timestamp}\n`);

console.log('✅ Deployment trigger file created');
console.log('📝 File:', triggerFile);
console.log('⏰ Timestamp:', timestamp);
console.log('');
console.log('🚀 Next steps:');
console.log('1. Commit this change: git add . && git commit -m "Trigger deployment"');
console.log('2. Push to GitHub: git push origin main');
console.log('3. This should trigger automatic deployment on Railway and Vercel');
