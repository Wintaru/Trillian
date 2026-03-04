# Discord Bot

A Discord bot built with TypeScript, discord.js v14, and SQLite.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/)

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Go to the **Bot** tab and click **Reset Token** to get your bot token
4. Under **Privileged Gateway Intents**, enable **Message Content Intent**
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
