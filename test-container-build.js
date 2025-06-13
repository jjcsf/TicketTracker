// Test the built JavaScript bundle for container execution issues
const fs = require('fs');
const path = require('path');

console.log('[TEST] Starting container build verification...');

// Check if built files exist
const distPath = path.join(__dirname, 'dist', 'public');
const indexPath = path.join(distPath, 'index.html');
const jsPath = path.join(distPath, 'assets');

console.log('[TEST] Checking file structure:');
console.log('  dist/public exists:', fs.existsSync(distPath));
console.log('  index.html exists:', fs.existsSync(indexPath));
console.log('  assets folder exists:', fs.existsSync(jsPath));

if (fs.existsSync(jsPath)) {
  const assets = fs.readdirSync(jsPath);
  console.log('  assets contents:', assets);
}

// Read and analyze index.html
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  console.log('[TEST] index.html content:');
  console.log(indexContent);
  
  // Check for external scripts that might fail
  const hasExternalScripts = indexContent.includes('http://') || indexContent.includes('https://');
  console.log('[TEST] Has external scripts:', hasExternalScripts);
  
  // Extract JS file reference
  const jsMatch = indexContent.match(/src="([^"]+\.js)"/);
  if (jsMatch) {
    const jsFile = jsMatch[1].replace('/', '');
    const jsFilePath = path.join(distPath, jsFile);
    console.log('[TEST] JS file reference:', jsFile);
    console.log('[TEST] JS file exists:', fs.existsSync(jsFilePath));
    
    if (fs.existsSync(jsFilePath)) {
      const jsContent = fs.readFileSync(jsFilePath, 'utf8');
      const jsSize = jsContent.length;
      console.log('[TEST] JS file size:', jsSize, 'characters');
      
      // Check for import.meta.env in built file
      const hasImportMeta = jsContent.includes('import.meta.env');
      console.log('[TEST] Contains import.meta.env:', hasImportMeta);
      
      // Check for VITE_AUTH_TYPE references
      const hasAuthType = jsContent.includes('VITE_AUTH_TYPE');
      console.log('[TEST] Contains VITE_AUTH_TYPE:', hasAuthType);
      
      // Check for console.log statements from our debugging
      const hasDebugLogs = jsContent.includes('[main]');
      console.log('[TEST] Contains debug logs:', hasDebugLogs);
      
      // Look for potential syntax errors (basic check)
      const hasSyntaxIssues = jsContent.includes('undefined') && jsContent.includes('TypeError');
      console.log('[TEST] Potential syntax issues:', hasSyntaxIssues);
    }
  }
}

console.log('[TEST] Verification complete.');