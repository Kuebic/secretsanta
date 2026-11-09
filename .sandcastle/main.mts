/**
 * Runs the worker-rebuild tickets, unattended.
 *
 *   npm run sandcastle              # work every unblocked ticket, then review the branch
 *   DRY_RUN=1 npm run sandcastle    # print the plan, spend nothing
 *
 * One repo, one integration branch, one task graph. Tickets live in
 * `.scratch/worker-rebuild/issues/` (mirrors of GitHub issues #1–#14). A ticket
 * whose `**Status:**` on the integration branch says `resolved` is done, so a
 * re-run picks up where the last one stopped. Tickets marked `human` are never
 * run; the loop prints whether they are ready at the end.
 *
 * Shape follows ne-hj-arts/.sandcastle/main.ts (the previous run): Opus
 * implements one ticket per worktree, Fable reviews the branch once every
 * agent ticket is resolved.
 */
import { run, claudeCode } from "@ai-hero/sandcastle";
import { bwrap } from "@ai-hero/sandcastle/sandboxes/bwrap";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const HERE = import.meta.dirname;
const ROOT = resolve(HERE, "..");

const IMPLEMENTER = "claude-opus-5-5";
const REVIEWER = "claude-fable-5-1";

const BRANCH = "feat/worker-rebuild";
const SPEC = ".scratch/worker-rebuild/spec.md";
const TICKETS_DIR = ".scratch/worker-rebuild/issues";
/** Runs inside the sandbox before every agent; the worktree keeps node_modules between runs. */
const SETUP = "npm install --no-audit --no-fund";

type Ticket = { id: string; file: string; blockedBy: string[]; human?: boolean };

const tickets: Ticket[] = [
  { id: "01", file: "01-draw-generator-crypto-random-selection-and-backtracking.md", blockedBy: [] },
  { id: "02", file: "02-mutual-exclusion-both-ways-toggle-on-must-not-rules.md", blockedBy: [] },
  { id: "03", file: "03-hosting-serve-app-and-api-from-one-cloudflare-worker.md", blockedBy: [] },
  { id: "04", file: "04-event-organizer-link-and-encrypted-blobs-in-kv.md", blockedBy: ["03"] },
  { id: "05", file: "05-avoid-previous-draw-import-must-not-rules-from-a-past-event.md", blockedBy: ["04"] },
  { id: "06", file: "06-migrate-legacy-localstorage-data-into-an-event.md", blockedBy: ["04"] },
  { id: "07", file: "07-participant-link-with-identity-confirmation.md", blockedBy: ["04"] },
  { id: "08", file: "08-assignments-on-the-server-envelope-reveal-opened-tracking.md", blockedBy: ["07"] },
  { id: "09", file: "09-share-actions-copy-link-copy-as-message-web-share.md", blockedBy: ["07"] },
  { id: "10", file: "10-event-details-budget-date-location-calendar-file.md", blockedBy: ["07"] },
  { id: "11", file: "11-wishlist-editor-and-giver-view.md", blockedBy: ["08"] },
  { id: "12", file: "12-organizer-status-table-and-nudge.md", blockedBy: ["11"] },
  { id: "13", file: "13-french-translations-for-the-new-features.md", blockedBy: ["05", "08", "09", "10", "11", "12"] },
  {
    id: "14",
    file: "14-create-the-kv-namespace-deploy-verify-end-to-end.md",
    blockedBy: ["03", "04", "07", "08", "11", "12"],
    human: true,
  },
];

const ticketPath = (t: Ticket) => `${TICKETS_DIR}/${t.file}`;

// --- reading progress off the branch ----------------------------------------

function git(args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
}

function ticketStatus(t: Ticket): string {
  const onBranch = git(["show", `${BRANCH}:${ticketPath(t)}`]);
  const text = onBranch ?? readFileSync(resolve(ROOT, ticketPath(t)), "utf8");
  return /\*\*Status:\*\*\s*([\w-]+)/.exec(text)?.[1] ?? "unknown";
}

// --- one ticket, one agent --------------------------------------------------

