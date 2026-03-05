import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { execSync } from "node:child_process";

const PORT = parseInt(process.env["DEPLOY_WEBHOOK_PORT"] ?? "9000", 10);
const SECRET = process.env["DEPLOY_WEBHOOK_SECRET"] ?? "";
const BRANCH = "main";

if (!SECRET) {
  console.error("DEPLOY_WEBHOOK_SECRET is required. Set it in your .env file.");
  process.exit(1);
}

function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", SECRET).update(payload).digest("hex");
  return signature === expected;
}

function deploy(): void {
  const commands = [
    "git pull origin main",
    "pnpm install --frozen-lockfile",
    "pnpm build",
    "pnpm db:migrate",
    "pnpm deploy-commands",
    "pm2 restart discord-bot",
  ];

  for (const cmd of commands) {
    console.log(`> ${cmd}`);
    try {
      execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
    } catch (error) {
      console.error(`Deploy failed at: ${cmd}`);
      console.error(error);
      return;
    }
  }

  console.log("Deploy complete!");
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString();
    const signature = req.headers["x-hub-signature-256"] as string | undefined;

    if (!verifySignature(body, signature)) {
      console.warn("Invalid webhook signature — ignoring request");
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    let payload: { ref?: string };
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    if (payload.ref !== `refs/heads/${BRANCH}`) {
      console.log(`Push to ${payload.ref} — ignoring (only deploys ${BRANCH})`);
      res.writeHead(200);
      res.end("Ignored — not target branch");
      return;
    }

    console.log(`Push to ${BRANCH} detected — deploying...`);
    res.writeHead(200);
    res.end("Deploying");

    // Run deploy async so we don't block the response
    setTimeout(deploy, 100);
  });
});

server.listen(PORT, () => {
  console.log(`Deploy webhook listening on port ${PORT}`);
  console.log(`URL: http://localhost:${PORT}/webhook`);
});
