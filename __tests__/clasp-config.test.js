const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

test('.clasp.json exists and is configured', () => {
  const claspPath = path.join(repoRoot, '.clasp.json');
  expect(fs.existsSync(claspPath)).toBe(true);
  const raw = fs.readFileSync(claspPath, 'utf8');
  const data = JSON.parse(raw);
  expect(data.rootDir).toBe('scripts');
  expect(typeof data.scriptId).toBe('string');
  // If scriptId still the placeholder, allow it only when the workflow will
  // create .clasp.json from the `APPS_SCRIPT_ID` secret (CI path). Otherwise fail.
  if (data.scriptId === 'REPLACE_WITH_YOUR_SCRIPT_ID') {
    const wfPath = path.join(repoRoot, '.github', 'workflows', 'clasp-deploy.yml');
    const wf = fs.readFileSync(wfPath, 'utf8');
    expect(wf).toMatch(/APPS_SCRIPT_ID/);
  } else {
    expect(data.scriptId).not.toBe('REPLACE_WITH_YOUR_SCRIPT_ID');
  }
});

test('there are .gs files in scripts/', () => {
  const scriptsDir = path.join(repoRoot, 'scripts');
  expect(fs.existsSync(scriptsDir)).toBe(true);
  const files = fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.gs'));
  expect(files.length).toBeGreaterThan(0);
});

test('workflow references necessary secrets', () => {
  const wfPath = path.join(repoRoot, '.github', 'workflows', 'clasp-deploy.yml');
  expect(fs.existsSync(wfPath)).toBe(true);
  const wf = fs.readFileSync(wfPath, 'utf8');
  expect(wf).toMatch(/CLASPRC_JSON/);
  expect(wf).toMatch(/APPS_SCRIPT_ID/);
});

test('package.json exposes clasp scripts and husky prepare', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  expect(pkg.scripts['clasp:push']).toBeDefined();
  expect(pkg.scripts['clasp:deploy']).toBeDefined();
  expect(pkg.scripts['prepare']).toBeDefined();
  expect(pkg.devDependencies['husky']).toBeDefined();
});