async function implement(t: Ticket): Promise<string> {
  await run({
    name: t.id,
    agent: claudeCode(IMPLEMENTER),
    sandbox: bwrap(),
    cwd: ROOT,
    branchStrategy: { type: "branch", branch: BRANCH },
    promptFile: resolve(HERE, "prompt.md"),
    promptArgs: { TICKET_PATH: ticketPath(t), SPEC_PATH: SPEC },
    hooks: { sandbox: { onSandboxReady: [{ command: SETUP, timeoutMs: 600_000 }] } },
    maxIterations: 3,
    completionSignal: ["<promise>COMPLETE</promise>", "<promise>BLOCKED</promise>"],
    idleTimeoutSeconds: 900,
    logging: { type: "file", path: resolve(HERE, `logs/${t.id}.log`) },
  });
  return ticketStatus(t);
}

/** A review that finished leaves this file, so a re-run does not review twice. */
const reviewMarker = resolve(HERE, "logs/review.done");

async function review(): Promise<void> {
  await run({
    name: "review",
    agent: claudeCode(REVIEWER),
    sandbox: bwrap(),
    cwd: ROOT,
    branchStrategy: { type: "branch", branch: BRANCH },
    promptFile: resolve(HERE, "review.md"),
    promptArgs: { FIXED_POINT: "main", SPEC_PATH: SPEC, TICKETS_DIR },
    hooks: { sandbox: { onSandboxReady: [{ command: SETUP, timeoutMs: 600_000 }] } },
    maxIterations: 2,
    idleTimeoutSeconds: 900,
    logging: { type: "file", path: resolve(HERE, "logs/review.log") },
  });
  writeFileSync(reviewMarker, new Date().toISOString() + "\n");
}

// --- the loop ---------------------------------------------------------------

const done = new Set<string>();
const stuck = new Map<string, string>();

for (const t of tickets) if (ticketStatus(t) === "resolved") done.add(t.id);

const frontier = () =>
  tickets.filter((t) => !t.human && !done.has(t.id) && !stuck.has(t.id) && t.blockedBy.every((b) => done.has(b)));

if (process.env.DRY_RUN) {
  console.log("already resolved:", [...done].join(", ") || "none");
  console.log("frontier now:", frontier().map((t) => t.id).join(", ") || "none");
  for (const t of tickets) console.log(`  ${t.id}  ${t.human ? "HUMAN " : "agent "} ← ${t.blockedBy.join(", ") || "-"}`);
  process.exit(0);
}

if (!existsSync(resolve(HERE, ".env"))) {
  throw new Error(`.sandcastle/.env is missing. Copy .env.example and set CLAUDE_CODE_OAUTH_TOKEN (claude setup-token).`);
}

// One worktree per branch, so tickets run one at a time.
while (true) {
  const next = frontier()[0];
  if (!next) break;
  console.log(`▶ ${next.id} on ${BRANCH}`);
  try {
    const status = await implement(next);
    if (status === "resolved") done.add(next.id);
    else stuck.set(next.id, status);
    console.log(`${status === "resolved" ? "✔" : "✖"} ${next.id}: ${status}`);
  } catch (error) {
    stuck.set(next.id, `error: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`✖ ${next.id}: ${stuck.get(next.id)}`);
  }
}

const agentTickets = tickets.filter((t) => !t.human);
if (!existsSync(reviewMarker) && agentTickets.every((t) => done.has(t.id))) {
  console.log(`▶ review with ${REVIEWER}`);
  try {
    await review();
    console.log("✔ review");
  } catch (error) {
    console.log(`✖ review: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- what is left for a person ---------------------------------------------

console.log("\nDone:", [...done].join(", ") || "none");
if (stuck.size) {
  process.exitCode = 1;
  console.log("Stuck (read the ticket's Comments and the log):");
  for (const [id, why] of stuck) console.log(`  ${id}: ${why}`);
}
for (const t of tickets.filter((t) => t.human)) {
  const ready = t.blockedBy.every((b) => done.has(b));
  console.log(
    `\nHuman ticket ${t.id} (${ticketPath(t)}): ${ready ? "READY, everything it waits on is in" : "not yet: waiting on " + t.blockedBy.filter((b) => !done.has(b)).join(", ")}`,
  );
}
console.log(`\nBranch: ${BRANCH} in ${ROOT}`);
