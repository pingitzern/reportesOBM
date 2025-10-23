Test remitos archived (remitos-reset branch)

This document explains how to publish a test deployment of the Apps Script project and verify that the remitos handlers return the archived response.

Preconditions
- You must have clasp installed and authenticated.
- You should be on the `remitos-reset` branch (this repo already has the router neutralized in that branch).

Steps
1. Push code to Apps Script (uses .clasp.json in repo):

```powershell
clasp push --force
```

2. Create a new version and deploy as web app (make note of the URL):

```powershell
clasp version "remitos-reset test"
$ver = (clasp versions --json) # use appropriate command to get version id
clasp deploy --deploymentId <existing> --description "remitos-reset test" # or use clasp deploy webapp
```

3. Run the test script (PowerShell):

```powershell
# Replace URL with web app URL returned by deploy
.
\scripts\test-remitos-archived.ps1 -Url 'https://script.google.com/macros/s/AKfy.../exec' -Token '<session-token-if-you-have-one>'
```

Expected result
- The script will POST action `crear_remito` and the API should reply with JSON containing `{ archived: true, message: 'Remitos functionality archived...' }`.

Notes
- If you don't have clasp or prefer manual deployment, open the Apps Script project in the editor and create a new deployment (web app) pointing to the current code.
- The script uses `Content-Type: text/plain; charset=utf-8` to match the router expectations.
