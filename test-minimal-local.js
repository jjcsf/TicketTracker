const { spawn } = require('child_process');
const http = require('http');

console.log('Testing minimal container locally...');

// Start the server
const server = spawn('node', ['dist/minimal-app.js'], {
  env: { ...process.env, PORT: '5060' }
});

server.stdout.on('data', (data) => {
  console.log(`Server: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`Server Error: ${data}`);
});

// Test after 3 seconds
setTimeout(() => {
  console.log('Testing API endpoint...');
  
  const req = http.request({
    hostname: 'localhost',
    port: 5060,
    path: '/api/test',
    method: 'GET'
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('API Response:', data);
      
      // Test HTML page
      const htmlReq = http.request({
        hostname: 'localhost',
        port: 5060,
        path: '/',
        method: 'GET'
      }, (htmlRes) => {
        let htmlData = '';
        htmlRes.on('data', chunk => htmlData += chunk);
        htmlRes.on('end', () => {
          console.log('HTML Page Length:', htmlData.length);
          console.log('Contains Season Ticket Manager:', htmlData.includes('Season Ticket Manager'));
          
          server.kill();
          console.log('Test completed successfully!');
        });
      });
      
      htmlReq.on('error', (err) => {
        console.error('HTML test failed:', err);
        server.kill();
      });
      
      htmlReq.end();
    });
  });
  
  req.on('error', (err) => {
    console.error('API test failed:', err);
    server.kill();
  });
  
  req.end();
}, 3000);

// Cleanup on exit
process.on('SIGINT', () => {
  server.kill();
  process.exit();
});