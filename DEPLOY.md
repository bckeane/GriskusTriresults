# Deploying Griskus to Namecheap Shared Hosting

## Architecture

In production, Express (`backend/`) serves both the API (`/api/*`) and the built
React app (`frontend/dist/`). One Node.js process, one Passenger socket.

The SQLite database (`backend/data/griskus.db`) lives on the server and is **never**
overwritten by deployments. The Python scraper runs locally; you upload the DB
manually (see below).

---

## One-time server setup

SSH into the server and create the app directory and production `.env`:

```bash
ssh -p 21098 your_cpanel_username@your-server-hostname.com

mkdir -p ~/apps/griskus/backend/data ~/apps/griskus/tmp

cat > ~/apps/griskus/.env <<'EOF'
NODE_ENV=production
EOF
```

Then in **cPanel → Setup Node.js App**:

| Setting | Value |
|---|---|
| Node.js version | 20 (or 22 if available) |
| Application mode | Production |
| Application root | `apps/griskus` |
| Application URL | your domain / subdomain |
| Application startup file | `backend/server.js` |

Click **Create**. The app won't start yet — that's fine.

---

## First deploy

```bash
# 1. Create your local deploy credentials
cp .env.deploy.example .env.deploy
# Edit .env.deploy with your SSH_HOST, SSH_USER, REMOTE_PATH

# 2. Run the deploy
./deploy.sh
```

The script will:
1. Build the React app locally (`frontend/npm run build` → `frontend/dist/`)
2. rsync everything to the server (excluding node_modules, .env, DB, python_scraper)
3. SSH in, run `npm ci --omit=dev` in `backend/` (compiles `better-sqlite3` for Linux)
4. Touch `tmp/restart.txt` to signal Passenger to restart

---

## Uploading the database

The Python scraper runs locally. After scraping, upload the compiled DB:

```bash
# Source .env.deploy first, then:
source .env.deploy
scp -P "${SSH_PORT:-21098}" backend/data/griskus.db \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/backend/data/griskus.db"
```

Or add this to your workflow after running the Python scraper + `npm run migrate`.

---

## Subsequent deploys

```bash
./deploy.sh
```

That's it. The DB on the server is never touched by the script.

---

## Troubleshooting

**App won't start**
- cPanel → Node.js App → view log
- Check `~/apps/griskus/.env` has `NODE_ENV=production`
- SSH in and manually run: `cd ~/apps/griskus/backend && npm ci --omit=dev`

**better-sqlite3 crashes on the server**
- It must be compiled for Linux on the server, not copied from Mac.
- SSH in: `cd ~/apps/griskus/backend && npm rebuild better-sqlite3`

**Changes aren't live**
- Touch the restart file: `ssh -p 21098 user@host "touch ~/apps/griskus/tmp/restart.txt"`

**rsync permission denied**
- Make sure your SSH key is in `~/.ssh/authorized_keys` on the server.
- Set `SSH_KEY=~/.ssh/your_key` in `.env.deploy`.
