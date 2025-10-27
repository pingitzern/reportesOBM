const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

test('husky pre-push hook exists and runs clasp push', () => {
  const hookPath = path.join(repoRoot, '.husky', 'pre-push');
  expect(fs.existsSync(hookPath)).toBe(true);
  const content = fs.readFileSync(hookPath, 'utf8');
  // should call clasp push (via npx) to sync scripts
  expect(content).toMatch(/clasp push/);
  expect(content).toMatch(/@google\/clasp/);
});
