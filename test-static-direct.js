import { spawn } from 'child_process';
import http from 'http';

console.log('Testing static server...');

const server = spawn('node', ['dist/static-server.mjs'], {
  env: { ...process.env, PORT: '5080' }
});

server.stdout.on('data', (data) => {
  console.log(`Server: ${data.toString().trim()}`);
});

server.stderr.on('data', (data) => {
  console.error(`Error: ${data.toString().trim()}`);
});

setTimeout(() => {
  const options = {
    hostname: 'localhost',
    port: 5080,
    path: '/',
    method: 'GET',
    headers: { 'User-Agent': 'Test' }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Response length: ${data.length}`);
      console.log(`Contains HTML: ${data.includes('<!DOCTYPE html>')}`);
      console.log(`Contains script: ${data.includes('<script>')}`);
      
      server.kill();
      console.log('Test completed');
    });
  });

  req.on('error', (err) => {
    console.error('Request failed:', err.message);
    server.kill();
  });

  req.end();
}, 3000);

process.on('SIGINT', () => {
  server.kill();
  process.exit();
});