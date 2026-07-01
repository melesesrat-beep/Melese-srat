const { execSync } = require('child_process');
try {
  execSync('git checkout src/App.tsx', { stdio: 'inherit' });
  console.log('SUCCESS: src/App.tsx restored from git.');
} catch (err) {
  console.error('ERROR: Failed to restore:', err);
}
