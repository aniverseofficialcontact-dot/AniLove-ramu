Build & Environment notes — setting API base for client builds

The app supports configuring the backend API base at build time using VITE_API_BASE.

Usage (PowerShell):
$env:VITE_API_BASE = 'https://anilove-backend.onrender.com'
npm run build:android

Usage (CMD):
set VITE_API_BASE=https://anilove-backend.onrender.com
npm run build:android

Notes:
- Prefer serving your backend over HTTPS. Android 9+ blocks cleartext (http://) by default.
- If you must allow http:// during testing, update android/app/src/main/res/xml/network_security_config.xml and add your domain, or build the APK with a secure HTTPS backend URL.
- During local development, leaving VITE_API_BASE empty keeps relative /api calls (use local dev server).
