# Discord Bot

A Discord bot built with TypeScript, discord.js v14, and SQLite.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/)
- [Ollama](https://ollama.ai/) (for AI chat feature)

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Go to the **Bot** tab and click **Reset Token** to get your bot token
4. Under **Privileged Gateway Intents**, enable **Message Content Intent** and **Server Members Intent**
5. Go to the **OAuth2** tab, select the **bot** and **applications.commands** scopes
6. Under **Bot Permissions**, select the permissions your bot needs (at minimum: Send Messages, Manage Messages, Read Message History)
7. Copy the generated URL and open it in your browser to invite the bot to your server

## Installation

```bash
pnpm install
```

## Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your bot token from the Developer Portal |
| `DISCORD_CLIENT_ID` | Your application's Client ID (found on the General Information page) |
| `DISCORD_GUILD_ID` | The ID of your development server (right-click server name > Copy Server ID) |
| `BOT_PREFIX` | Prefix for text commands (default: `!`) |
| `PURGE_CHANNEL_IDS` | Comma-separated channel IDs where `/purge` is allowed (e.g., `123456,789012`) |
| `XP_COOLDOWN_SECONDS` | Seconds between XP awards per user (default: `60`) |
| `XP_MIN` | Minimum XP per message (default: `15`) |
| `XP_MAX` | Maximum XP per message (default: `25`) |
| `LEVELUP_CHANNEL_ID` | Channel for level-up announcements (default: same channel as message) |
| `OLLAMA_URL` | Ollama API URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Ollama model for chat responses (default: `mistral-nemo:12b`) |
| `OLLAMA_CONTEXT_MESSAGES` | Number of recent channel messages to include as conversation context (default: `10`) |

## Running

```bash
# Development (auto-restarts on changes)
pnpm dev

# Production
pnpm build
pnpm start
```

## Deploying Slash Commands

Slash commands must be registered with Discord before they appear. Run this after adding or changing commands:

```bash
pnpm deploy-commands
```

This registers commands to your development guild (instant). For global deployment, modify `scripts/deploy-commands.ts` to use `Routes.applicationCommands()` instead.

## Commands

| Command | Description | Permission |
|---|---|---|
| `/ping` | Replies with Pong! | Everyone |
| `/purge [count]` | Delete messages from a configured channel | Manage Messages |
| `/rank [@user]` | Show level, XP, rank, and progress | Everyone |
| `/leaderboard [page]` | Show the server XP leaderboard | Everyone |
| `/xp set @user <amount>` | Set a user's XP | Manage Server |
| `/xp add @user <amount>` | Add XP to a user | Manage Server |
| `/xp reset @user` | Reset a user's XP to zero | Manage Server |

All commands support both slash (`/command`) and prefix (`!command`) invocation.

---

## Command Reference

### `/ping`

A simple health check command. Replies with "Pong!" to confirm the bot is online and responsive.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/ping` |
| Prefix command | `!ping` |

#### Parameters

None.

#### Permission

Everyone — no special permissions required.

#### Configuration

None — works out of the box.

#### Bot Permissions Required

- Send Messages

---

### `/purge`

Bulk-deletes messages from the current channel. Restricted to specific channels to prevent accidental wipes.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/purge` or `/purge count:50` |
| Prefix command | `!purge` or `!purge 50` |

#### Parameters

| Parameter | Type | Required | Default | Range | Description |
|---|---|---|---|---|---|
| `count` | Integer | No | 100 | 1–1000 | Number of messages to delete |

#### Permission

Manage Messages — users without this permission cannot see or use the command. For slash commands, Discord enforces this automatically. For prefix commands, the bot checks the user's permissions before executing.

#### Configuration

| Env Variable | Required | Example | Description |
|---|---|---|---|
| `PURGE_CHANNEL_IDS` | Yes | `123456789,987654321` | Comma-separated list of channel IDs where purge is allowed. If empty or unset, purge is blocked in all channels. |

**How to get a channel ID:** Right-click any channel name in Discord > **Copy Channel ID**. If you don't see this option, go to **User Settings** > **Advanced** > enable **Developer Mode**.

**Setup steps:**

1. Copy the channel ID(s) you want to allow purging in
2. Add them to your `.env` file:
   ```
   PURGE_CHANNEL_IDS=123456789,987654321
   ```
3. Restart the bot

#### Bot Permissions Required

- Send Messages
- Manage Messages
- Read Message History

#### Behavior

1. Bot fetches messages in batches of up to 100
2. Each batch is bulk-deleted via the Discord API
3. Bot continues until the requested count is reached or no more messages remain
4. Bot replies with a summary: how many deleted, how many skipped, any errors

#### Limitations

| Limitation | Detail |
|---|---|
| **14-day cutoff** | Discord's bulk delete API silently skips messages older than 14 days. These are reported as "skipped" in the response. The bot does not fall back to individual deletes for old messages. |
| **Rate limits** | Discord rate-limits bulk delete to ~1 request per second per channel. A 1000-message purge takes at least ~10 seconds. |
| **Pinned messages** | Pinned messages are deleted along with everything else. They are not filtered out. |
| **No undo** | Deleted messages cannot be recovered by any means. |
| **Audit log** | All bulk deletes appear in the server's audit log attributed to the bot. |

---

### `/rank`

Shows a user's current level, XP, named rank, and progress toward the next level.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/rank` or `/rank user:@someone` |
| Prefix command | `!rank` or `!rank @someone` |

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `user` | User | No | User to check (defaults to you) |

#### Permission

Everyone — no special permissions required.

---

### `/leaderboard`

Shows the server XP leaderboard, paginated with 10 members per page.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/leaderboard` or `/leaderboard page:2` |
| Prefix command | `!leaderboard` or `!leaderboard 2` |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | Integer | No | 1 | Page number |

#### Permission

Everyone — no special permissions required.

---

### `/xp`

Admin commands for managing user XP. Has three subcommands: `set`, `add`, and `reset`.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/xp set user:@someone amount:500` |
| Slash command | `/xp add user:@someone amount:100` |
| Slash command | `/xp reset user:@someone` |
| Prefix command | `!xp set @someone 500` |
| Prefix command | `!xp add @someone 100` |
| Prefix command | `!xp reset @someone` |

#### Permission

Manage Server — users without this permission cannot see or use the command.

---

## XP / Leveling System

The bot awards 15–25 XP per message (randomized), with a 60-second cooldown per user to prevent spam farming. XP accumulates and determines your level using the formula: `XP for level N = 5N² + 50N + 100` (cumulative).

There are 100 named ranks (a mix of Hitchhiker's Guide to the Galaxy and Lincoln, Nebraska references) that are automatically assigned as you level up. Level-up announcements are posted when a user reaches a new level.

Role rewards can be configured in the `level_role_rewards` database table to auto-assign Discord roles at specific level thresholds.

---

## AI Chat

Mention the bot (`@Trillian`) in any message and it will respond conversationally using a local Ollama instance. The bot has a friendly, witty personality with occasional Hitchhiker's Guide to the Galaxy references.

### Setup

1. Install [Ollama](https://ollama.ai/)
2. Pull the model: `ollama pull mistral-nemo:12b`
3. Ensure Ollama is running (`ollama serve`)
4. The bot connects to `http://localhost:11434` by default — configure `OLLAMA_URL` if running elsewhere

---

## Windows Setup (from scratch)

Step-by-step guide for deploying the bot on a Windows machine.

### 1. Install Node.js

1. Go to https://nodejs.org/ and download the **LTS** installer (`.msi`)
2. Run the installer — accept defaults, but make sure **"Add to PATH"** is checked
3. Open **PowerShell** and verify:
   ```powershell
   node --version   # should show v18+ or v20+
   npm --version
   ```

### 2. Install pnpm

```powershell
npm install -g pnpm
pnpm --version
```

### 3. Install Ollama

1. Go to https://ollama.ai/ and download the Windows installer
2. Run the installer
3. Open a **new PowerShell window** and pull the model:
   ```powershell
   ollama pull mistral-nemo:12b
   ```
   This download is ~7 GB and may take a while.

### 4. Clone and set up the bot

```powershell
git clone <your-repo-url> DiscordBot
cd DiscordBot
pnpm install
```

If you don't have Git installed, download it from https://git-scm.com/download/win or just download the repo as a ZIP and extract it.

### 5. Configure

```powershell
copy .env.example .env
```

Open `.env` in Notepad (or any text editor) and fill in your values:
```
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-client-id-here
DISCORD_GUILD_ID=your-server-id-here
```

### 6. Build and run

```powershell
pnpm build
pnpm db:migrate
pnpm deploy-commands
pnpm start
```

### 7. Keep the bot running

The bot stops when you close PowerShell. To keep it running 24/7:

**Option A: PM2 (recommended)**

PM2 is a process manager that auto-restarts your bot if it crashes.

```powershell
npm install -g pm2
pnpm build
pm2 start dist/index.js --name "discord-bot"
pm2 save
pm2 startup
```

Useful PM2 commands:
```powershell
pm2 status          # check if the bot is running
pm2 logs discord-bot # view bot logs
pm2 restart discord-bot # restart the bot
pm2 stop discord-bot    # stop the bot
```

**Option B: Task Scheduler**

1. Open **Task Scheduler** (search for it in the Start menu)
2. Click **Create Basic Task**
3. Name it "Discord Bot" and set the trigger to **When the computer starts**
4. Action: **Start a program**
   - Program: `powershell.exe`
   - Arguments: `-NoExit -Command "cd C:\path\to\DiscordBot; pnpm start"`
5. Check **"Run whether user is logged on or not"** in the task properties

**Option C: Run as a Windows Service**

For a more robust setup, use [node-windows](https://github.com/coreybutler/node-windows) to install the bot as a Windows service that starts automatically on boot and restarts on crash.

### Keeping Ollama running

Ollama needs to be running for the AI chat feature to work. After installing Ollama on Windows, it typically runs as a background service automatically. Verify with:

```powershell
ollama list
```

If it's not running, start it with:
```powershell
ollama serve
```

To make sure Ollama starts on boot, check that "Ollama" appears in your startup apps (Settings > Apps > Startup).

### 8. Auto-deploy on push (optional)

Automatically pull, rebuild, and restart the bot when you push to GitHub from your dev machine.

**On the Windows machine:**

1. Generate a random webhook secret (any random string works):
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add the secret to your `.env` file:
   ```
   DEPLOY_WEBHOOK_SECRET=your-generated-secret-here
   DEPLOY_WEBHOOK_PORT=9000
   ```

3. Start the webhook listener alongside the bot:
   ```powershell
   pm2 start scripts/deploy-webhook.ts --name "deploy-webhook" --interpreter npx --interpreter-args "tsx"
   pm2 save
   ```

4. Open port 9000 on Windows Firewall:
   - Search **"Windows Defender Firewall"** in the Start menu
   - Click **"Advanced settings"** on the left
   - Click **"Inbound Rules"** > **"New Rule..."**
   - Select **Port** > **TCP** > Specific port: **9000**
   - Allow the connection, give it a name like "Deploy Webhook"

5. If behind a router, forward port 9000 to the Windows machine's local IP

**On GitHub:**

1. Go to your repo > **Settings** > **Webhooks** > **Add webhook**
2. Payload URL: `http://YOUR_PUBLIC_IP:9000/webhook`
3. Content type: `application/json`
4. Secret: paste the same secret from step 1
5. Events: select **"Just the push event"**
6. Click **Add webhook**

Now when you `git push` from your Mac, the Windows machine will automatically pull, build, migrate, deploy commands, and restart the bot.

Check the webhook logs with:
```powershell
pm2 logs deploy-webhook
```

---

## Adding a New Command

1. Create `src/commands/my-command.ts` implementing the `Command` interface
2. Import and add it to the array in `src/commands/index.ts`
3. Run `pnpm deploy-commands` to register the slash command

See `src/commands/ping.ts` for a simple example.

## Adding a New Event Handler

1. Create `src/events/my-event.ts` implementing the `EventHandler` interface
2. Import and add it to the array in `src/events/index.ts`

See `src/events/ready.ts` for an example.

## Project Structure

```
src/
  clients/         # Discord client (event wiring, connection)
  engines/         # Business logic
  accessors/       # Data access (Discord API, database)
  commands/        # Command definitions
  events/          # Event handler definitions
  types/           # Shared interfaces and contracts
  db/              # Database schema (Drizzle ORM)
  utilities/       # Config, logging, helpers
```

## Development

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build
pnpm build

# Generate DB migration after schema changes
pnpm db:generate

# Run DB migrations
pnpm db:migrate
```
