## Architecture Decisions (fixed context for all stages)

- **Frontend:** React + Vite, PWA (installable, no React Native)
- **Backend:** FastAPI (Python)
- **DB:** SQL (SQLite for development, upgradeable to Postgres later)
- **Calendar:** Google Calendar API
- **WhatsApp:** Official WhatsApp Cloud API (Meta) — approved template with Reply buttons
- **Single user:** business owner only, no customer login / multiple permission levels
- **Language:** Hebrew UI, RTL, mobile-first
