# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

A bot for Discord servers

## Architecture

This project follows **iDesign** methodology and **Volatility-Based Decomposition (VBD)**.

### Core Principles

1. **Decompose by volatility, not by technical layer.** Group code by what changes together and why — not by whether it's a "controller" or a "model." Each service encapsulates a single axis of change.

2. **Service hierarchy matters.** Services are organized by their role, and calls flow downward only:
   - **Clients (Controllers):** External communication only. No business logic. Translate between the outside world and internal service calls.
   - **Managers:** Orchestrate workflows across multiple engines. Sequence and coordinate, but contain no core business rules themselves.
   - **Engines:** Core business logic and rules. This is where domain decisions live.
   - **Accessors:** Data access only — databases, APIs, file systems. No business logic. Return raw results; let callers decide what to do with them.
   - **Utilities:** Cross-cutting concerns shared across all layers (logging, mapping, common helpers).

3. **Respect service boundaries.** A service at one level may only call services at lower levels. Managers call Engines and Accessors. Engines call Accessors. Accessors call nothing above themselves. Never skip layers downward or call upward.

4. **Contracts at boundaries.** Services communicate through explicit request/response objects or well-defined interfaces — not loose parameter lists. This keeps boundaries clean and refactorable.
   ```
   // Prefer
   serviceMethod(request: MyRequest): MyResponse

   // Avoid
   serviceMethod(param1: string, param2: number, param3: boolean): SomeType
   ```

5. **Polymorphic request/response design.** Where a service method handles multiple variations of a concept (e.g., different notification types, different payment methods, different report formats), model them as a polymorphic hierarchy — a base request/response class with specialized subtypes — rather than a single flat object with conditional fields or a growing list of parameters. This keeps each variant self-contained, makes adding new variants a matter of adding a new subtype (open/closed principle), and avoids brittle conditional chains that grow with every new case.

   **Coarse-grained service interfaces with handler dispatch.** Keep the public service interface small — prefer a few broad operations (e.g., `Store`, `Load`, `Remove`) over a method-per-variant explosion (e.g., `createEmail`, `createSms`, `updateEmail`, `updateSms`). The service method inspects the polymorphic request type and dispatches to the appropriate handler internally. This keeps the surface area minimal for callers while the handler layer manages variant-specific logic.

   ```
   // Service exposes a small interface
   class NotificationEngine {
     store(request: NotificationRequest): NotificationResponse {
       // dispatch to the right handler based on request type
       const handler = this.resolveHandler(request)
       return handler.store(request)
     }

     load(request: NotificationRequest): NotificationResponse { ... }
   }

   // Handlers own the variant-specific logic
   class EmailNotificationHandler { store(request: EmailNotificationRequest) { ... } }
   class SmsNotificationHandler   { store(request: SmsNotificationRequest)   { ... } }

   // Polymorphic request subtypes
   abstract class NotificationRequest { ... }
   class EmailNotificationRequest extends NotificationRequest { subject: string; body: string }
   class SmsNotificationRequest extends NotificationRequest { phoneNumber: string; message: string }

   // Avoid: method-per-variant
   createEmailNotification(request: EmailRequest): EmailResponse
   createSmsNotification(request: SmsRequest): SmsResponse
   updateEmailNotification(request: EmailRequest): EmailResponse
   // ... grows with every new variant
   ```

6. **Thin clients.** Controllers/route handlers handle HTTP concerns only — auth, validation, request parsing, response formatting. Delegate everything else to managers or engines.

6. **Accessor pattern for data access.** All database queries and external API calls live in dedicated accessor modules. Route handlers and business logic never talk to the database directly.

### Applying VBD Pragmatically

Not every project needs every layer. Scale the architecture to the problem:

- **Small projects / PoCs:** You might only need Controllers and Accessors. Don't introduce Managers and Engines until the complexity demands it.
- **Medium projects:** Controllers, Engines, and Accessors are usually sufficient.
- **Large projects:** The full hierarchy (Controllers, Managers, Engines, Accessors, Utilities) keeps things maintainable.

The goal is separation of concerns proportional to the project's complexity. A premature Manager layer is just as harmful as a God Controller.

## Design Principles

### KISS (Keep It Simple)

- Prefer the simplest solution that works.
- Avoid premature abstraction — wait until a pattern repeats before extracting it.
- Complexity must be justified by a concrete requirement, not a hypothetical one.
- Three similar lines of code is better than a premature abstraction.

### DRY (Don't Repeat Yourself)

- Extract shared logic when the same pattern appears in **two or more** places.
- Cross-cutting concerns (auth, error handling, logging) belong in centralized wrappers — not duplicated at every call site.
- **Balance DRY with KISS:** a small amount of duplication is better than a premature or unclear abstraction.

### Separation of Concerns

- Each file/module should have one clear responsibility.
- Route handlers handle HTTP. Services handle business logic. Accessors handle data. Components handle rendering.
- When a behavior applies to all requests or all components, centralize it rather than repeating inline checks everywhere.

## Testing

