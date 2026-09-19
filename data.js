const CATS = [
  {key:'storage',   name:'Storage',      icon:'🗄️', cls:'ic-storage'},
  {key:'crypto',    name:'Cryptography', icon:'🔐', cls:'ic-crypto'},
  {key:'auth',      name:'Auth',         icon:'🪪', cls:'ic-auth'},
  {key:'network',   name:'Network',      icon:'🌐', cls:'ic-network'},
  {key:'platform',  name:'Platform',     icon:'🧩', cls:'ic-platform'},
  {key:'quality',   name:'Code Quality', icon:'🧪', cls:'ic-quality'},
  {key:'resilience',name:'Resilience',   icon:'🛡️', cls:'ic-resilience'},
  {key:'privacy',   name:'Privacy',      icon:'🕊️', cls:'ic-privacy'},
];

const DATA = [
{id:'stor-1',cat:'storage',sev:'high',title:'Sensitive data cached in NSUserDefaults / plist files',
 masvs:'MASVS-STORAGE-1',mastg:'iOS Data Storage — Testing Local Data Storage',
 summary:'Tokens, PII, or credentials written to NSUserDefaults or a custom .plist end up in plaintext on the filesystem, readable by anyone with device access.',
 attacker:'On a jailbroken device (or via a backup extraction on non-jailbroken devices) an attacker reads Preferences/*.plist directly — no exploit needed, just filesystem access. NSUserDefaults is never encrypted by the OS.',
  methods:[{title:'objection',cmd:`objection -g "com.example.app" explore
> ios nsuserdefaults get`},{title:'SSH + plutil (jailbroken)',cmd:`ssh root@<device_ip>
cat /var/mobile/Containers/Data/Application/<UUID>/Library/Preferences/com.example.app.plist | plutil -convert xml1 - -o -`},{title:'Offline backup extraction',cmd:`idevicebackup2 backup --full ./backup
find ./backup -iname "*.plist" -exec plutil -p {} \\;`},{title:'Frida hook on write',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.NSUserDefaults['- setObject:forKey:'].implementation,{onEnter(a){console.log('SET',new ObjC.Object(a[3]).toString())}})"`}],
 tools:['objection','idevicebackup2 / libimobiledevice','plutil','Filza (jailbroken)'],
 mitigation:'Never store secrets, tokens, or PII in NSUserDefaults. Use Keychain Services with an appropriate kSecAttrAccessible class, and encrypt any non-Keychain sensitive data at rest with a key that never itself touches disk unencrypted.'},

{id:'stor-2',cat:'storage',sev:'critical',title:'Keychain item stored with an overly permissive accessibility class',
 masvs:'MASVS-STORAGE-1',mastg:'iOS Data Storage — Testing the Keychain',
 summary:'Items saved with kSecAttrAccessibleAlways (deprecated) or without ThisDeviceOnly remain readable even when the device is locked, or get restored to a new device via backup.',
 attacker:'A stolen/locked device, or a restored iTunes/iCloud backup on attacker-controlled hardware, can still yield the Keychain item if the accessibility flag doesn\'t tie it to "this device, unlocked."',
  methods:[{title:'objection keychain dump',cmd:`objection -g "com.example.app" explore
> ios keychain dump`},{title:'Keychain-Dumper (jailbroken)',cmd:`./keychain_dumper -a > keychain_dump.txt`},{title:'Frida hook SecItemAdd',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(Module.findExportByName('Security','SecItemAdd'),{onEnter(a){console.log('SecItemAdd called')}})"`},{title:'Backup Keychain domain parse',cmd:`idevicebackup2 backup --full ./backup
python3 -m iOSbackup ./backup  # list Keychain domain entries`}],
 tools:['objection','Keychain-Dumper','idevicebackup2'],
 mitigation:'Use kSecAttrAccessibleWhenUnlockedThisDeviceOnly (or AfterFirstUnlockThisDeviceOnly only when background access is genuinely required) and set kSecAttrAccessControl with biometry/passcode for high-value secrets.'},

{id:'stor-3',cat:'storage',sev:'medium',title:'Unencrypted sensitive data in Documents / Library (SQLite, Core Data, Realm)',
 masvs:'MASVS-STORAGE-1',mastg:'iOS Data Storage — Testing File System Data',
 summary:'Local databases written without SQLCipher/Realm encryption or without Data Protection classes store business or personal data as plaintext files.',
 attacker:'Filesystem access (jailbreak, or an insecure backup) lets an attacker open the .sqlite/.realm file directly with a generic viewer — no app logic required.',
  methods:[{title:'sqlite3 direct',cmd:`sqlite3 app.db ".tables"
sqlite3 app.db "select * from users;"`},{title:'objection sqlite',cmd:`objection -g "com.example.app" explore
> ios sqlite connect app.db
> .tables
> select * from users;`},{title:'Realm Studio (GUI)',cmd:`Open the extracted default.realm file in Realm Studio and browse objects.`},{title:'Filesystem grep sweep',cmd:`grep -R "password" /var/mobile/Containers/Data/Application/<UUID>/ 2>/dev/null`}],
 tools:['sqlite3 / DB Browser for SQLite','objection','Realm Studio (for .realm files)'],
 mitigation:'Enable NSFileProtectionComplete on sensitive files, encrypt the database (SQLCipher, or Realm with a Keychain-derived key), and avoid persisting derived secrets that don\'t need to live on disk at all.'},

{id:'stor-4',cat:'storage',sev:'medium',title:'Sensitive files included in iTunes / iCloud backup',
 masvs:'MASVS-STORAGE-2',mastg:'iOS Data Storage — Testing Backups',
 summary:'Files that should never leave the device (session material, cached auth tokens, cryptographic key material) are swept into backups because they weren\'t excluded.',
 attacker:'An attacker with temporary physical/USB access takes an unencrypted backup, or compromises a synced iCloud account, and extracts the full app data domain offline at leisure.',
  methods:[{title:'Unencrypted backup + Manifest.db',cmd:`idevicebackup2 backup --full ./backup
sqlite3 ./backup/Manifest.db "select fileID,relativePath from Files where domain like '%com.example.app%';"`},{title:'iMazing / iExplorer (GUI)',cmd:`Open the device backup in iMazing, browse the app data domain, export files of interest.`},{title:'Exclusion-flag check',cmd:`find /var/mobile/Containers/Data/Application/<UUID>/ -exec bash -c 'xattr -p com.apple.MobileBackup "$0" 2>/dev/null' {} \\;`},{title:'Restore-and-inspect',cmd:`idevicebackup2 restore --system ./backup
# then inspect the restored container on a throwaway test device`}],
 tools:['idevicebackup2','iMazing / iExplorer','Manifest.db SQLite viewer'],
 mitigation:'Set NSURLIsExcludedFromBackupKey on any file containing session state, cached credentials, or key material; keep genuinely sensitive material in the Keychain, which is excluded from unencrypted backups by default.'},

{id:'stor-5',cat:'storage',sev:'low',title:'Sensitive data leaked via os_log / NSLog / print statements',
 masvs:'MASVS-STORAGE-3',mastg:'iOS Data Storage — Testing Logs',
 summary:'Debug logging left in production surfaces tokens, request/response bodies, or PII in the unified log, retrievable long after the app runs.',
 attacker:'Anyone with the device connected, or a local malicious app with log-reading entitlements, harvests console output that developers assumed was ephemeral.',
  methods:[{title:'Live syslog stream',cmd:`idevicesyslog | grep -iE "token|password|session"`},{title:'Console.app log stream',cmd:`log stream --predicate 'process == "App"' --info`},{title:'Xcode device console',cmd:`Window > Devices and Simulators > select device > Open Console, filter by process name.`},{title:'frida-trace on NSLog',cmd:`frida-trace -U -f com.example.app -i "NSLog"`}],
 tools:['Console.app','libimobiledevice `idevicesyslog`','Xcode device console'],
 mitigation:'Strip or gate verbose logging behind DEBUG builds only, and never log full request/response bodies, tokens, or PII even at debug level in shared codebases.'},

{id:'stor-6',cat:'storage',sev:'low',title:'Sensitive content exposed via app-switcher (background) snapshot',
 masvs:'MASVS-STORAGE-4',mastg:'iOS Data Storage — Testing for Sensitive Data Disclosure Through the User Interface',
 summary:'iOS snapshots the current screen when an app backgrounds; without a privacy overlay, that snapshot can show account numbers, messages, or auth screens in the multitasking switcher.',
 attacker:'A shoulder-surfer or someone who briefly holds the unlocked device double-taps home / swipes up and sees the last visible screen in plain view.',
  methods:[{title:'Manual app-switcher check',cmd:`Navigate to sensitive screen -> background app (swipe up) -> open App Switcher -> inspect thumbnail.`},{title:'Xcode View Debugger',cmd:`Debug > View Debugging > Capture View Hierarchy while backgrounding, confirm a cover view is (not) inserted.`},{title:'class-dump for masking logic',cmd:`class-dump App -o headers/
grep -ri "background" headers/*.h`},{title:'XCUITest automated capture',cmd:`let app = XCUIApplication(); app.launch()
XCUIDevice.shared.press(.home)
let shot = XCUIScreen.main.screenshot()  // inspect for sensitive content`}],
 tools:['Manual inspection — no tooling required'],
 mitigation:'Implement applicationDidEnterBackground to swap in a blank/branded cover view (or blur the content) before the snapshot is taken, and restore the real view in applicationWillEnterForeground.'},

{id:'cry-1',cat:'crypto',sev:'high',title:'Custom or hand-rolled cryptography instead of CryptoKit / CommonCrypto',
 masvs:'MASVS-CRYPTO-1',mastg:'Cryptography — Testing Cryptographic Standard Algorithms',
 summary:'Developer-written XOR "encryption," homegrown ciphers, or copy-pasted crypto code frequently contain fatal design flaws that peer-reviewed libraries avoid.',
 attacker:'Static analysis of the binary or Swift source quickly reveals a non-standard cipher; the attacker then reverse-engineers the scheme (often trivial for XOR/rolling-key designs) and forges or decrypts data at will.',
  methods:[{title:'strings sweep',cmd:`strings App | grep -iE "encrypt|xor|obfuscate"`},{title:'class-dump for crypto method names',cmd:`class-dump App -o headers/
grep -ri "encrypt\\|decrypt\\|obfuscate" headers/*.h`},{title:'frida-trace on suspected function',cmd:`frida-trace -U -f com.example.app -i "*encrypt*" -i "*Crypt*"`},{title:'Static disassembly (Ghidra)',cmd:`Open the Mach-O in Ghidra, locate the custom crypto routine, review the algorithm logic instruction-by-instruction.`}],
 tools:['Hopper Disassembler / Ghidra','Frida','class-dump'],
 mitigation:'Only use vetted primitives from CryptoKit (or CommonCrypto for legacy needs) with standard, current algorithms (AES-GCM, ChaCha20-Poly1305) — never invent a cipher.'},

{id:'cry-2',cat:'crypto',sev:'critical',title:'Hardcoded encryption keys or IVs embedded in the app binary',
 masvs:'MASVS-CRYPTO-1',mastg:'Cryptography — Testing Key Management',
 summary:'A symmetric key or static IV baked into source/strings makes every install\'s "encrypted" data trivially decryptable once the key is extracted once.',
 attacker:'The attacker extracts the string constant from the Mach-O binary once, and that single key decrypts data across every install of the app, past and future.',
  methods:[{title:'strings sweep',cmd:`strings App | grep -iE "key|secret|iv"`},{title:'radare2 string scan',cmd:`rabin2 -z App | grep -i key`},{title:'Frida hook on CCCrypt',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(Module.findExportByName(null,'CCCrypt'),{onEnter(a){console.log('key ptr', a[3])}})"`},{title:'Cross-version binary diff',cmd:`r2 -A App1
[0x00000000]> /x <suspected_key_hex>
# repeat against App2 to confirm the constant is static across releases`}],
 tools:['strings / rabin2','Hopper Disassembler','Frida (to confirm key usage at runtime)'],
 mitigation:'Never embed static keys in source or binary. Generate keys at runtime and store them in the Secure Enclave / Keychain, or derive them per-install/per-session from a value that never ships in the binary.'},

{id:'cry-3',cat:'crypto',sev:'high',title:'Weak or deprecated algorithms and modes (DES, MD5/SHA-1 for security, ECB mode)',
 masvs:'MASVS-CRYPTO-1',mastg:'Cryptography — Testing Cryptographic Standard Algorithms',
 summary:'Legacy algorithms and ECB block mode leak structural patterns in ciphertext and are computationally weak against modern attacks.',
 attacker:'ECB mode preserves repeated plaintext blocks as repeated ciphertext blocks — visually and programmatically detectable, letting an attacker infer or manipulate structured data (e.g. serialized objects) without ever recovering the key.',
  methods:[{title:'otool crypto API usage',cmd:`otool -Iv App | grep -i CCCrypt`},{title:'Frida-captured ciphertext diff',cmd:`Use Frida to hook the encrypt routine, submit two same-prefix plaintexts via the UI, diff the returned ciphertext block-by-block.`},{title:'Network traffic block comparison',cmd:`Capture requests in Burp Suite, compare repeated 16-byte ciphertext blocks across payloads for ECB patterns.`},{title:'Decompiled flag inspection (Hopper)',cmd:`Decompile the crypto call site in Hopper and confirm whether kCCOptionECB is passed as the option flag.`}],
 tools:['Hopper Disassembler','Frida','Burp Suite (for encrypted traffic pattern comparison)'],
 mitigation:'Standardize on AES-256-GCM or ChaCha20-Poly1305 (authenticated encryption), SHA-256/SHA-3 for hashing, and never ECB — use GCM or CBC with a unique IV per operation.'},

{id:'cry-4',cat:'crypto',sev:'medium',title:'Insecure random number generation for security-sensitive values',
 masvs:'MASVS-CRYPTO-2',mastg:'Cryptography — Testing Random Number Generation',
 summary:'Using rand(), arc4random() without the _uniform variant, or a seeded PRNG for tokens/nonces/reset codes produces predictable output.',
 attacker:'If the generator or its seed is predictable, an attacker can precompute or brute-force the sequence of "random" tokens (password-reset codes, session IDs) and hijack accounts.',
  methods:[{title:'frida-trace on RNG calls',cmd:`frida-trace -U -f com.example.app -i "rand*" -i "arc4random*"`},{title:'Entropy analysis',cmd:`Collect N generated tokens via the app, then: ent tokens.txt   # or: dieharder -a -g 202 -f tokens.bin`},{title:'Symbol linkage check',cmd:`nm App | grep -i rand`},{title:'Predict-and-verify (authorized targets only)',cmd:`Script predicts the next token from the observed sequence and submits it against a test endpoint to confirm predictability.`}],
 tools:['Frida','Custom entropy-analysis script','Burp Suite Intruder (for replay)'],
 mitigation:'Use SecRandomCopyBytes or CryptoKit\'s SymmetricKey generation for anything security-relevant; never use rand()/srand() or time-seeded PRNGs for tokens, nonces, or reset codes.'},

{id:'cry-5',cat:'crypto',sev:'high',title:'Cryptographic keys generated/stored outside the Secure Enclave',
 masvs:'MASVS-CRYPTO-1',mastg:'Cryptography — Testing Key Management',
 summary:'High-value asymmetric keys kept in regular Keychain storage (or worse, in app memory/files) instead of the Secure Enclave can be extracted with sufficient device compromise.',
 attacker:'On a jailbroken device, keys not hardware-backed can potentially be exported from the Keychain; Secure-Enclave-backed keys never leave the hardware even under root, forcing the attacker to abuse the API rather than exfiltrate key material.',
  methods:[{title:'objection keychain attribute check',cmd:`objection -g "com.example.app" explore
> ios keychain dump
# inspect the "protection"/tokenID column for each key`},{title:'Frida hook on key generation',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(Module.findExportByName('Security','SecKeyCreateRandomKey'),{onEnter(a){console.log('attrs',new ObjC.Object(a[0]).toString())}})"`},{title:'Export attempt (jailbroken)',cmd:`Attempt SecItemCopyMatching with kSecReturnData for the private key reference; Secure-Enclave-backed keys fail to export, software keys may not.`},{title:'Static string check',cmd:`class-dump App -o headers/
grep -r "kSecAttrTokenIDSecureEnclave" headers/*.h  # absence is a red flag`}],
 tools:['objection','Keychain-Dumper','Xcode / Instruments (for API usage tracing)'],
 mitigation:'Generate signing/authentication keys with kSecAttrTokenIDSecureEnclave so private key material never exists outside hardware, and gate its use behind biometric/passcode access control.'},

{id:'auth-1',cat:'auth',sev:'critical',title:'Face ID / Touch ID success not cryptographically bound to a Keychain item',
 masvs:'MASVS-AUTH-1',mastg:'Authentication and Session Management — Testing Local Authentication',
 summary:'Apps that just check the boolean result of LAContext.evaluatePolicy() and then unlock the app in code (rather than binding biometry to decrypting a Keychain-protected secret) can be bypassed at the logic layer.',
 attacker:'With Frida/objection on a jailbroken device, the attacker hooks evaluatePolicy\'s completion handler and forces success=true regardless of the real biometric result, bypassing the "authentication" entirely.',
  methods:[{title:'objection biometrics bypass',cmd:`objection -g "com.example.app" explore
> ios ui biometrics_bypass`},{title:'Frida LAContext hook',cmd:`frida -U -f com.example.app --no-pause -e "var m=ObjC.classes.LAContext['- evaluatePolicy:localizedReason:reply:'];Interceptor.attach(m.implementation,{onLeave(r){}});" # patch the reply block to force success`},{title:'r2frida live patch',cmd:`r2 frida://usb//com.example.app
[0x0]> dcu <evaluatePolicy_addr>
# patch return register to 1 after the call`},{title:'Cycript manual override (legacy)',cmd:`cycript -p App
cy# [LAContextInstance setLastResult:1]  // conceptual — adjust to the app's actual gate variable`}],
 tools:['objection','Frida','r2frida'],
 mitigation:'Never gate access with a boolean alone. Protect the actual secret (a Keychain item, an encryption key) with kSecAccessControl requiring biometry/passcode so the OS itself enforces the gate — there is no app-layer boolean to hook.'},

{id:'auth-2',cat:'auth',sev:'high',title:'Local authentication / entitlement logic bypassable via runtime hooking',
 masvs:'MASVS-AUTH-2',mastg:'Authentication and Session Management — Testing Local Authentication',
 summary:'Feature gates, premium checks, or "logged in" flags implemented purely in app logic can be flipped in memory at runtime.',
 attacker:'Using Frida, the attacker locates and overwrites the isPremium/isLoggedIn property or return value, unlocking gated functionality without valid credentials or payment.',
  methods:[{title:'Frida class/method enumeration',cmd:`frida-trace -U -f com.example.app -i "*isPremium*" -i "*isLoggedIn*"`},{title:'objection hooking watch',cmd:`objection -g "com.example.app" explore
> ios hooking search classes premium
> ios hooking watch method "<Class>.isPremium" --dump-args --dump-return`},{title:'Static patch + resign',cmd:`Patch the conditional branch in Hopper, then:
codesign -f -s <cert> --entitlements ent.plist App.app
ideviceinstaller -i App.ipa`},{title:'Runtime replace via Frida',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.replace(ObjC.classes.Entitlements['- isPremium'].implementation, new NativeCallback(()=>1,'int',[]))"`}],
 tools:['Frida','objection','Cycript (legacy)'],
 mitigation:'Never trust client-side state for authorization decisions — validate entitlements server-side on every sensitive request, using the state only for UI presentation, not enforcement.'},

{id:'auth-3',cat:'auth',sev:'high',title:'Session tokens stored outside the Keychain',
 masvs:'MASVS-AUTH-1',mastg:'Authentication and Session Management — Testing Session Management',
 summary:'Auth/session tokens kept in NSUserDefaults, files, or in-memory singletons persisted to disk are exposed the same way any other unencrypted local storage is.',
 attacker:'Filesystem or backup access (see Storage playbooks) yields a live session token the attacker can replay directly against the API, no login required.',
  methods:[{title:'objection scan for JWTs',cmd:`objection -g "com.example.app" explore
> ios nsuserdefaults get`},{title:'Filesystem regex sweep',cmd:`grep -RoE "eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+" /var/mobile/Containers/Data/Application/<UUID>/`},{title:'Frida hook on storage write',cmd:`frida-trace -U -f com.example.app -i "*saveToken*" -i "*setAccessToken*"`},{title:'Proxy-then-search correlation',cmd:`Capture the token in Burp Suite during login, then grep the exact string across app storage to confirm where it also landed.`}],
 tools:['objection','sqlite3 / plutil','Burp Suite / Proxyman'],
 mitigation:'Store session and refresh tokens exclusively in the Keychain with an appropriate accessibility class; never mirror them into NSUserDefaults, files, or long-lived global variables written to disk.'},

{id:'auth-4',cat:'auth',sev:'medium',title:'No server-side token invalidation on logout',
 masvs:'MASVS-AUTH-3',mastg:'Authentication and Session Management — Testing Session Management',
 summary:'Logout that only clears local state leaves the token valid server-side, so a previously captured token keeps working indefinitely.',
 attacker:'An attacker who captured a token before logout (via proxy, shared device, or malware) continues to use it against the API even after the legitimate user has logged out.',
  methods:[{title:'Capture + curl replay',cmd:`curl -H "Authorization: Bearer <captured_token>" https://api.example.com/profile`},{title:'Postman collection replay',cmd:`Import the captured request into Postman, log out in-app, then re-send the saved request.`},{title:'mitmproxy repeater',cmd:`mitmproxy -p 8080
# select the captured request, log out in-app, resend via the repeater`},{title:'Timed loop to pinpoint invalidation',cmd:`while true; do curl -s -o /dev/null -w "%{http_code}\\n" -H "Authorization: Bearer <token>" https://api.example.com/profile; sleep 5; done   # run across the logout event`}],
 tools:['Burp Suite / Proxyman','curl / Postman'],
 mitigation:'On logout, call a server-side revoke/blacklist endpoint for the token (or use short-lived access tokens with rotating refresh tokens) so old tokens stop working immediately.'},

{id:'auth-5',cat:'auth',sev:'medium',title:'No lockout / rate limiting on local PIN or passcode entry',
 masvs:'MASVS-AUTH-4',mastg:'Authentication and Session Management — Testing Local Authentication',
 summary:'An app-level PIN screen without attempt limits or backoff lets an attacker brute-force a short numeric code offline or on-device.',
 attacker:'With unlimited attempts (and no delay), a 4–6 digit PIN falls in seconds via a scripted UI-automation or Frida-driven brute force against the local check.',
  methods:[{title:'Frida-scripted brute loop',cmd:`frida -U -f com.example.app --no-pause -l brute_pin.js   # iterates PIN candidates by invoking the check method directly`},{title:'XCUITest UI automation',cmd:`let app = XCUIApplication()
for pin in candidates { app.buttons[pin].tap() }  // repeat without any lockout guard`},{title:'objection direct method invocation',cmd:`objection -g "com.example.app" explore
> ios hooking watch method "<Class>.checkPIN:" --dump-args`},{title:'Manual timed attempts',cmd:`Manually enter 15-20 wrong PINs in a row and time the response to confirm no exponential backoff appears.`}],
 tools:['Frida','XCUITest / Appium','objection'],
 mitigation:'Enforce increasing lockout delays after failed attempts, cap total attempts before requiring full re-authentication, and prefer biometry with system passcode fallback over a custom PIN screen.'},

{id:'auth-6',cat:'auth',sev:'high',title:'OAuth / OIDC redirect handled via an unvalidated custom URL scheme',
 masvs:'MASVS-AUTH-1',mastg:'Platform Interaction — Testing Custom URL Schemes',
 summary:'Custom URL schemes are not unique to one app — any installed app can register the same scheme, letting a malicious app intercept the OAuth authorization code or token redirect.',
 attacker:'A malicious app registers the same custom scheme (e.g. myapp://oauth-callback) and races the legitimate app to receive the redirect, capturing the authorization code or access token.',
  methods:[{title:'PoC malicious app collision',cmd:`Register the same CFBundleURLSchemes in a throwaway Xcode project, install alongside the target, trigger the OAuth flow, and NSLog the intercepted callback URL.`},{title:'Frida hook on openURL',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.UIApplication['- openURL:options:completionHandler:'].implementation,{onEnter(a){console.log(new ObjC.Object(a[2]).toString())}})"`},{title:'Info.plist scheme collision check',cmd:`unzip -p App.ipa Payload/App.app/Info.plist | plutil -convert xml1 - -o - | grep -A5 CFBundleURLSchemes
ideviceinstaller -l   # then pull and check other installed apps' schemes`},{title:'Manual Safari trigger',cmd:`Type myapp://oauth-callback?code=test directly into the Safari address bar and observe app handling.`}],
 tools:['Xcode (build a PoC malicious app)','Frida (to trace the redirect handling)'],
 mitigation:'Use Universal Links (associated domains) instead of custom URL schemes for OAuth redirects, and implement PKCE so a captured authorization code alone is useless without the original code_verifier.'},

{id:'auth-7',cat:'auth',sev:'medium',title:'Missing step-up (re-)authentication before high-risk actions',
 masvs:'MASVS-AUTH-1',mastg:'Authentication and Session Management — Testing Local Authentication',
 summary:'Sensitive actions (adding a payee, changing security settings, viewing full card numbers) execute on a stale session without requiring fresh biometric/passcode confirmation.',
 attacker:'Someone who grabs a device mid-session (unlocked, app already authenticated) can perform destructive or sensitive actions without ever proving they are the account owner.',
  methods:[{title:'Manual idle-then-act walkthrough',cmd:`Authenticate once, wait past any timeout, then navigate straight to the sensitive action and confirm no re-prompt appears.`},{title:'Frida trace on evaluatePolicy calls',cmd:`frida-trace -U -f com.example.app -i "*evaluatePolicy*"   # confirm it is only invoked once per session`},{title:'objection controller monitor',cmd:`objection -g "com.example.app" explore
> ios hooking watch class <SensitiveActionViewController>`},{title:'Deep-link direct invocation',cmd:`xcrun simctl openurl booted "myapp://sensitive-action?confirm=1"   # bypass normal navigation entirely`}],
 tools:['Manual testing'],
 mitigation:'Require a fresh LAContext evaluation (or passcode) immediately before executing high-risk actions, independent of general session validity.'},

{id:'net-1',cat:'network',sev:'high',title:'App Transport Security exceptions weaken enforced TLS',
 masvs:'MASVS-NETWORK-1',mastg:'Network Communication — Testing the TLS Settings',
 summary:'NSAllowsArbitraryLoads or per-domain NSExceptionAllowsInsecureHTTPLoads / weakened NSExceptionMinimumTLSVersion in Info.plist reopen holes ATS was designed to close.',
 attacker:'On a shared network, an attacker performs a classic MITM against any domain covered by the exception, downgrading or intercepting traffic ATS would otherwise have blocked.',
  methods:[{title:'plutil ATS check',cmd:`unzip -p App.ipa Payload/App.app/Info.plist | plutil -convert xml1 - -o - | grep -A20 NSAppTransportSecurity`},{title:'Apple\'s ATS diagnostic tool',cmd:`nscurl --ats-diagnostics https://target-domain.com`},{title:'mitmproxy against excepted domain',cmd:`mitmproxy -p 8080   # route device traffic through it and confirm the excepted domain still connects insecurely`},{title:'Entitlements/profile cross-check',cmd:`codesign -d --entitlements :- App.app`}],
 tools:['plutil / Info.plist inspection','mitmproxy / Burp Suite','Charles Proxy'],
 mitigation:'Remove ATS exceptions; if a specific legacy domain truly requires one, scope it as narrowly as possible and track it for removal rather than a blanket NSAllowsArbitraryLoads.'},

{id:'net-2',cat:'network',sev:'critical',title:'Certificate / public-key pinning missing or trivially bypassed',
 masvs:'MASVS-NETWORK-2',mastg:'Network Communication — Testing Custom Certificate Stores and Certificate Pinning',
 summary:'Without pinning (or with pinning that can be disabled via Frida/SSL Kill Switch), any trusted-looking CA cert lets an attacker MITM API traffic.',
 attacker:'The attacker installs a proxy CA on the test device, and — absent pinning, or with it bypassed at runtime — reads and modifies every request and response, including credentials and business logic.',
  methods:[{title:'objection sslpinning disable',cmd:`objection -g "com.example.app" explore
> ios sslpinning disable`},{title:'SSL Kill Switch 2 (jailbroken tweak)',cmd:`Enable "SSL Kill Switch 2" in Settings, then relaunch the app under a proxy.`},{title:'Frida universal bypass script',cmd:`frida -U -f com.example.app --no-pause -l ssl-pinning-bypass.js   # frida-codeshare universal iOS pinning bypass`},{title:'Static patch + resign',cmd:`Locate the pinning validation call in Hopper, patch it out:
ldid -S App
ideviceinstaller -i App.ipa`}],
 tools:['Burp Suite','objection','SSL Kill Switch 2','Frida'],
 mitigation:'Pin to the public key (not the leaf cert) with a backup pin for rotation, validate the pin at multiple layers, and pair with jailbreak/hooking detection so a bypassed pin isn\'t the only line of defense.'},

{id:'net-3',cat:'network',sev:'high',title:'Cleartext HTTP traffic still permitted for some endpoints',
 masvs:'MASVS-NETWORK-1',mastg:'Network Communication — Testing Data Encryption on the Network',
 summary:'Even with mostly-HTTPS traffic, any residual HTTP endpoint (ads, analytics, image CDNs, legacy APIs) exposes those requests/responses to passive and active network attackers.',
 attacker:'On the same Wi-Fi network, the attacker passively sniffs cleartext requests, or actively injects/modifies responses (e.g. swapping a served image or script) for the unencrypted endpoint.',
  methods:[{title:'mitmproxy filter',cmd:`mitmproxy -p 8080
# filter view: ~m GET & !~tls`},{title:'Wireshark capture',cmd:`tshark -i <iface> -f "tcp port 80" -w http_capture.pcap`},{title:'Burp Suite proxy history',cmd:`Configure device proxy to Burp, filter Proxy > HTTP history by Protocol = HTTP.`},{title:'Charles Proxy (SSL Proxying off)',cmd:`Leave SSL Proxying disabled in Charles to surface only cleartext HTTP requests distinctly.`}],
 tools:['mitmproxy','Wireshark','Burp Suite'],
 mitigation:'Migrate every endpoint to HTTPS, including third-party SDKs and CDNs; audit vendor SDKs specifically, since they\'re a common source of leftover HTTP calls.'},

{id:'net-4',cat:'network',sev:'medium',title:'Weak TLS protocol versions or cipher suites accepted',
 masvs:'MASVS-NETWORK-1',mastg:'Network Communication — Testing the TLS Settings',
 summary:'A server (or client configuration) that still negotiates TLS 1.0/1.1 or export-grade/RC4 ciphers is vulnerable to known downgrade and cryptanalytic attacks.',
 attacker:'An attacker positioned on-path forces a downgrade to the weakest mutually supported protocol/cipher, then leverages known weaknesses in that older suite to recover or tamper with traffic.',
  methods:[{title:'testssl.sh',cmd:`testssl.sh https://api.example.com`},{title:'sslyze',cmd:`sslyze --regular api.example.com`},{title:'nmap cipher enumeration',cmd:`nmap --script ssl-enum-ciphers -p 443 api.example.com`},{title:'mitmproxy legacy-cipher offer',cmd:`mitmproxy --ciphers-client "DES-CBC3-SHA:RC4-MD5" -p 8080   # test if the app/server still negotiates`}],
 tools:['testssl.sh','sslyze','mitmproxy'],
 mitigation:'Enforce TLS 1.2+ (prefer 1.3) with modern AEAD cipher suites only, both server-side and via NSExceptionMinimumTLSVersion if any exception exists at all.'},

{id:'net-5',cat:'network',sev:'low',title:'Sensitive data passed in URL query strings or headers that get logged',
 masvs:'MASVS-NETWORK-1',mastg:'Network Communication — Testing Data Encryption on the Network',
 summary:'Tokens or PII placed in GET query parameters end up in server access logs, browser history (for web views), CDN logs, and Referer headers even over HTTPS.',
 attacker:'An attacker with access to any intermediate log (CDN, load balancer, analytics pipeline, or a shared device\'s in-app browser history) recovers the sensitive value long after the original request.',
  methods:[{title:'Burp proxy history review',cmd:`Filter Proxy > HTTP history for GET requests with query parameters resembling tokens/PII.`},{title:'Syslog Referer grep',cmd:`idevicesyslog | grep -i referer`},{title:'Safari Web Inspector history',cmd:`Develop menu > <device> > <WKWebView instance> > Console, inspect document.location / performance entries for leaked query params.`},{title:'Server/CDN log grep (if in scope)',cmd:`grep -E "token=|auth=" access.log | head`}],
 tools:['Burp Suite / Proxyman','mitmproxy'],
 mitigation:'Send sensitive values in the request body or authorization headers, never in the URL; scrub logging pipelines to redact query strings that may still contain legacy sensitive params.'},

{id:'plat-1',cat:'platform',sev:'high',title:'Custom URL scheme accepts unvalidated actions or parameters',
 masvs:'MASVS-PLATFORM-2',mastg:'Platform Interaction — Testing Custom URL Schemes',
 summary:'A URL scheme handler that trusts its input (myapp://transfer?to=X&amount=Y, myapp://openurl?url=Z) lets any other app or a crafted web link trigger sensitive actions.',
 attacker:'A malicious app or a link in Safari/Messages/Mail invokes the scheme with attacker-chosen parameters, causing the target app to perform an action (navigate to a phishing WebView, trigger a transaction flow) without user intent.',
  methods:[{title:'Info.plist scheme enumeration',cmd:`unzip -p App.ipa Payload/App.app/Info.plist | plutil -convert xml1 - -o - | grep -A10 CFBundleURLTypes`},{title:'Manual Safari trigger',cmd:`Enter myapp://transfer?to=attacker&amount=1000 directly into the Safari address bar.`},{title:'Simulator direct open',cmd:`xcrun simctl openurl booted "myapp://transfer?to=attacker&amount=1000"`},{title:'Frida param fuzzing hook',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.AppDelegate['- application:openURL:options:'].implementation,{onEnter(a){console.log(new ObjC.Object(a[3]).toString())}})"`}],
 tools:['Info.plist inspection','Frida (to trace the handler)','A minimal PoC "attacker" app or Safari address bar'],
 mitigation:'Treat every URL scheme parameter as untrusted input: validate structure and origin, require in-app confirmation for sensitive actions, and prefer Universal Links with server-side association for anything security-relevant.'},

{id:'plat-2',cat:'platform',sev:'medium',title:'Universal Links association misconfigured or overly broad',
 masvs:'MASVS-PLATFORM-2',mastg:'Platform Interaction — Testing Deep Links',
 summary:'A loosely scoped apple-app-site-association (wildcards, missing path restrictions) lets any link under the associated domain — including user-generated content paths — open the app with attacker-controlled paths.',
 attacker:'If the app trusts the linked path/params without revalidation, an attacker hosts or injects a crafted path under the trusted domain (e.g. a comment field rendered at a sub-path) to drive users into unintended in-app states.',
  methods:[{title:'Fetch and review AASA',cmd:`curl -s https://domain.com/.well-known/apple-app-site-association | jq .`},{title:'Manual Universal Link trigger',cmd:`Send yourself a crafted https://domain.com/<path> link via Messages/Notes and tap it.`},{title:'Notes-app trigger (no Safari chrome)',cmd:`Paste the crafted link into Notes and tap it there to confirm direct app hand-off.`},{title:'Frida hook on continueUserActivity',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.AppDelegate['- application:continueUserActivity:restorationHandler:'].implementation,{onEnter(a){console.log(new ObjC.Object(a[2]).webpageURL().toString())}})"`}],
 tools:['curl (to fetch AASA)','Safari (to trigger links)'],
 mitigation:'Scope AASA paths as tightly as possible, and independently validate any parameters carried by a Universal Link inside the app rather than trusting the domain association alone.'},

{id:'plat-3',cat:'platform',sev:'critical',title:'WKWebView JavaScript bridge over-exposes native functionality',
 masvs:'MASVS-PLATFORM-7',mastg:'Platform Interaction — Testing WebViews',
 summary:'A WKScriptMessageHandler registered for a hybrid bridge that accepts unvalidated messages lets any script running in the WebView — including injected or third-party content — call native code.',
 attacker:'If the WebView ever loads untrusted content (an ad network, a compromised CDN asset, or a reflected XSS in a loaded page), the attacker\'s JavaScript calls the native bridge directly, potentially reaching filesystem, Keychain, or IPC-exposed functionality.',
  methods:[{title:'Frida handler enumeration',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.WKUserContentController['- addScriptMessageHandler:name:'].implementation,{onEnter(a){console.log(new ObjC.Object(a[3]).toString())}})"`},{title:'Safari Web Inspector direct call',cmd:`Develop > <device> > <page>, then in the JS console: window.webkit.messageHandlers.<name>.postMessage({cmd:"test"})`},{title:'Hosted test page (if load path allows)',cmd:`<script>window.webkit.messageHandlers.bridge.postMessage({action:"readFile",path:"/etc/passwd"});</script>`},{title:'objection class search + watch',cmd:`objection -g "com.example.app" explore
> ios hooking search classes WKScriptMessageHandler
> ios hooking watch method "<Handler>.userContentController:didReceiveScriptMessage:"`}],
 tools:['Frida','Safari Web Inspector (remote debugging)','Burp Suite (to inject/modify loaded web content in test scenarios)'],
 mitigation:'Whitelist only fully-trusted, first-party origins for pages that load the bridge; validate every message\'s structure and origin server-side/native-side; and expose the minimum bridge surface required, never generic "eval" or filesystem-access style handlers.'},

{id:'plat-4',cat:'platform',sev:'high',title:'WebView loads remote or user-influenced content via loadHTMLString/loadRequest without validation',
 masvs:'MASVS-PLATFORM-2',mastg:'Platform Interaction — Testing WebViews',
 summary:'Rendering server-supplied or deep-link-supplied HTML/URLs directly in a WKWebView without an allowlist opens the door to loading attacker-controlled pages inside the app\'s trusted context.',
 attacker:'By controlling the URL passed via a deep link or a compromised backend response, the attacker gets arbitrary content rendered inside the app — useful for phishing overlays, or as a stepping stone to reach an exposed JS bridge.',
  methods:[{title:'Frida trace on load calls',cmd:`frida-trace -U -f com.example.app -i "*loadRequest*" -i "*loadHTMLString*"`},{title:'Burp response tampering',cmd:`Intercept the server response that supplies the WebView URL in Burp Repeater/Proxy and swap in an attacker-controlled URL.`},{title:'Crafted deep link',cmd:`xcrun simctl openurl booted "myapp://open-webview?url=https://attacker.example/phish"`},{title:'Static review after class-dump',cmd:`class-dump App -o headers/
grep -B2 -A2 "loadRequest\\|loadHTMLString" headers/*.h`}],
 tools:['Frida','Burp Suite (to modify server responses in test)','Manual deep-link crafting'],
 mitigation:'Maintain a strict allowlist of domains/paths the WebView may load, validate any URL originating from a deep link or server response against it, and disable JavaScript in the WebView entirely if it isn\'t needed.'},

{id:'plat-5',cat:'platform',sev:'medium',title:'Sensitive data leaked via the general (system-wide) UIPasteboard',
 masvs:'MASVS-PLATFORM-3',mastg:'Platform Interaction — Testing the Sensitivity of Copied Data',
 summary:'Copying tokens, OTPs, or account numbers to the general pasteboard makes them readable by any other foreground app for a period (historically indefinitely, now time-limited on recent iOS but still cross-app for a window).',
 attacker:'A malicious app polls UIPasteboard.general.string in the background/foreground transition and captures whatever the user last copied from the target app, including one-time codes or account details.',
  methods:[{title:'PoC polling app',cmd:`A minimal test app polling UIPasteboard.general.string on a timer, run alongside the target app right after a copy action.`},{title:'Frida hook on setItems/items',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.UIPasteboard['- setItems:options:'].implementation,{onEnter(a){console.log(new ObjC.Object(a[2]).toString())}})"`},{title:'Shortcuts app clipboard read',cmd:`Build a one-step Shortcut using "Get Clipboard" and run it immediately after copying in the target app.`},{title:'Manual cross-app paste',cmd:`Copy sensitive text in the target app, switch to Notes, paste, and confirm the value transferred.`}],
 tools:['A minimal PoC "attacker" app','Frida (to trace what the app copies and when)'],
 mitigation:'Use UIPasteboard with an expiration (setItems with expirationDate) or the local-only pasteboard for sensitive values, and avoid offering "copy" for highly sensitive fields (full card numbers, OTPs) at all where possible.'},

{id:'plat-6',cat:'platform',sev:'critical',title:'Insecure NSKeyedUnarchiver / NSCoding deserialization of untrusted data',
 masvs:'MASVS-PLATFORM-2',mastg:'Platform Interaction — Testing Object Persistence',
 summary:'Unarchiving data from an untrusted source (IPC, network, pasteboard, shared container) with the legacy insecure API or without a class allowlist can lead to unexpected object instantiation and, in some historical cases, memory corruption.',
 attacker:'If the app unarchives attacker-influenced data (e.g. via a shared App Group container written by another app, or a network response) without requiresSecureCoding and an explicit class allowlist, the attacker can attempt to instantiate unexpected classes during deserialization.',
  methods:[{title:'Frida hook on unarchiver',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.NSKeyedUnarchiver['+ unarchiveObjectWithData:'].implementation,{onEnter(a){console.log('unarchive called')}})"`},{title:'Crafted malicious archive delivery',cmd:`Build a payload with NSKeyedArchiver targeting an unexpected class, deliver via the identified untrusted channel (App Group file, IPC), then observe behavior.`},{title:'Static allowlist check',cmd:`class-dump App -o headers/
grep -r "requiresSecureCoding\\|unarchivedObjectOfClasses" headers/*.h`},{title:'Fuzz + lldb crash monitor',cmd:`lldb -n App
(lldb) continue
# deliver malformed archived data via the untrusted channel and watch for a SIGSEGV/SIGABRT`}],
 tools:['Hopper Disassembler','Frida','A crafted NSKeyedArchiver payload for testing'],
 mitigation:'Always use requiresSecureCoding = true together with an explicit allowedClasses set on NSKeyedUnarchiver, and prefer Codable/JSON for any data crossing a trust boundary instead of NSCoding.'},

{id:'plat-7',cat:'platform',sev:'medium',title:'Over-privileged or unused entitlements and capabilities',
 masvs:'MASVS-PLATFORM-1',mastg:'Platform Interaction — Testing App Permissions',
 summary:'Entitlements (Keychain sharing, App Groups, iCloud, background modes) that aren\'t actually needed widen the app\'s attack surface for no functional benefit.',
 attacker:'Each unused entitlement is a capability an attacker who compromises the app (or a co-installed malicious app sharing a Keychain access group) can potentially abuse — e.g. a broad Keychain-sharing group exposes more than intended.',
  methods:[{title:'codesign entitlements dump',cmd:`codesign -d --entitlements :- App.app`},{title:'Extracted entitlements plist',cmd:`unzip -p App.ipa Payload/App.app/archived-expanded-entitlements.xcent | plutil -convert xml1 - -o -`},{title:'jtool2',cmd:`jtool2 --ent App.app/App`},{title:'Manual functional cross-reference',cmd:`Walk each declared feature and confirm it actually uses the corresponding entitlement; flag any with none.`}],
 tools:['codesign','jtool2 / Ghidra','Manual functional review'],
 mitigation:'Apply least privilege: request only entitlements the shipped feature set actually uses, and audit them on every release since entitlements tend to accumulate over time.'},

{id:'plat-8',cat:'platform',sev:'medium',title:'Insecure use of App Groups / shared containers',
 masvs:'MASVS-PLATFORM-1',mastg:'Platform Interaction — Testing App Permissions',
 summary:'Data written to a shared App Group container without care exposes it to every other app in the same group (main app, extensions, widgets), widening the blast radius of any one compromised component.',
 attacker:'If a widget or extension in the same App Group is less carefully vetted (e.g. bundles a vulnerable third-party SDK), an attacker who compromises it gains read/write access to whatever the main app stored in the shared container.',
  methods:[{title:'codesign App Group ID lookup',cmd:`codesign -d --entitlements :- App.app | grep -A2 application-groups`},{title:'Direct filesystem browse (jailbroken)',cmd:`ls -la /private/var/mobile/Containers/Shared/AppGroup/<GroupID>/`},{title:'objection filesystem browsing',cmd:`objection -g "com.example.app" explore
> ios file ls /private/var/mobile/Containers/Shared/AppGroup/<GroupID>/`},{title:'Cross-app read/write test',cmd:`Install a second app/extension sharing the same App Group and attempt to read or write files there to confirm cross-access scope.`}],
 tools:['codesign (entitlements)','objection / filesystem inspection on a jailbroken device'],
 mitigation:'Only place data in the shared container that genuinely needs to cross the app/extension boundary, encrypt sensitive shared data with a key held in the (also shared) Keychain access group, and keep the extension\'s own attack surface minimal.'},

{id:'plat-9',cat:'platform',sev:'low',title:'Push notification payload carries sensitive data in plaintext',
 masvs:'MASVS-PLATFORM-3',mastg:'Platform Interaction — Testing Push Notifications',
 summary:'APNs payloads shown directly in notification banners (or stored in notification history) can leak account details, messages, or OTPs to anyone glancing at a locked screen.',
 attacker:'A bystander (or someone who steals an unlocked/locked device briefly) reads sensitive content straight from the lock-screen notification banner or Notification Center history, no exploitation required.',
  methods:[{title:'Manual lock-screen check',cmd:`Trigger a push notification containing sensitive data, lock the device, and read the banner content.`},{title:'Frida hook on notification receipt',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.AppDelegate['- application:didReceiveRemoteNotification:'].implementation,{onEnter(a){console.log(new ObjC.Object(a[2]).toString())}})"`},{title:'Syslog apsd filter',cmd:`idevicesyslog | grep -i apsd`},{title:'Notification Center residue check',cmd:`Dismiss the banner and open Notification Center to check for lingering sensitive content.`}],
 tools:['Manual inspection'],
 mitigation:'Send a minimal, non-sensitive alert body from APNs and fetch the real content client-side via a silent push / background fetch once authenticated, or use Notification Service Extension to redact content until the user unlocks the device.'},

{id:'plat-10',cat:'platform',sev:'medium',title:'Share / Today / other App Extension leaks data across the extension boundary',
 masvs:'MASVS-PLATFORM-1',mastg:'Platform Interaction — Testing App Permissions',
 summary:'Extensions run in a separate, more constrained process but often need to exchange data with the host app; doing so without care (over-broad App Group access, unvalidated NSExtensionItem content) can expose more than intended.',
 attacker:'A malicious host app invoking your Share/Action extension (or a compromised Today widget) can submit crafted NSExtensionItem content, and if your extension trusts it blindly, it processes attacker-controlled input with the extension\'s own entitlements.',
  methods:[{title:'PoC host app with crafted NSExtensionItem',cmd:`Build a minimal host app calling UIActivityViewController with adversarial NSExtensionItem attachments, then invoke the target Share extension.`},{title:'Frida attach to extension process',cmd:`frida-ps -U | grep -i extension
frida -U -n "<ExtensionProcessName>" -l trace_extension.js`},{title:'objection against extension binary',cmd:`objection -g "com.example.appext" explore
> ios hooking search classes`},{title:'Share-sheet manual fuzzing',cmd:`Trigger the system share sheet with oversized/special-character content and observe the extension's handling.`}],
 tools:['Xcode (PoC host app)','Frida (extension process, when attachable)'],
 mitigation:'Validate all NSExtensionItem content defensively regardless of source, and keep the extension\'s entitlements and shared-container access scoped to only what that specific extension needs.'},

{id:'qual-1',cat:'quality',sev:'high',title:'Unsafe memory handling in bridged Objective-C/C code (buffer overflows)',
 masvs:'MASVS-CODE-1',mastg:'Code Quality — Testing Memory Corruption Bugs',
 summary:'Swift is memory-safe, but apps that bridge into C/Objective-C (image/audio parsers, custom native libraries) reintroduce classic buffer-overflow and use-after-free risk at that boundary.',
 attacker:'By feeding malformed input (a crafted image, file, or IPC payload) to the vulnerable native routine, an attacker can crash the app at minimum, or in more severe cases pursue memory corruption toward code execution.',
  methods:[{title:'libFuzzer harness',cmd:`clang -fsanitize=fuzzer,address -o fuzz_target native_parser.c
./fuzz_target corpus/`},{title:'Malformed-file import + lldb',cmd:`lldb -n App
(lldb) continue
# import a malformed image/audio file via the app's normal UI and watch for a crash`},{title:'Ghidra unchecked-buffer review',cmd:`Open the Mach-O in Ghidra and search cross-references to memcpy/strcpy/sprintf for missing bounds checks.`},{title:'ASan-instrumented debug build',cmd:`In the Xcode scheme, enable Diagnostics > Address Sanitizer, rebuild, then replay the same malformed inputs.`}],
 tools:['Ghidra / Hopper Disassembler','A fuzzing harness (e.g. libFuzzer for the native component)','lldb'],
 mitigation:'Prefer Swift for new native logic; for unavoidable C/Objective-C code, use bounds-checked APIs, run under sanitizers (ASan/UBSan) in CI, and fuzz-test any code parsing untrusted input.'},

{id:'qual-2',cat:'quality',sev:'medium',title:'Outdated or vulnerable third-party SDKs (CocoaPods / SPM dependencies)',
 masvs:'MASVS-CODE-2',mastg:'Code Quality — Testing for Known Vulnerable Components',
 summary:'Bundled SDKs with known CVEs (analytics, ad, crash-reporting frameworks) ship the same vulnerability into every app that hasn\'t updated the dependency.',
 attacker:'The attacker fingerprints the SDK and version from the binary (framework names, version strings) and applies a public exploit or known bypass for that specific version.',
  methods:[{title:'List embedded frameworks',cmd:`unzip -l App.ipa | grep Frameworks`},{title:'Extract version strings',cmd:`strings Frameworks/<SDK>.framework/<SDK> | grep -iE 'version|v[0-9]+\\.[0-9]+'`},{title:'Linked dylib enumeration',cmd:`otool -L App`},{title:'Automated SCA scan',cmd:`mobsf-cli scan App.ipa   # or: dependency-check --scan App.ipa`}],
 tools:['unzip / otool -L','strings','A CVE database (NVD, GitHub Advisories)'],
 mitigation:'Track dependencies with a software bill of materials, update on a regular cadence, and pin CI to fail builds on dependencies with known-critical CVEs.'},

{id:'qual-3',cat:'quality',sev:'critical',title:'Hardcoded API keys or backend secrets embedded in binary strings',
 masvs:'MASVS-CODE-1',mastg:'Code Quality — Testing for Sensitive Functionality Exposure Through IPC / Hardcoded Secrets',
 summary:'API keys, backend admin tokens, or third-party service secrets compiled directly into the app are recoverable by anyone who downloads the IPA.',
 attacker:'The attacker runs `strings` against the binary once, harvests any API key or secret, and uses it directly against the associated backend or service — often with the same privileges the app itself has.',
  methods:[{title:'Binary string extraction',cmd:`unzip App.ipa -d extracted && strings extracted/Payload/App.app/App | grep -iE 'api[_-]?key|secret|token'`},{title:'radare2 string scan',cmd:`rabin2 -z App | grep -i key`},{title:'MobSF automated secret scan',cmd:`mobsf-cli scan App.ipa   # review the "Hardcoded Secrets" section of the report`},{title:'Validate the recovered credential',cmd:`curl -H "Authorization: Bearer <found_key>" https://api.example.com/test`}],
 tools:['strings','unzip','curl / Postman (to validate recovered credentials against the service)'],
 mitigation:'Never ship long-lived secrets in the client. Broker access through your own backend with short-lived, scoped tokens, and treat any key that must ship client-side as public by design (rate-limited, minimally privileged).'},

{id:'qual-4',cat:'quality',sev:'medium',title:'Improper input validation enabling local injection (SQLite / Realm query construction)',
 masvs:'MASVS-CODE-4',mastg:'Code Quality — Testing for Injection Flaws',
 summary:'Building SQL/Realm queries via string concatenation with user input allows local injection, potentially reading or corrupting data beyond the intended query scope.',
 attacker:'By entering crafted input into a search field or similar user-controlled value, the attacker manipulates the resulting query to return unauthorized rows or corrupt local data.',
  methods:[{title:'Manual payload entry',cmd:`Enter ' OR '1'='1 into the search/filter field and observe the returned result set.`},{title:'Frida hook on query builder',cmd:`frida-trace -U -f com.example.app -i "*buildQuery*" -i "*executeQuery*"`},{title:'objection sqlite inspection',cmd:`objection -g "com.example.app" explore
> ios sqlite connect app.db
# manually replay captured query strings with injection payloads`},{title:'XCUITest automated payload sweep',cmd:`let payloads = ["' OR '1'='1", "'; DROP TABLE users;--"]
for p in payloads { searchField.typeText(p); searchButton.tap() }`}],
 tools:['Manual testing','Frida (to inspect the constructed query string at runtime)'],
 mitigation:'Always use parameterized queries / prepared statements (sqlite3_bind_*, or the query-builder APIs in Realm/Core Data) rather than string concatenation.'},

{id:'qual-5',cat:'quality',sev:'low',title:'Verbose error messages or stack traces exposed to the end user',
 masvs:'MASVS-CODE-1',mastg:'Code Quality — Testing Exception Handling',
 summary:'Raw error descriptions, internal file paths, or stack traces surfaced in the UI hand an attacker reconnaissance detail about the app\'s internals for free.',
 attacker:'The attacker deliberately triggers error conditions (bad input, network failure) to harvest internal class names, file paths, or backend error detail that inform further attacks.',
  methods:[{title:'Manual malformed-input sweep',cmd:`Submit malformed input across every form field and capture the exact error text shown.`},{title:'Force backend 500 via Burp',cmd:`Modify a request in Burp Repeater to trigger a server error, resend, and observe how the app surfaces it.`},{title:'mitmproxy injected verbose error',cmd:`Use an mitmproxy addon script to substitute a verbose stack-trace response body and see if the app displays it raw.`},{title:'Connectivity-loss error check',cmd:`Enable Airplane Mode mid-request and inspect the resulting error message for leaked internal detail.`}],
 tools:['Burp Suite / mitmproxy (to force backend error responses)','Manual testing'],
 mitigation:'Show generic, user-facing error messages; log full detail only to a secure backend or local debug-only channel, never to the UI in production builds.'},

{id:'qual-6',cat:'quality',sev:'medium',title:'Debug endpoints, test flags, or hidden menus left reachable in the release build',
 masvs:'MASVS-CODE-1',mastg:'Code Quality — Testing for Debugging Symbols and Debugging Code',
 summary:'Developer conveniences (hidden debug menus, test-mode toggles, staging-endpoint switches) shipped in production can bypass business logic or expose internal tooling.',
 attacker:'Reverse engineering (class-dump/Hopper) surfaces the hidden trigger (a gesture, a tap sequence, a URL scheme param) for the debug menu, which the attacker then uses to bypass paywalls, feature flags, or point the app at an internal environment.',
  methods:[{title:'class-dump for debug/staging classes',cmd:`class-dump App -o headers/
grep -iE "debug|test|staging|internal" headers/*.h`},{title:'frida-trace pattern sweep',cmd:`frida-trace -U -f com.example.app -i "*debug*" -i "*test*"`},{title:'Manual gesture fuzzing',cmd:`Try common hidden-menu triggers: multi-tap the version number, shake the device, long-press the logo.`},{title:'Build-config / scheme param check',cmd:`unzip -p App.ipa Payload/App.app/Info.plist | plutil -convert xml1 - -o - | grep -i staging`}],
 tools:['class-dump','Hopper Disassembler','Frida (to trace toward the trigger condition)'],
 mitigation:'Strip debug-only code paths from release builds entirely via build configuration (not just a runtime flag), and audit release binaries with class-dump before shipping.'},

{id:'qual-7',cat:'quality',sev:'low',title:'Binary lacks expected hardening flags (PIE, stack canaries, ARC)',
 masvs:'MASVS-CODE-3',mastg:'Code Quality — Testing for Weaknesses in Third-Party Libraries / Binary Protections',
 summary:'A binary built without PIE (Position Independent Executable), stack canaries, or with manual reference counting instead of ARC in critical code raises the ceiling for exploitation of any memory-safety bug that does exist.',
 attacker:'These flags don\'t create vulnerabilities themselves, but their absence makes exploiting an unrelated memory-corruption bug (see Code Quality: memory handling) meaningfully easier and more reliable.',
  methods:[{title:'otool PIE check',cmd:`otool -hv App   # confirm PIE flag is set`},{title:'Stack canary symbol check',cmd:`otool -Iv App | grep stack_chk`},{title:'MachOView (GUI)',cmd:`Open the binary in MachOView and review load commands and header flags.`},{title:'Encryption/hardening cross-check',cmd:`otool -l App | grep -A5 LC_ENCRYPTION_INFO`}],
 tools:['otool','MachOView'],
 mitigation:'Confirm default Xcode hardening flags (PIE, stack protector, ARC) are enabled for every build target and haven\'t been manually disabled for legacy C modules.'},

{id:'qual-8',cat:'quality',sev:'medium',title:'Unsafe dynamic Objective-C runtime usage widens the hooking/swizzling attack surface',
 masvs:'MASVS-CODE-1',mastg:'Code Quality — Testing for Injection Flaws',
 summary:'Objective-C\'s dynamic runtime (message dispatch, method swizzling) is powerful but also gives Frida/Cydia Substrate a clean, well-documented hook point for every method — Swift-only code is comparatively harder to hook at runtime.',
 attacker:'Security-critical checks implemented in Objective-C (e.g. jailbreak detection, entitlement checks) are trivially discoverable and hookable via the Objective-C runtime\'s introspection APIs, unlike Swift-native equivalents.',
  methods:[{title:'Frida ObjC.classes enumeration',cmd:`frida -U -f com.example.app --no-pause -e "for (const c in ObjC.classes) console.log(c)"`},{title:'class-dump full symbol export',cmd:`class-dump App -o headers/`},{title:'objection class search',cmd:`objection -g "com.example.app" explore
> ios hooking search classes <pattern>`},{title:'Cycript interactive exploration (legacy)',cmd:`cycript -p App
cy# ObjC.classes`}],
 tools:['Frida (ObjC bridge)','class-dump'],
 mitigation:'Implement security-critical checks in Swift where practical (reducing runtime-introspection exposure), and layer multiple independent checks so hooking one doesn\'t fully defeat the control.'},

{id:'res-1',cat:'resilience',sev:'high',title:'Jailbreak detection missing or trivially bypassed',
 masvs:'MASVS-RESILIENCE-1',mastg:'Resiliency Against Reverse Engineering — Testing Root/Jailbreak Detection',
 summary:'Apps handling sensitive functionality without any jailbreak awareness (or with a single, well-known check like Cydia.app existence) let attackers operate freely with root-level tooling.',
 attacker:'The attacker either runs the app unmodified on a jailbroken device (if no check exists), or defeats a single naive check with well-known bypass tools, restoring full jailbroken capability against the rest of the app.',
  methods:[{title:'objection jailbreak disable',cmd:`objection -g "com.example.app" explore
> ios jailbreak disable`},{title:'Frida universal jailbreak-bypass script',cmd:`frida -U -f com.example.app --no-pause -l jb-bypass.js   # frida-codeshare ios-jailbreak-bypass`},{title:'Liberty Lite / Shadow tweak',cmd:`Enable Liberty Lite (or Shadow) in Settings to hide jailbreak artifacts app-wide, then relaunch.`},{title:'Static patch + resign',cmd:`Locate and NOP the detection routine in Hopper, then:
ldid -S App
ideviceinstaller -i App.ipa`}],
 tools:['objection','Frida (jailbreak-bypass scripts)','A jailbroken test device'],
 mitigation:'Layer multiple independent detection techniques (filesystem, sandbox integrity, fork() behavior, suspicious dylibs) checked at multiple points in the app lifecycle, not just at launch, and treat detection as a defense-in-depth signal rather than the sole control.'},

{id:'res-2',cat:'resilience',sev:'medium',title:'No anti-debugging protection (missing ptrace / sysctl checks)',
 masvs:'MASVS-RESILIENCE-2',mastg:'Resiliency Against Reverse Engineering — Testing Anti-Debugging',
 summary:'Without a ptrace(PT_DENY_ATTACH) call or a sysctl-based debugger check, an attacker attaches lldb/Frida directly and steps through security logic at will.',
 attacker:'The attacker attaches a debugger at launch and single-steps through authentication, entitlement, or crypto-key-handling routines, extracting secrets or understanding exact bypass conditions.',
  methods:[{title:'Frida ptrace no-op hook',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.replace(Module.findExportByName(null,'ptrace'), new NativeCallback(()=>0,'int',['int','int','pointer','int']))"`},{title:'Direct lldb attach test',cmd:`lldb -n App
(lldb) continue   # confirm whether attach succeeds or the process dies`},{title:'Static patch of the ptrace call',cmd:`Patch out the ptrace(PT_DENY_ATTACH,...) call in Hopper, resign, reinstall.`},{title:'debugserver + Frida co-run',cmd:`debugserver *:1234 --attach=App
# separately attach Frida to confirm no cross-detection occurs`}],
 tools:['lldb','Frida','debugserver'],
 mitigation:'Call ptrace(PT_DENY_ATTACH) and perform periodic sysctl(KERN_PROC) checks for a debugger flag, combined with jailbreak/hook detection so a determined attacker must defeat several independent controls at once.'},

{id:'res-3',cat:'resilience',sev:'high',title:'Runtime hooking via Frida/Cycript/objection goes undetected',
 masvs:'MASVS-RESILIENCE-4',mastg:'Resiliency Against Reverse Engineering — Testing Dynamic Instrumentation Detection',
 summary:'Without checks for the Frida server port, injected gadget/dylib, or suspicious loaded libraries, the app has no awareness it\'s being actively instrumented and hooked.',
 attacker:'Since every other bypass in this checklist (biometric bypass, pinning bypass, jailbreak bypass) typically relies on Frida or similar instrumentation, detecting and reacting to it is a meaningful last line of defense the attacker must additionally defeat.',
  methods:[{title:'Plain Frida attach',cmd:`frida -U -f com.example.app   # observe whether the app terminates or alerts`},{title:'Default-port reachability check',cmd:`frida-ps -U   # confirm frida-server is reachable without triggering app-side reaction`},{title:'Renamed frida-server + custom port',cmd:`./frida-server-renamed -l 0.0.0.0:9999   # test if detection is purely signature/port based`},{title:'objection default injection',cmd:`objection -g "com.example.app" explore   # confirm the app behaves normally while instrumented`}],
 tools:['Frida','objection'],
 mitigation:'Check for the default Frida port, scan loaded libraries/dylibs for known instrumentation frameworks, and monitor for unusual thread names/behavior — react by terminating or degrading functionality rather than merely logging.'},

{id:'res-4',cat:'resilience',sev:'medium',title:'No code obfuscation — class-dump reveals the full symbol table',
 masvs:'MASVS-RESILIENCE-3',mastg:'Resiliency Against Reverse Engineering — Testing Obfuscation',
 summary:'An unobfuscated binary hands an attacker a readable roadmap: class names, method names, and property names that make every other reverse-engineering step in this checklist faster.',
 attacker:'class-dump output effectively hands the attacker a header file for the entire app, dramatically shortening the time needed to locate authentication logic, crypto routines, or hidden debug functionality.',
  methods:[{title:'class-dump',cmd:`class-dump App -o headers/`},{title:'class-dump-z',cmd:`class-dump-z App > symbols.txt`},{title:'Hopper symbol browser',cmd:`Open the binary in Hopper and browse the full Objective-C class/method list in the sidebar.`},{title:'nm + demangle',cmd:`nm App | c++filt`}],
 tools:['class-dump','Hopper Disassembler'],
 mitigation:'Apply name mangling/obfuscation to security-sensitive classes and methods at minimum (full-app obfuscation where budget allows), understanding this raises attacker cost rather than eliminating the risk — pair it with the runtime controls above.'},

{id:'res-5',cat:'resilience',sev:'high',title:'No integrity / tamper detection — resigned or resource-modified IPAs run unmodified',
 masvs:'MASVS-RESILIENCE-1',mastg:'Resiliency Against Reverse Engineering — Testing Code Integrity',
 summary:'Without a runtime check of its own code-signing/resource integrity, a resigned (sideloaded) or resource-patched version of the app runs identically to the original, silently bypassing any client-side controls the attacker has patched out.',
 attacker:'The attacker patches a security check directly in the binary (e.g. removing a jailbreak-detection call), resigns the IPA with a personal certificate, and sideloads it — the tampered app runs as if nothing changed, since nothing verifies its own integrity.',
  methods:[{title:'Patch + resign + reinstall',cmd:`Patch the target check in Hopper, then:
codesign -f -s <cert> --entitlements ent.plist App.app
ideviceinstaller -i App.ipa`},{title:'ldid ad-hoc resign (jailbroken)',cmd:`ldid -S App`},{title:'Sideload pipeline repackage',cmd:`Repackage the modified app and sideload via AltStore/Sideloadly, confirm it launches normally.`},{title:'Runtime-only Frida patch (no resign)',cmd:`frida -U -f com.example.app --no-pause -l bypass_integrity_check.js   # confirms the bypass works without touching the on-disk binary`}],
 tools:['Hopper Disassembler','codesign / ldid (resigning)','A sideloading method (Xcode, AltStore, etc. — test devices only)'],
 mitigation:'Implement runtime integrity self-checks (validating the app\'s own code-signing entitlements/team ID at runtime, checksumming critical code regions) that fail closed when the running binary doesn\'t match the expected signed state.'},

{id:'res-6',cat:'resilience',sev:'medium',title:'No device attestation for high-risk operations (DeviceCheck / App Attest unused)',
 masvs:'MASVS-RESILIENCE-1',mastg:'Resiliency Against Reverse Engineering — Testing Device Binding',
 summary:'Without server-verifiable proof that a request genuinely originates from an unmodified instance of the real app on genuine Apple hardware, the backend has no way to distinguish legitimate traffic from an emulated, tampered, or automated client.',
 attacker:'An attacker scripting API calls directly (bypassing the app entirely, or from a jailbroken/tampered instance) is indistinguishable from a legitimate client to a backend that never asked for attestation.',
  methods:[{title:'Capture + curl replay',cmd:`curl -X POST https://api.example.com/high-risk-op -H "Authorization: Bearer <token>" -d @captured_body.json`},{title:'Postman reconstruction',cmd:`Rebuild the full request sequence in Postman from captured traffic and replay it entirely outside the app.`},{title:'Scripted Python replay',cmd:`import requests
r = requests.post('https://api.example.com/high-risk-op', headers={'Authorization':'Bearer <token>'}, json=body)
print(r.status_code, r.text)`},{title:'Manual Burp Repeater replay',cmd:`Send the captured request to Burp Repeater, strip any app-only headers one at a time, and resend to find which (if any) the backend actually enforces.`}],
 tools:['Burp Suite / mitmproxy (capture)','curl / Postman (replay)'],
 mitigation:'For genuinely high-risk backend operations, require DeviceCheck or App Attest tokens and validate them server-side before proceeding, in addition to normal auth.'},

{id:'priv-1',cat:'privacy',sev:'medium',title:'Data collection exceeds what the declared purpose strings justify',
 masvs:'MASVS-PRIVACY-1',mastg:'Privacy — Testing App Permissions and Data Collection',
 summary:'An Info.plist NSxxxUsageDescription framed around one purpose (e.g. "to tag your photos") while the app actually collects and transmits more (precise location history, full contact list) than that purpose requires.',
 attacker:'This isn\'t attacker exploitation in the classic sense — the "attacker" is the app vendor (or an SDK it bundles) itself, and the finding is a privacy/compliance gap: users consented to a narrower purpose than what actually happens with their data.',
  methods:[{title:'Purpose-string review',cmd:`unzip -p App.ipa Payload/App.app/Info.plist | plutil -convert xml1 - -o - | grep -i UsageDescription`},{title:'Proxy capture during permission use',cmd:`Trigger the permission-gated feature while proxying through Burp/mitmproxy, inspect the actual payload sent.`},{title:'objection local-storage review',cmd:`objection -g "com.example.app" explore
> ios nsuserdefaults get
> ios sqlite connect app.db`},{title:'MobSF permission-vs-usage report',cmd:`mobsf-cli scan App.ipa   # review the generated permissions-usage summary`}],
 tools:['Info.plist inspection','Burp Suite / mitmproxy','objection (to inspect permission-gated API calls)'],
 mitigation:'Align purpose strings precisely with actual data use, collect only what the stated feature needs (request approximate rather than precise location where sufficient), and review this alignment on every release as features evolve.'},

{id:'priv-2',cat:'privacy',sev:'medium',title:'Tracking (IDFA/fingerprinting) occurs without AppTrackingTransparency consent',
 masvs:'MASVS-PRIVACY-2',mastg:'Privacy — Testing Tracking and Advertising',
 summary:'Reading IDFA, or using cross-app/cross-site fingerprinting signals, before (or despite) a "Ask App Not to Track" response violates both the ATT framework\'s intent and, depending on jurisdiction, applicable privacy law.',
 attacker:'Again a compliance-style finding rather than classic exploitation: the app (or an embedded ad SDK) continues tracking-adjacent data collection regardless of the user\'s explicit ATT choice.',
  methods:[{title:'Deny-then-capture',cmd:`Select "Ask App Not to Track", then proxy traffic to ad/analytics endpoints in Burp/mitmproxy and inspect for IDFA.`},{title:'Frida hook on advertisingIdentifier',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.ASIdentifierManager['- advertisingIdentifier'].implementation,{onEnter(a){console.log('IDFA read attempted')}})"`},{title:'objection status-read monitor',cmd:`objection -g "com.example.app" explore
> ios hooking watch method "ATTrackingManager.trackingAuthorizationStatus"`},{title:'Static IDFA string search',cmd:`strings App | grep -i idfa`}],
 tools:['Burp Suite / mitmproxy','objection (to inspect ASIdentifierManager usage)'],
 mitigation:'Gate every tracking-adjacent SDK call on the actual ATT authorization status (not just a first prompt-then-ignore pattern), and audit bundled third-party SDKs specifically, since they\'re a common source of ATT non-compliance.'},

{id:'priv-3',cat:'privacy',sev:'medium',title:'PII sent unmasked to analytics or crash-reporting SDKs',
 masvs:'MASVS-PRIVACY-1',mastg:'Privacy — Testing App Permissions and Data Collection',
 summary:'Crash reports and analytics events that include full names, emails, or free-text fields (sometimes accidentally, via a logged object\'s description) send PII to a third-party vendor\'s infrastructure outside the app\'s own control.',
 attacker:'A compliance/exposure finding: PII now lives in a third party\'s systems (with that vendor\'s own retention, access controls, and breach history), often beyond what users would expect from "anonymous" crash reporting.',
  methods:[{title:'Analytics endpoint capture',cmd:`Proxy traffic to known analytics/crash endpoints (Firebase, Sentry, Crashlytics) and inspect payload fields.`},{title:'Forced crash with PII in context',cmd:`Fill a form with test PII, force a crash, and review the resulting crash report payload before it uploads.`},{title:'Frida hook on logEvent',cmd:`frida-trace -U -f com.example.app -i "*logEvent*" -i "*trackEvent*"`},{title:'Vendor dashboard review (authorized)',cmd:`With client authorization, check the analytics vendor's dashboard directly to confirm what fields actually landed server-side.`}],
 tools:['Burp Suite / mitmproxy','Vendor dashboard review (with authorization)'],
 mitigation:'Scrub or hash PII before it reaches analytics/crash SDKs, use vendor-provided PII-redaction features where available, and review breadcrumbs/custom-context logging for accidental inclusion of sensitive objects.'},

{id:'priv-4',cat:'privacy',sev:'low',title:'App Privacy "nutrition label" mismatches actual data flows',
 masvs:'MASVS-PRIVACY-1',mastg:'Privacy — Testing App Permissions and Data Collection',
 summary:'The App Store privacy label (self-reported "data used to track you" / "data linked to you" sections) can drift from reality as SDKs and features change, without anyone updating the declaration.',
 attacker:'A trust/compliance finding rather than direct exploitation: users and reviewers rely on the label as an accurate summary, and a stale label misleads that trust.',
  methods:[{title:'Pull current App Store label',cmd:`Review the "App Privacy" section on the App Store listing (or via App Store Connect API with owner access).`},{title:'Cross-reference captured flows',cmd:`Compare the declared categories against traffic captured using the priv-1/priv-3 methodology.`},{title:'MobSF combined static+dynamic report',cmd:`mobsf-cli scan App.ipa   # cross-check the generated report against the published label`},{title:'SDK manifest matching',cmd:`unzip -l App.ipa | grep Frameworks
# match each bundled SDK against its own published data-collection disclosure`}],
 tools:['App Store listing (manual review)','Burp Suite / mitmproxy'],
 mitigation:'Re-validate the privacy label against actual SDK/data-flow inventory on every release that adds or updates a third-party dependency, not just at initial submission.'},
{id:'plat-11',cat:'platform',sev:'critical',title:'Zero-click messaging exploit chains (Operation Triangulation / BLASTPASS-style)',
 masvs:'MASVS-PLATFORM-2',mastg:'Platform Interaction — Testing Attack Surface via Messaging Frameworks',
 summary:'Zero-click exploit chains delivered via iMessage/WhatsApp attachments (malicious images, fonts, or PDFs) have chained memory-corruption bugs in ImageIO/CoreGraphics or transcoding daemons to gain code execution with no user interaction, as seen in Operation Triangulation (2023) and BLASTPASS (CVE-2023-41064 + CVE-2023-41061).',
 attacker:'A remote attacker sends a crafted attachment; parsing happens automatically in a background transcoding process, so the victim never taps or opens anything before the attacker gains code execution.',
  methods:[{title:'Patch-level verification',cmd:`sw_vers
# cross-check the build number against Apple's security content page for
# CVE-2023-41064 / CVE-2023-41061 and any later ImageIO/CoreGraphics CVEs`},{title:'Lockdown Mode attack-surface check',cmd:`# Settings > Privacy & Security > Lockdown Mode
# confirm it is available and understand what it disables for high-risk test profiles`},{title:'Fuzz any custom media parsing your app re-implements',cmd:`afl-fuzz -i corpus/ -o findings/ -- ./your_image_parser @@
# only relevant if the app bypasses system ImageIO/CoreGraphics for its own decoder`},{title:'Config-profile mitigation check',cmd:`# Confirm no MDM configuration profile disables BlastDoor / message-attachment
# sandboxing mitigations on managed test devices`}],
 tools:['sw_vers','Lockdown Mode toggle','AFL / libFuzzer harness (for custom parsers only)','Apple security content bulletins'],
 mitigation:'Keep devices on the latest iOS security patch level, enable Lockdown Mode for high-risk users, and if your app re-implements any media parsing rather than using system frameworks, fuzz it independently since it won\'t benefit from Apple\'s BlastDoor sandboxing.'},

{id:'qual-9',cat:'quality',sev:'high',title:'NSPredicate format-string injection in dynamically built predicates',
 masvs:'MASVS-CODE-4',mastg:'Code Quality — Testing for Injection Flaws',
 summary:'Apps that build NSPredicate objects via string interpolation instead of %@ argument substitution let an attacker inject predicate syntax, widening query scope or altering filter logic in unexpected ways.',
 attacker:'By entering predicate metacharacters into a search field (e.g. closing a comparison early and OR-ing in an always-true clause), the attacker retrieves data far beyond the intended filtered scope.',
  methods:[{title:'Manual injection test',cmd:`Enter a payload like:  name == "x" OR 1==1
into the search field and confirm the result set is broader than the filter should allow.`},{title:'Frida hook on predicateWithFormat:',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.NSPredicate['+ predicateWithFormat:'].implementation,{onEnter(a){console.log(new ObjC.Object(a[2]).toString())}})"`},{title:'objection query inspection',cmd:`objection -g "com.example.app" explore
> ios sqlite connect app.db
# compare the underlying query against the raw predicate string logged above`},{title:'Static review for string-interpolated predicates',cmd:`class-dump App -o headers/
grep -rn "predicateWithFormat" headers/*.h
# flag any call site concatenating user input directly into the format string`}],
 tools:['Manual testing','Frida','objection','class-dump'],
 mitigation:'Always build NSPredicate using %@ argument substitution (predicateWithFormat:@"name == %@", userInput) rather than string interpolation, and validate/allowlist any user input that influences predicate structure itself.'},

{id:'priv-5',cat:'privacy',sev:'medium',title:'BLE / AirDrop proximity signals enable device tracking or deanonymization',
 masvs:'MASVS-PRIVACY-1',mastg:'Privacy — Testing Tracking and Advertising',
 summary:'Research published in 2024 showed Bluetooth LE advertisement and AirDrop discovery signals can leak enough entropy to track or partially deanonymize nearby iOS devices even with randomized BLE MAC addresses.',
 attacker:'An attacker running BLE sniffing equipment in a public space correlates advertisement timing/content across MAC address rotations to track a specific device\'s movement, or probes AirDrop-discoverable device names against known identities.',
  methods:[{title:'Passive BLE sniffing',cmd:`btmon -w capture.log
# or capture with an Ubertooth One and analyze advertisement rotation patterns in Wireshark`},{title:'AirDrop discovery probing',cmd:`# Set AirDrop to "Everyone for 10 Minutes" on the test device and observe
# discoverability broadcasts with a custom BLE scanner script`},{title:'Correlate BLE activity with app behavior',cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.CBCentralManager['- scanForPeripheralsWithServices:options:'].implementation,{onEnter(a){console.log('BLE scan triggered')}})"`},{title:'Compare against current disclosures',cmd:`Review the latest BLE-tracking research (academic papers / CVE advisories) against Apple's current MAC-randomization interval for known gaps.`}],
 tools:['Wireshark + BLE-capable adapter','Ubertooth One','CoreBluetooth Frida hooks','Academic BLE-tracking research papers'],
 mitigation:'Default AirDrop to "Contacts Only" or "Receiving Off," avoid unnecessary continuous BLE advertising in your own app, and follow Apple\'s guidance on minimizing identifiable characteristics in custom BLE payloads.'},

{id:'auth-8',cat:'auth',sev:'medium',title:'Passkey (WebAuthn) enrollment lacks re-authentication, enabling persistent takeover',
 masvs:'MASVS-AUTH-1',mastg:'Authentication and Session Management — Testing Local Authentication',
 summary:'Passkeys sync via iCloud Keychain across a user\'s Apple devices; if enrolling a new passkey doesn\'t require re-authenticating the existing session, an attacker with a hijacked session can register their own passkey as a persistent fallback credential.',
 attacker:'An attacker holding a stolen/replayed session token (see auth-3/auth-4) enrolls a rogue passkey without re-proving identity, gaining access that survives even a full password reset.',
  methods:[{title:'Session-replay then enroll',cmd:`curl -H "Authorization: Bearer <stolen_token>" -X POST https://api.example.com/passkeys/register -d @attestation.json`},{title:'Burp Suite registration replay',cmd:`Intercept the passkey registration API call in Burp Repeater and resend it with a different attestation object under the same session.`},{title:'Frida trace on registration trigger',cmd:`frida-trace -U -f com.example.app -i "*ASAuthorizationPlatformPublicKeyCredentialProvider*"`},{title:'Cross-device enrollment test',cmd:`On a secondary test Apple ID device, attempt to enroll a passkey and confirm whether the primary account requires step-up confirmation before it's accepted.`}],
 tools:['Burp Suite','Frida','objection','A secondary test Apple ID device'],
 mitigation:'Require fresh re-authentication (password or an existing passkey) before allowing enrollment of any new authenticator, and notify the user out-of-band whenever a new credential is registered.'},

{id:'res-7',cat:'resilience',sev:'high',title:'Leaked Enterprise/ad-hoc provisioning certificates enable unauthorized sideloading',
 masvs:'MASVS-RESILIENCE-1',mastg:'Resiliency Against Reverse Engineering — Testing Code Integrity',
 summary:'Leaked or purchased Apple Enterprise Developer certificates let attackers sign and distribute modified or trojanized versions of an app for installation outside the App Store, bypassing App Review entirely — an ongoing abuse pattern documented in multiple incidents over the past two years.',
 attacker:'The attacker resigns a tampered IPA (with a patched security check, or trojanized functionality) using a compromised enterprise certificate and distributes it via a rogue MDM profile or direct install link; the device installs and trusts it as if from a legitimate enterprise source.',
  methods:[{title:'Inspect a suspicious IPA\'s provisioning profile',cmd:`security cms -D -i embedded.mobileprovision`},{title:'Confirm no unexpected enterprise profiles are trusted',cmd:`# Settings > General > VPN & Device Management
# review every listed enterprise profile and its issuing organization`},{title:'Signing identity verification',cmd:`codesign -dv --verbose=4 App.app`},{title:'Lab-only MDM push simulation (authorized environments only)',cmd:`# Attempt to push a resigned test IPA via a lab MDM server to confirm your
# organization's device-management policy blocks unapproved enterprise certs`}],
 tools:['security (cms -D)','codesign','MDM test console (lab only)'],
 mitigation:'Enforce MDM configuration profiles that restrict untrusted enterprise developer certificates, monitor Apple\'s enterprise program compliance reports for revoked/leaked certs, and train users never to trust an "install profile" prompt from outside sanctioned channels.'},

{id:'stor-7',cat:'storage',sev:'medium',title:'Live Activities / Dynamic Island surface sensitive data on the lock screen',
 masvs:'MASVS-STORAGE-4',mastg:'Data Storage — Testing for Sensitive Data Disclosure Through the User Interface',
 summary:'ActivityKit-based Live Activities (iOS 16.1+) render live content in the Dynamic Island and lock screen; pushing sensitive fields (order details, delivery addresses, ride-share driver info) into a Live Activity exposes them to anyone glancing at a locked device.',
 attacker:'A bystander, or someone who briefly picks up a locked device, reads Live Activity content directly off the lock screen with no unlock required — a persistent, update-driven version of the classic push-notification exposure.',
  methods:[{title:'Manual lock-screen check',cmd:`Trigger a Live Activity containing sensitive data, lock the device, and observe the lock-screen and Dynamic Island rendering.`},{title:'Frida hook on Activity content updates',cmd:`frida-trace -U -f com.example.app -i "*Activity*content*"`},{title:'Review ActivityAttributes field exposure',cmd:`class-dump App -o headers/
grep -A10 "ActivityAttributes" headers/*.h`},{title:'Privacy-setting compliance test',cmd:`# Set Settings > Notifications > Show Previews to "Never" and confirm the
# Live Activity still honors it (some iOS versions have not respected this toggle)`}],
 tools:['Manual testing','Frida','class-dump / Ghidra','Device Settings (Notification previews)'],
 mitigation:'Keep Live Activity content minimal and non-sensitive by design (status/progress only) — don\'t rely on the OS-level "hide previews" setting alone, since Live Activities have historically rendered regardless of that toggle on some iOS versions.'},

{id:'plat-13',cat:'platform',sev:'medium',title:'App Clips request capability or data beyond their scoped experience',
 masvs:'MASVS-PLATFORM-1',mastg:'Platform Interaction — Testing App Permissions',
 summary:'App Clips are meant to be lightweight, scoped experiences (<10MB, limited entitlements) invoked via NFC/QR/Safari banners without a full install — one requesting or receiving more capability or data than its narrow task needs undermines the trust users place in that lightweight model.',
 attacker:'A user who trusted a no-install App Clip for a narrow task (e.g., paying for parking) finds it has camera/location/contacts access disproportionate to that task, or shares an App Group with the full app in a way that exposes data the user never expected to hand over.',
  methods:[{title:'App Clip-specific entitlement check',cmd:`codesign -d --entitlements :- AppClip.app`},{title:'Purpose-string alignment review',cmd:`unzip -p AppClip.ipa Info.plist | plutil -convert xml1 - -o - | grep -i UsageDescription
# compare each against the App Clip's actual advertised task`},{title:'Frida attach to the App Clip process',cmd:`frida-ps -U | grep -i clip
frida -U -n "<mainapp>.Clip" -l trace_appclip.js`},{title:'Real-world invocation test',cmd:`Trigger the App Clip via its actual NFC tag / QR code / Safari App Clip banner and compare the permission prompts shown against the stated task.`}],
 tools:['codesign','Frida','Manual invocation testing (NFC/QR/banner)'],
 mitigation:'Scope the App Clip target\'s entitlements and permission requests strictly to its advertised task, and review its App Group boundary with the full app using the same care as any other shared-container review.'},

{id:'qual-10',cat:'quality',sev:'medium',title:'On-device Core ML model extraction and inversion',
 masvs:'MASVS-CODE-2',mastg:'Code Quality — Testing for Known Vulnerable Components',
 summary:'Apps shipping proprietary Core ML models (recommendation engines, biometric liveness classifiers, on-device LLM adapters) bundle the model file directly in the IPA, where it can be extracted, analyzed, or — for some architectures — subjected to model-inversion or membership-inference attacks; a growing concern as more apps ship on-device AI.',
 attacker:'The attacker extracts the .mlmodelc/.mlpackage from the IPA and either lifts the proprietary model wholesale for reuse, or runs offline black-box querying to map a liveness/anti-spoofing classifier\'s decision boundary and craft inputs that bypass it.',
  methods:[{title:'Extract bundled models',cmd:`unzip -l App.ipa | grep -i mlmodel
unzip App.ipa -d extracted`},{title:'Inspect architecture/metadata with coremltools',cmd:`python3 -c "import coremltools as ct; m = ct.models.MLModel('model.mlmodelc'); print(m.get_spec())"`},{title:'Offline decision-boundary probing',cmd:`# Run the extracted model locally with Xcode/CoreML runtime, iterating crafted
# or perturbed inputs to map its accept/reject boundary`},{title:'Version-diff bundled model hashes',cmd:`shasum extracted_v1/model.mlmodelc/* extracted_v2/model.mlmodelc/*
# confirm whether "on-device" claims match what actually ships vs is fetched remotely`}],
 tools:['unzip','coremltools (Python)','Xcode / local Core ML runtime','Netron (model visualization)'],
 mitigation:'Encrypt bundled models at rest and decrypt only in memory at inference time, consider server-side inference for genuinely sensitive classifiers (e.g., liveness/anti-fraud), and treat any on-device model as reverse-engineerable by a sufficiently motivated attacker.'},

{id:'auth-9',cat:'auth',sev:'medium',title:'Screen Time / Family Sharing PIN recovery bypasses parental restrictions',
 masvs:'MASVS-AUTH-4',mastg:'Authentication and Session Management — Testing Local Authentication',
 summary:'Screen Time\'s local PIN recovery flow has, in some configurations, only required the device\'s own Apple ID password rather than a genuinely separate guardian credential — letting the restricted user self-service their way out of the restriction.',
 attacker:'A user subject to Screen Time restrictions (or an attacker with brief physical access) walks through "Forgot Passcode?" and removes the restriction using only credentials already available on the device, defeating the intended parental control.',
  methods:[{title:'Manual recovery-flow walkthrough',cmd:`Trigger Settings > Screen Time > "Forgot Passcode?" and record exactly what identity proof is required to complete recovery.`},{title:'Cross-version comparison',cmd:`Repeat the same recovery flow across iOS versions and Family Sharing configurations, since behavior has changed release to release.`},{title:'Lockout/backoff test',cmd:`Enter the wrong Screen Time PIN repeatedly and measure whether any exponential backoff or lockout is enforced.`},{title:'MDM-managed comparison',cmd:`Repeat the test on a device with restrictions enforced via MDM restriction payloads instead of local Screen Time, and compare recovery behavior.`}],
 tools:['Manual testing across iOS versions','A secondary test Apple ID / Family Sharing group'],
 mitigation:'If your app implements its own parental-control-style local lock, don\'t rely on the OS Screen Time PIN as the only enforcement layer — pair it with server-side account controls the on-device user can\'t self-service reset.'},

{id:'net-6',cat:'network',sev:'high',title:'Missing Certificate Transparency monitoring leaves rogue CA issuance undetected',
 masvs:'MASVS-NETWORK-2',mastg:'Network Communication — Testing Custom Certificate Stores and Certificate Pinning',
 summary:'Apps relying solely on the OS trust store without pinning are exposed if any CA in that store is compromised or mis-issues a certificate for the app\'s domain — a distinct risk from on-path MITM, and one Certificate Transparency monitoring exists specifically to catch.',
 attacker:'An attacker who compromises or socially engineers a trusted CA obtains a validly-signed certificate for the target domain and MITMs traffic that passes standard OS certificate validation entirely, since pinning is the only defense against this class of attack and many apps skip it.',
  methods:[{title:'Query CT logs for the target domain',cmd:`curl -s "https://crt.sh/?q=%.example.com&output=json" | jq .`},{title:'Confirm pinning status',cmd:`Cross-reference against net-2 findings — CT monitoring is a mitigating control, not a substitute for pinning.`},{title:'Frida check on trust evaluation call site',cmd:`frida-trace -U -f com.example.app -i "*SecTrustEvaluate*"   # confirm no silent accept-any-OS-trusted-chain path`},{title:'Process/documentation review',cmd:`Check whether the backend/security team has CT-log monitoring and alerting configured for the app's domains.`}],
 tools:['crt.sh / Certificate Transparency search','Frida','Process/documentation review'],
 mitigation:'Implement certificate or public-key pinning (see net-2) so OS trust-store compromise alone isn\'t sufficient for MITM, and set up Certificate Transparency monitoring/alerting for your app\'s domains to catch mis-issuance quickly.'},

];

const JAILBREAKS = [
  {name:'palera1n', tag:'Semi-tethered · checkm8 (A8–A11)', scope:'iOS/iPadOS 15.0 – 18.7.9 · iPhone 6s – iPhone X, iPad 5th gen and similar A8–A11 hardware',
   note:'Built on the unpatchable checkm8 BootROM exploit, so it works on any A8–A11 device regardless of iOS version — but it needs a computer to re-enter the jailbroken state after every reboot.',
   methods:[
     {title:'macOS / Linux — official CLI', cmd:'# Put the device in DFU mode, then:\ngit clone https://github.com/palera1n/palera1n\ncd palera1n && ./bootstrap.sh\nsudo ./palera1n.sh -f   # -f = enter DFU-triggered flow'},
     {title:'Windows — official CLI', cmd:'# Download the Windows build from https://palera.in\npalera1n.exe -f'},
     {title:'palera1n Online (no computer)', cmd:'# On-device only, via a signed web-based flow at https://palera.in\n# Follow the in-browser DFU/recovery instructions for your exact device'},
     {title:'Rootless vs rootful mode', cmd:'sudo ./palera1n.sh -f -r   # -r selects rootless mode (recommended for compatibility with modern tweaks)'},
   ]},
  {name:'Dopamine', tag:'Semi-untethered · rootless', scope:'iOS 15.0 – 16.6.1/16.7.x on A8–A16 (device-dependent — check current release notes)',
   note:'An app-based, semi-untethered jailbreak: after a reboot you just reopen the Dopamine app and tap "Jailbreak" again — no computer required for re-jailbreaking.',
   methods:[
     {title:'Initial install via TrollStore (if compatible iOS)', cmd:'# Sideload TrollStore (see below), then install the Dopamine IPA through it\n# Open Dopamine.app -> tap "Jailbreak" -> device respring'},
     {title:'Initial install via Sideloadly (no TrollStore)', cmd:'# On a PC/Mac with Sideloadly installed:\n# Drag Dopamine.ipa into Sideloadly, enter Apple ID, sideload to device\n# Trust the developer profile in Settings > General > VPN & Device Management'},
     {title:'Re-jailbreak after reboot', cmd:'# Simply reopen the Dopamine app on the device and tap "Jailbreak" again'},
     {title:'Check current device/iOS support', cmd:'# Compatibility changes with each Dopamine release — check:\n# https://ellekit.space/dopamine (official) before attempting'},
   ]},
  {name:'TrollStore', tag:'Not a true jailbreak · permanent sideloading', scope:'iOS 14.0 – 16.6.1 and 17.0 only (does not support iOS 18+) — exploits a CoreTrust bypass',
   note:'Grants permanent, no-revoke sideloading and elevated entitlements without full kernel-level jailbreak — commonly used as the install vector for Dopamine and other tools on supported iOS versions.',
   methods:[
     {title:'Direct install (supported iOS via exploited app)', cmd:'# Method varies by iOS version — follow the official installation guide for your\n# exact build at https://github.com/opa334/TrollStore (in-scope, supported versions only)'},
     {title:'Via Sideloadly / AltStore bootstrap', cmd:'# Sideload the TrollStore helper IPA with Sideloadly, then run the on-device installer'},
     {title:'Verify install', cmd:'# Open TrollStore.app -> Settings tab -> confirm "Installed apps will not expire"'},
   ]},
];

const JBDETECT = [
  {name:'objection — automatic bypass', tag:'One-command · patches common checks',
   note:'objection ships a built-in bypass that patches the most common detection signals in one shot: filesystem checks for Cydia/Sileo/apt paths, the classic fork() test, sandbox-write tests outside the container, and suspicious dylib checks.',
   methods:[
     {title:'Launch and bypass', cmd:`objection -g "com.example.app" explore
> ios jailbreak disable`},
     {title:'Confirm what got patched', cmd:`> ios jailbreak simulate
# lists exactly which detection signals objection is currently spoofing`},
   ]},
  {name:'Frida — targeted API hooking', tag:'Custom script · covers gaps objection misses',
   note:'When an app uses a less common check (a custom dylib scan, a specific sandbox_check() call, or a homegrown heuristic objection doesn\'t know about), a hand-written Frida script hooking the exact APIs gives full control.',
   methods:[
     {title:'Hook common filesystem checks', cmd:`frida -U -f com.example.app --no-pause -e "var paths=['/Applications/Cydia.app','/bin/bash','/usr/sbin/sshd','/etc/apt'];Interceptor.attach(ObjC.classes.NSFileManager['- fileExistsAtPath:'].implementation,{onEnter(a){var p=new ObjC.Object(a[2]).toString();if(paths.some(x=>p.includes(x))){this.spoof=true;}},onLeave(r){if(this.spoof)r.replace(0);}})"`},
     {title:'Hook fork()-based detection', cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.replace(Module.findExportByName(null,'fork'),new NativeCallback(()=>-1,'int',[]))"`},
     {title:'Hook canOpenURL: for cydia:// scheme', cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.UIApplication['- canOpenURL:'].implementation,{onEnter(a){var u=new ObjC.Object(a[2]).toString();if(u.includes('cydia')){this.spoof=true;}},onLeave(r){if(this.spoof)r.replace(0);}})"`},
     {title:'frida-codeshare universal script', cmd:`frida -U -f com.example.app --no-pause -l jb-bypass-universal.js
# search frida.re/codeshare for current-maintained "ios jailbreak bypass" scripts`},
   ]},
  {name:'Jailbroken system-wide tweaks', tag:'Sileo/Zebra repo · no per-app scripting',
   note:'Tweaks like Shadow, Liberty Lite, or A-Bypass hook the OS at a low level (via a substrate/libhooker-style injection) so every app\'s detection checks get spoofed automatically, with no per-app Frida script required.',
   methods:[
     {title:'Install via Sileo/Zebra', cmd:`# Add the relevant repo in Sileo/Zebra, install "Shadow" (or "Liberty Lite" / "A-Bypass")
# then enable per-app hiding rules in the tweak's preference pane`},
     {title:'Per-app allowlist config', cmd:`# In the tweak's Settings entry, add com.example.app to the "hidden from" list
# and select which signals to spoof (root, Cydia paths, sandbox integrity)`},
   ]},
  {name:'Static patch + resign', tag:'Permanent · no runtime tooling needed after install',
   note:'For a detection routine that\'s hard to hook cleanly at runtime, patching it directly in the binary and resigning removes it permanently — no Frida/objection session required afterward.',
   methods:[
     {title:'Locate the check in Hopper/Ghidra', cmd:`# Search for cross-references to fopen/stat/access on jailbreak-indicator paths,
# or to fork(), and identify the branch that sets the "is jailbroken" flag`},
     {title:'Patch and resign (jailbroken device)', cmd:`ldid -S App
ideviceinstaller -i App.ipa`},
     {title:'Patch and resign (non-jailbroken, dev cert)', cmd:`codesign -f -s <cert> --entitlements ent.plist App.app
ideviceinstaller -i App.ipa`},
   ]},
];

const SSLPIN = [
  {name:'objection — automatic bypass', tag:'One-command · covers common libraries',
   note:'objection\'s built-in disable command patches the most common pinning implementations in one shot — NSURLSession delegate trust evaluation, TrustKit, AFNetworking, and Alamofire\'s ServerTrustManager.',
   methods:[
     {title:'Launch and disable pinning', cmd:`objection -g "com.example.app" explore
> ios sslpinning disable`},
     {title:'Confirm the app still connects', cmd:`# Retry a login/API call through Burp/mitmproxy and confirm the request now
# appears in the proxy history without a TLS handshake failure`},
   ]},
  {name:'Frida — targeted trust-evaluation hooking', tag:'Custom script · covers custom pinning code',
   note:'When an app implements its own pinning logic (comparing a hash inside a custom SecTrustEvaluateWithError callback, or a hand-rolled certificate comparison) rather than using a known library, a targeted hook on the exact validation function is needed.',
   methods:[
     {title:'Hook SecTrustEvaluateWithError', cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(Module.findExportByName('Security','SecTrustEvaluateWithError'),{onLeave(r){r.replace(1)}})"`},
     {title:'Hook NSURLSession auth challenge delegate', cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.YourSessionDelegate['- URLSession:didReceiveChallenge:completionHandler:'].implementation,{onEnter(a){console.log('challenge intercepted')}})"`},
     {title:'Hook TrustKit\'s pinning validator', cmd:`frida -U -f com.example.app --no-pause -e "Interceptor.attach(ObjC.classes.TSKPinningValidator['- evaluateTrust:forHostname:'].implementation,{onLeave(r){r.replace(0)}})"`},
     {title:'Hook Alamofire/AFNetworking ServerTrustManager', cmd:`frida -U -f com.example.app --no-pause -l alamofire-pin-bypass.js
# targets ServerTrustEvaluating.evaluate(_:forHost:) or AFSecurityPolicy evaluateServerTrust:forDomain:`},
     {title:'frida-multiple-unpinning (universal script)', cmd:`frida -U -f com.example.app --no-pause -l frida-multiple-unpinning-ios.js
# a maintained community script chaining most of the above hooks in one file`},
   ]},
  {name:'Jailbroken tweak — SSL Kill Switch 2', tag:'Cydia Substrate · low-level CFNetwork hook',
   note:'SSL Kill Switch 2 hooks CFNetwork/NSURLSession trust evaluation system-wide via Substrate, so it disables pinning for every installed app without touching each binary individually.',
   methods:[
     {title:'Install and enable', cmd:`# Install "SSL Kill Switch 2" from a Cydia/Sileo repo, then toggle it ON
# in its Settings preference pane`},
     {title:'Per-app scope (if supported by the build)', cmd:`# Some forks allow an app-specific allowlist instead of system-wide disabling —
# check the tweak's preferences for a per-bundle-ID toggle`},
   ]},
  {name:'Static binary patch + resign', tag:'Permanent · no runtime tooling after install',
   note:'Patching the pinning validation call directly in the binary (forcing it to always return success) removes the check permanently, useful when a target actively detects and reacts to Frida/objection.',
   methods:[
     {title:'Locate the validation call in Hopper/Ghidra', cmd:`# Find the function that compares the pinned hash/public key against the
# presented certificate and identify the branch on mismatch`},
     {title:'Patch the branch and resign (jailbroken)', cmd:`ldid -S App
ideviceinstaller -i App.ipa`},
     {title:'Patch the branch and resign (dev cert)', cmd:`codesign -f -s <cert> --entitlements ent.plist App.app
ideviceinstaller -i App.ipa`},
   ]},
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATS, DATA, JAILBREAKS, JBDETECT, SSLPIN };
}
