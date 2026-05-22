# FlowDesk — n8n + Retell AI SaaS Dashboard

A full-stack SaaS wrapper for managing **Retell AI phone agents** and **n8n workflows** across multiple clinic clients.

---

## Project Structure

```
flowdesk/
├── client/                        # React + Vite frontend (separate repo)
│   └── src/
│       ├── App.jsx                # Main dashboard (provided in retell_n8n_saas_dashboard.jsx)
│       └── ...
│
└── server/                        # Node.js + Express backend
    ├── index.js                   # Entry point — mounts all routes
    ├── .env.example               # Environment variable template
    ├── config/
    │   ├── logger.js              # Winston logger
    │   └── clients.js             # Multi-tenant client config (JSON → DB later)
    ├── middleware/
    │   └── index.js               # Error handler, auth guard, request logger
    ├── routes/
    │   ├── clients.js             # GET/PUT /api/clients
    │   ├── retell.js              # GET /api/retell/calls, /analytics, /agents
    │   ├── n8n.js                 # GET/POST /api/n8n/workflows, /trigger, /executions
    │   └── calendar.js            # GET/POST/PUT/DELETE /api/calendar/appointments + OAuth
    ├── data/
    │   ├── clients.json           # Auto-generated on first run
    │   └── tokens/                # Google OAuth tokens per client (gitignored)
    └── tests/
        └── smoke.js               # Quick sanity test (no API keys needed)
```

---

## Quick Start

### 1. Install dependencies

```bash
cd flowdesk/server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your keys (see below)
```

### 3. Run in development mode

```bash
npm run dev
# Server starts at http://localhost:4000
# All endpoints fall back to mock data if API keys aren't set
```

### 4. Check health

```bash
curl http://localhost:4000/health
```

### 5. Run smoke tests

```bash
npm test
```

---

## API Reference

### Clients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clients` | List all clients |
| GET | `/api/clients/:id` | Single client config |
| PUT | `/api/clients/:id/status` | Update status |

### Retell AI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/retell/calls?clientId=` | Paginated call list |
| GET | `/api/retell/calls/:callId` | Call detail + transcript |
| GET | `/api/retell/calls/:callId/transcript` | Plain text transcript |
| GET | `/api/retell/analytics?clientId=&period=today` | Aggregated stats |
| GET | `/api/retell/agents` | All registered Retell agents |

### n8n

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/n8n/workflows?clientId=` | List workflows |
| GET | `/api/n8n/workflows/:id` | Single workflow |
| POST | `/api/n8n/trigger/:workflowId` | Fire webhook (test panel) |
| GET | `/api/n8n/executions` | Recent execution history |
| POST | `/api/n8n/webhooks/:path` | Generic passthrough |

### Google Calendar

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/calendar/oauth/connect?clientId=` | Start OAuth2 flow |
| GET | `/api/calendar/oauth/callback` | OAuth2 callback |
| GET | `/api/calendar/appointments?clientId=&date=` | List appointments |
| POST | `/api/calendar/appointments` | Create appointment |
| PUT | `/api/calendar/appointments/:eventId` | Reschedule |
| DELETE | `/api/calendar/appointments/:eventId?clientId=` | Cancel |

---

## Google Calendar OAuth Setup (per client)

1. Create OAuth 2.0 credentials at [console.cloud.google.com](https://console.cloud.google.com)
2. Add `http://localhost:4000/api/calendar/oauth/callback` as an authorised redirect URI
3. Enable the **Google Calendar API** in your project
4. Fill `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
5. Visit `http://localhost:4000/api/calendar/oauth/connect?clientId=klinik-sejahtera`
6. Complete the Google consent screen — tokens are saved to `data/tokens/klinik-sejahtera.json`

---

## Adding a New Client

Edit `data/clients.json` (auto-created on first run) and add an entry:

```json
{
  "id": "new-clinic",
  "name": "New Clinic Sdn Bhd",
  "city": "Kuala Lumpur",
  "status": "active",
  "retell": {
    "agentId": "agent_REPLACE",
    "agentName": "NC-Receptionist-v1"
  },
  "n8n": {
    "webhooks": [
      { "id": "retell-tools", "path": "/webhook/nc-retell-tools", "label": "Retell Tool Webhook" }
    ]
  },
  "google": {
    "calendarId": "new-clinic@gmail.com"
  }
}
```

Then connect their Google Calendar:
`http://localhost:4000/api/calendar/oauth/connect?clientId=new-clinic`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 4000) |
| `SESSION_SECRET` | 64-char random hex for session signing |
| `RETELL_API_KEY` | From Retell dashboard → Settings → API Keys |
| `RETELL_API_BASE` | Default: `https://api.retellai.com` |
| `N8N_BASE_URL` | Your n8n instance URL (no trailing slash) |
| `N8N_API_KEY` | n8n Settings → API → Create API Key |
| `N8N_WEBHOOK_SECRET` | Shared secret set on n8n webhook nodes |
| `GOOGLE_CLIENT_ID` | OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | Must match console.cloud.google.com config |
| `GOOGLE_CALENDAR_ID` | Default calendar (e.g. talkinghead001@gmail.com) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

---

## Connecting the React Frontend

In your React app, set:

```env
VITE_API_BASE=http://localhost:4000
```

Then call any endpoint:

```js
const res   = await fetch(`${import.meta.env.VITE_API_BASE}/api/retell/calls?clientId=klinik-sejahtera`);
const { calls } = await res.json();
```

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a real database instead of `clients.json`
- [ ] Store OAuth tokens in the database, not local files
- [ ] Add JWT authentication to all `/api/` routes
- [ ] Set up HTTPS (reverse proxy: nginx / Caddy)
- [ ] Enable n8n API key on every webhook node
- [ ] Set `ALLOWED_ORIGINS` to your production domain only