- **Every new feature must include tests.** No feature is complete without them.
- **Every bug fix must include a regression test** that would have caught the bug.
- **Test behavior, not implementation.** Verify what the user experiences (rendered output, API responses), not internal function calls or state shapes.
- **Only test executable logic.** Don't write tests for static contracts (enums, DTOs, interfaces, type definitions, constants).
- **Update existing tests** when modifying behavior — stale tests are worse than no tests.
- **Co-locate tests with source files** (e.g., `foo.spec.ts` next to `foo.ts`), not in a separate `tests/` tree.
- Mock external dependencies (databases, third-party APIs). Use real implementations for internal code whenever practical.

## Code Style

### Naming Conventions

- **Files:** kebab-case (`todo-list.tsx`, `user-service.ts`)
- **Classes/Components:** PascalCase (`TodoList`, `UserService`)
- **Functions/Variables:** camelCase (`createTodo`, `isActive`)
- **Types/Interfaces:** PascalCase (`Todo`, `UserProfile`)
- **Database tables/columns:** snake_case (`user_profiles`, `created_at`)

### TypeScript

- Strict mode enabled. No `any` types — use `unknown` if the type is truly unknown.
- Explicit types for function parameters and return types.
- Prefer type inference for local variables where the type is obvious.

### General

- Comments explain **why**, not what. If code needs a comment explaining what it does, it should be rewritten to be clearer.
- No dead code. If something is unused, delete it — don't comment it out.
- Avoid backwards-compatibility shims, re-exports, or `_unused` variables. Clean up fully.

## Development Workflow

### Verify Before Committing

Always run these checks before staging changes:

1. **Build check** — ensures the project compiles without errors
2. **Type check** — validates types without a full build (e.g., `tsc --noEmit`)
3. **Tests** — all tests must pass; no regressions

```bash
pnpm run build
pnpm run typecheck
pnpm test
```

### Git Conventions

- Never commit secrets, `.env` files, or credentials.
- Commit messages should be concise and explain the **why** behind the change.
- Keep commits focused — one logical change per commit.

### Documentation

- Keep the README up to date when setup, config, or commands change.
- Include prerequisites, exact commands, and troubleshooting for anything a new developer needs to run the project.
- Every migration or schema change should include comments explaining the reasoning.

## Project-Specific Details

### Essential Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Run in development mode
pnpm build                # Compile TypeScript
pnpm start                # Run compiled output
pnpm typecheck            # Type check without emitting
pnpm test                 # Run tests
pnpm test:watch           # Run tests in watch mode
pnpm deploy-commands      # Register slash commands with Discord
pnpm db:generate          # Generate DB migration after schema changes
pnpm db:migrate           # Run DB migrations
```

### Environment Setup

Copy `.env.example` to `.env` and fill in: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `BOT_PREFIX`, `PURGE_CHANNEL_IDS`.

### Repository Structure

- `src/clients/` — Discord client (VBD Client layer). Handles connection and event wiring.
- `src/engines/` — Business logic (VBD Engine layer). Command dispatch, channel operations.
- `src/accessors/` — Data access (VBD Accessor layer). Discord API calls, database connection.
- `src/commands/` — Command definitions. Each file exports a `Command` object.
- `src/events/` — Event handler definitions. Each file exports an `EventHandler` object.
- `src/types/` — Shared interfaces and request/response contracts.
- `src/db/` — Drizzle ORM schema definitions.
- `src/utilities/` — Cross-cutting concerns (config, logging).
- `scripts/` — One-off scripts (slash command deployment).

### Adding a Command

1. Create `src/commands/my-command.ts` implementing the `Command` interface
2. Import and add to the array in `src/commands/index.ts`
3. Run `pnpm deploy-commands`
4. **Update README.md** — add a detailed command reference entry (see existing entries for format)

#### Command Requirements

- Every command must support **both slash and prefix invocation** (`executeSlash` and `executePrefix`).
- **Permission restrictions are per-command**, not global. Each command decides its own permission requirements via `setDefaultMemberPermissions` (slash) and manual permission checks (prefix).
- Commands that perform destructive or sensitive operations should be restricted to specific channels or roles via configuration (env vars), not hardcoded.

#### README Command Documentation

Every command must have a detailed entry in the **Command Reference** section of `README.md`. Each entry must include:

| Section | Description |
|---|---|
| **Usage** | Table showing slash and prefix invocation examples |
| **Parameters** | Table with type, required, default, range, and description |
| **Permission** | Who can use it and how permissions are enforced (slash vs prefix) |
| **Configuration** | Env variables needed, with examples and setup steps |
| **Bot Permissions Required** | Discord permissions the bot needs to execute |
| **Behavior** | Step-by-step description of what the command does |
| **Limitations** | Known constraints, rate limits, edge cases |

See the `/ping` and `/purge` entries in README.md for reference.

### Adding an Event Handler

1. Create `src/events/my-event.ts` implementing the `EventHandler` interface
2. Import and add to the array in `src/events/index.ts`

### Database

SQLite via Drizzle ORM. Schema in `src/db/schema.ts`. Connection in `src/accessors/database.ts`. DB file at `data/bot.db` (gitignored).
