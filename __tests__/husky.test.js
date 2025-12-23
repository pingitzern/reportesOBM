const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

test('husky pre-push hook exists and is configured', () => {
  const hookPath = path.join(repoRoot, '.husky', 'pre-push');
  expect(fs.existsSync(hookPath)).toBe(true);
  const content = fs.readFileSync(hookPath, 'utf8');
  // Pre-push hook should exist and run successfully
  // Note: clasp was disabled during Supabase migration
  expect(content).toMatch(/pre-push/i);
  expect(content).toMatch(/exit 0/);
});
