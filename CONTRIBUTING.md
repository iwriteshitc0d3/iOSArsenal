# Contributing to iOSArsenal

Thanks for considering a contribution. This project stays useful only if it stays current, and almost every contribution boils down to editing one file: **`data.js`**.

## Before you start

- **Test your commands.** If you're adding or editing a technique, run it against a real (or emulator/simulator, where applicable) test target first. A command that looks plausible but doesn't actually work is worse than no command at all.
- **Keep severity honest.** Don't inflate a Low into a Critical to make an entry stand out.
- **One quote, no reproduction of others' proprietary write-ups.** Paraphrase in your own words; link out to original research/blog posts instead of copying them verbatim.
- **Authorised-use framing stays intact.** Don't add content whose only purpose is attacking systems without authorization (e.g., no zero-day weaponization, no content targeting a specific named company/app).

## Adding a new playbook

Every playbook is one object in the `DATA` array in `data.js`. Copy this template and fill it in:

```js
{
  id:'cat-N',                 // unique id: short category prefix + next free number, e.g. 'auth-10'
  cat:'auth',                 // one of: storage, crypto, auth, network, platform, quality, resilience, privacy
  sev:'high',                 // one of: critical, high, medium, low
  title:'Short, specific title of the weakness',
  masvs:'MASVS-AUTH-1',       // best-fit MASVS control id — see https://mas.owasp.org/MASVS/
  mastg:'Category — Testing Whatever Technique',  // descriptive MASTG chapter/test name (not a numeric ID — see note below)
  summary:'One or two sentences: what the weakness is and why it matters.',
  attacker:'One or two sentences: how this actually gets exploited in practice.',
  methods:[                   // 3–4 techniques, each a real, runnable command
    {title:'Short technique name', cmd:'the actual command(s), \\n-separated for multi-line'},
    {title:'A different tool/approach for the same goal', cmd:'...'},
    {title:'A third approach', cmd:'...'},
  ],
  tools:['Tool A','Tool B','Tool C'],
  mitigation:'One or two sentences: how a developer should actually fix this.',
},
```

**Notes:**
- `id` must be unique across the whole `DATA` array — the app will silently misbehave (duplicate keys) if it isn't.
- `mastg` is a **descriptive label**, not a numeric `MASTG-TEST-XXXX` ID — OWASP's MAS project renumbers these between revisions, and a wrong invented number is worse than a correct descriptive one. If you know the current official test ID and are confident it's stable, feel free to include it in parentheses.
- `cmd` strings use JS template literals (backticks) in `data.js` — if your command contains a backtick or a literal `${`, escape it (`` \` `` / `\${`), and if it needs to contain the literal text `</script>` for some reason, split it (`` `<` + `script>...` ``) so it can't ever be pasted into an inline `<script>` block and break the page.
- Run `node --check data.js` before opening your PR to catch syntax errors early.

## Adding a technique to an existing module

The three technique modules — `JAILBREAKS`, `JBDETECT`, `SSLPIN` — follow a simpler schema:

```js
{
  name:'Tool or technique name',
  tag:'Short descriptor — e.g. "Semi-tethered · checkm8 (A8–A11)"',
  scope:'Optional — device/iOS version scope, only used by JAILBREAKS entries',
  note:'One or two sentences of context — what this is and when to reach for it.',
  methods:[
    {title:'Sub-approach name', cmd:'the actual command(s)'},
    // 1–4 entries
  ],
},
```

Add new entries to the end of the relevant array. If a technique or tool becomes unmaintained/broken, don't delete it outright unless it's genuinely gone — mark it clearly out of date in the `note` field, or open an issue to discuss removal, since some contributors may still be on older tooling.

## Style

- 2-space indentation, single quotes for JS strings, template literals (backticks) only for multi-line `cmd` values.
- Keep `summary`/`attacker`/`mitigation` to 1–2 sentences each — the `methods` block is where the detail lives.
- Keep tone consistent with the rest of the file: direct, technical, no marketing language.

## Pull request checklist

- [ ] `node --check data.js` (or `app.js` if you touched it) passes with no errors
- [ ] New `id` is unique
- [ ] Every command in `methods` has actually been tested against a real target
- [ ] Severity is honest, category is the best fit
- [ ] No proprietary content copied verbatim from another write-up
- [ ] `README.md`'s category-count table updated if you added/removed a playbook

## Reporting issues

Stale command, broken bypass, wrong MASVS mapping, dead tool — open an issue with the playbook `id` and what changed. Even a one-line issue ("checkra1n's site changed, palera1n entry method 2 is outdated") is genuinely useful.
