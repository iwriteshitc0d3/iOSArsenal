# 🔐 iOSArsenal

**A trackable, OWASP-aligned checklist for iOS application penetration testing.**

61 vulnerability playbooks — each with attacker rationale, 3–4 real exploitation techniques (with copy-pasteable commands), tools, and mitigation guidance — plus three dedicated reference modules: **jailbreaking a test device**, **jailbreak-detection bypass**, and **SSL/certificate pinning bypass**.

Built as a single-page reference you keep open in the other tab during an engagement, in the spirit of [DroidArsenal](https://github.com/damodarnaik/DroidArsenal) for Android.

![License: MIT](https://img.shields.io/badge/License-MIT-34C7B8.svg)
![Playbooks](https://img.shields.io/badge/Playbooks-61-FF9F0A.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg)

---

## Contents

- [Features](#features)
- [Live demo](#live-demo)
- [Quick start](#quick-start)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [What's inside](#whats-inside)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [Credits](#credits)
- [Disclaimer](#disclaimer)
- [License](#license)

## Features

- **61 playbooks** across the 8 [OWASP MASVS](https://mas.owasp.org/MASVS/) categories — Storage, Cryptography, Auth, Network, Platform, Code Quality, Resilience, Privacy.
- **3–4 exploitation techniques per playbook**, each with an actual runnable command (Frida scripts, `objection` commands, `otool`/`codesign`/`sqlite3` invocations, static-patch workflows) — not just prose steps.
- **Recent/notable vulnerability classes** alongside the evergreen ones: zero-click messaging exploit chains, NSPredicate injection, BLE/AirDrop tracking research, Passkey enrollment gaps, leaked Enterprise-certificate sideloading, Live Activities lock-screen leakage, App Clip scope creep, on-device Core ML model extraction, Screen Time PIN recovery, and Certificate Transparency monitoring gaps.
- **Three technique modules**, each escalating from "one command" to "custom hook" to "permanent binary patch":
  - 🔓 **Jailbreaking a test device** — palera1n, Dopamine, TrollStore
  - 🕵️ **Jailbreak detection bypass** — objection, Frida, jailbroken tweaks, static patching
  - 🔒 **SSL/certificate pinning bypass** — objection, targeted Frida hooks per library, SSL Kill Switch 2, static patching
- **Search, severity filters, and category filters** to narrow the list fast.
- **Per-check "reviewed" tracking** with a live progress bar — state persists locally per browser.
- **No build step, no dependencies.** Plain HTML/CSS/JS — clone it and open `index.html`, or serve it anywhere static files work.

```
https://Savage-hack.github.io/iOSArsenal/
```

## Quick start

```bash
git clone https://github.com/Savage-hack/iOSArsenal.git
cd iOSArsenal
open index.html          # macOS
# or: python3 -m http.server 8000   then visit http://localhost:8000
```

No build tools, no `npm install` — it's plain HTML/CSS/JS

## What's inside

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
- **MASVS/MASTG references** — pointers into the OWASP MAS project (verify against current docs — see the disclaimer)

## Project structure

```
iOSArsenal/
├── index.html        # page shell, markup, meta tags — no content logic
├── style.css          # all styling, including animations/effects
├── data.js            # all playbook + technique-module content (edit this to contribute content)
├── app.js              # rendering, filtering, search, progress tracking, animations
├── CONTRIBUTING.md    # schema + guide for adding new playbooks or techniques
├── LICENSE            # MIT
└── README.md          # you are here
```

Content is deliberately separated from logic: **almost every contribution only touches `data.js`.**

## Contributing

New vulnerability classes get discovered constantly, iOS APIs deprecate, and jailbreak/bypass tooling changes every few months. This project is meant to be kept current by the community.

- Found a stale command or a tool that's since been abandoned? Open a PR.
- Know a newly disclosed vulnerability class that deserves a playbook? Add one.
- Have a cleaner bypass technique for an existing module? Add it alongside the existing ones rather than replacing them — more options is the point.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the data schema and PR guidelines.

## Credits

- [OWASP Mobile Application Security project](https://mas.owasp.org/) — MASVS, MASTG, and MASWE, which this checklist maps against.
- [DroidArsenal](https://github.com/damodarnaik/DroidArsenal) — the Android-side sibling project that inspired this one's format.
- Everyone who files an issue, opens a PR, or points out a stale command.

## Disclaimer

This project is for **authorised security testing only** — applications you own, or are explicitly authorised to assess under a signed engagement, an in-scope bug-bounty program, or your own lab. Never use these techniques against apps or systems you don't have written permission to test.

MASTG/MASWE reference IDs are approximate pointers, not a guaranteed 1:1 mapping — the OWASP MAS project evolves, so cross-check against the live docs before citing them in a formal report. Tooling and iOS versions move quickly; treat every PoC as a starting point to adapt, not a guaranteed one-liner.

## License

[MIT](LICENSE) — see the LICENSE file for details.
