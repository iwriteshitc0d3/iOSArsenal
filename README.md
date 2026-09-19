# 🔐 iOSArsenal

**A trackable, OWASP-aligned checklist and REST API engine for iOS application penetration testing.**

61 vulnerability playbooks — each with attacker rationale, 3–4 real exploitation techniques (with copy-pasteable commands), tools, and mitigation guidance — plus three dedicated reference modules: **jailbreaking a test device**, **jailbreak-detection bypass**, and **SSL/certificate pinning bypass**.

Now equipped with a **RESTful API engine** (Node.js/Express), a **declarative client-side router** supporting deep-linking and browser history, an **interactive in-app API Query Explorer**, and transparent offline/static fallback for GitHub Pages.

![License: MIT](https://img.shields.io/badge/License-MIT-34C7B8.svg)
![Playbooks](https://img.shields.io/badge/Playbooks-61-FF9F0A.svg)
![API: REST](https://img.shields.io/badge/API-RESTful-34C7B8.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg)

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [REST API Engine](#rest-api-engine)
  - [Endpoints](#endpoints)
  - [Query Parameters & Filtering](#query-parameters--filtering)
  - [Interactive API Explorer](#interactive-api-explorer)
- [Client Router & Deep Linking](#client-router--deep-linking)
- [Project Structure](#project-structure)
- [What's Inside](#whats-inside)
- [Contributing](#contributing)
- [Credits](#credits)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Features

- **61 playbooks** across the 8 [OWASP MASVS](https://mas.owasp.org/MASVS/) categories — Storage, Cryptography, Auth, Network, Platform, Code Quality, Resilience, Privacy.
- **3–4 exploitation techniques per playbook**, each with an actual runnable command (Frida scripts, `objection` commands, `otool`/`codesign`/`sqlite3` invocations, static-patch workflows) — not just prose steps.
- **RESTful API Engine**: Built on Node.js / Express, providing full programmatic JSON access to playbooks, categories, modules, review state, and exports.
- **Declarative Client-Side Router**: Supports deep links (`#/playbook/stor-2`, `#/category/auth?sev=critical`), browser history back/forward navigation, and view switching.
- **Interactive In-App API Explorer**: Test API queries directly inside the UI, view live JSON responses, and copy ready-to-run `curl` commands.
- **Hybrid Online/Offline Resilience**: If running without the Node.js server (e.g., opened via `file://` or hosted statically on GitHub Pages), the client-side API engine automatically falls back to in-memory `data.js` and `localStorage`.
- **Three technique modules**, each escalating from "one command" to "custom hook" to "permanent binary patch":
  - 🔓 **Jailbreaking a test device** — palera1n, Dopamine, TrollStore
  - 🕵️ **Jailbreak detection bypass** — objection, Frida, jailbroken tweaks, static patching
  - 🔒 **SSL/certificate pinning bypass** — objection, targeted Frida hooks per library, SSL Kill Switch 2, static patching
- **Per-check "reviewed" tracking** with a live progress bar — synced via `/api/reviewed` and persisted locally.

---

## Quick start

### Running with the API Engine (Recommended)

```bash
git clone https://github.com/iwriteshitc0d3/iOSArsenal.git
cd iOSArsenal

# Install dependencies
npm install

# Run automated API test suite
npm test

# Start the server
npm start
```

Visit **`http://localhost:3000`** in your browser to access the UI and API.

### Running in Standalone / Static Mode

You can also run iOSArsenal purely as a static website without Node.js:
```bash
python3 -m http.server 8000
# or simply double-click index.html
```
The application will automatically detect that the backend server is offline and transition into Standalone Mode, evaluating queries using the client-side fallback engine.

---

## REST API Engine

The API engine mounts under `/api` and outputs structured JSON responses with standard status codes.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api` | Root directory and documentation of all available endpoints |
| `GET` | `/api/stats` | Summary statistics (playbooks, categories, review progress, severity breakdown) |
| `GET` | `/api/categories` | List all MASVS categories with check counts and icon classes |
| `GET` | `/api/categories/:key` | Category metadata and all associated playbooks |
| `GET` | `/api/playbooks` | Query playbooks with full search, filters, and sorting |
| `GET` | `/api/playbooks/:id` | Single playbook details, multi-technique commands, and mitigations |
| `GET` | `/api/modules` | Summary and listing of all deep-dive reference modules |
| `GET` | `/api/modules/:type` | Specific module collection (`jailbreaks`, `jbdetect`, `sslpin`) |
| `GET` | `/api/reviewed` | Get current map of reviewed checks |
| `POST` | `/api/reviewed` | Update reviewed status for an ID or batch |
| `DELETE` | `/api/reviewed` | Reset all reviewed checks |
| `GET` | `/api/export` | Complete dump of categories, playbooks, and modules as JSON |

### Query Parameters & Filtering

Filter and search playbooks flexibly using `GET /api/playbooks`:

- **Category**: `?cat=storage` or comma-separated `?cat=storage,crypto`
- **Severity**: `?sev=critical` or `?sev=high,critical`
- **Search**: `?q=keychain` (searches across title, summary, rationale, commands, and mitigations)
- **Tool**: `?tool=objection` or `?tool=frida`
- **Sort**: `?sort=sev` (critical to low), `?sort=title`, or `?sort=id` (prefix `-` for descending)
- **Pagination**: `?limit=10&offset=0`

#### Example cURL Requests

```bash
# Get summary stats
curl -s http://localhost:3000/api/stats | jq .

# Find all critical authentication playbooks
curl -s "http://localhost:3000/api/playbooks?cat=auth&sev=critical" | jq .

# Search for Frida scripts
curl -s "http://localhost:3000/api/playbooks?q=frida" | jq '.data[].title'

# Fetch a single playbook
curl -s http://localhost:3000/api/playbooks/stor-2 | jq .
```

### Interactive API Explorer

Navigate to the **REST API & Explorer** tab (`#/api-docs`) in the navigation bar to interactively execute queries, view formatted JSON responses, and copy ready-to-use cURL commands without leaving the UI.

---

## Client Router & Deep Linking

iOSArsenal includes a declarative hash router (`router.js`) that supports instant navigation, deep linking, and browser back/forward history:

- `#/`: Main checklist view
- `#/categories`: Jump to MASVS category overview
- `#/category/:cat`: Filter checks to a specific category (e.g. `#/category/network`)
- `#/playbook/:id`: Open and highlight a specific playbook (e.g. `#/playbook/stor-1`)
- `#/modules`: Jump to deep-dive guides
- `#/modules/:type`: Jump to `jailbreaks`, `jbdetect`, or `sslpin`
- `#/api-docs`: Open the interactive API documentation and query runner

Shareable links can be copied directly from each playbook card using the 🔗 button.

---

## Project Structure

```
iOSArsenal/
├── index.html        # Page shell, navbar, view panes, and meta tags
├── style.css         # Styling, dark cyber theme, animations, and API UI
├── data.js           # Playbooks + bypass modules (exports for Node & browser)
├── app.js            # UI logic, state management, and API explorer runner
├── api-client.js     # Frontend API Client with transparent offline fallback
├── router.js         # Client-side router supporting deep-linking & history
├── server.js         # Express web server & static asset host
├── routes/
│   └── api.js        # RESTful API Engine router
├── test/
│   └── api.test.js   # Automated integration test suite for API endpoints
├── package.json      # Dependencies and run scripts (start, dev, test)
├── CONTRIBUTING.md   # Schema + guide for adding new playbooks or techniques
├── LICENSE           # MIT
└── README.md         # Documentation
```

---

## What's Inside

| Category | Playbooks |
|---|---|
| Storage | 7 |
| Cryptography | 5 |
| Auth | 9 |
| Network | 6 |
| Platform | 12 |
| Code Quality | 10 |
| Resilience | 7 |
| Privacy | 5 |
| **Total** | **61** |

Each playbook includes:
- **Summary** — what the weakness is and why it matters
- **Attacker rationale** — how it actually gets exploited
- **Exploitation PoC** — 3–4 techniques, each with a real command
- **Tools** — what you'd need installed
- **Mitigation** — how a developer should fix it
- **MASVS/MASTG references** — pointers into the OWASP MAS project

---

## Contributing

Contributions are welcome! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for data schema and pull request guidelines.

---

## Credits

- [OWASP Mobile Application Security project](https://mas.owasp.org/) — MASVS, MASTG, and MASWE.
- [DroidArsenal](https://github.com/damodarnaik/DroidArsenal) — the Android-side sibling project that inspired this one's format.

---

## Disclaimer

This project is for **authorised security testing only** — applications you own, or are explicitly authorised to assess under a signed engagement, an in-scope bug-bounty program, or your own lab. Never use these techniques against apps or systems you don't have written permission to test.

---

## License

[MIT](LICENSE) — see the LICENSE file for details.
