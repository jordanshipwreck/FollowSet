import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handleRpc, type SuggestedProgram } from "../../supabase/functions/_shared/mcp.ts";

const snapshot = { v: 1, at: "2026-10-27T00:00:00Z", units: "lb", summary: "Today: 2026-10-27 (Tue). Program: Followset Original.",
  program: { id: "o", title: "Followset Original", creator: "Jordan", days: {} },
  sessions: [{ date: "2026-10-26", day: "Mon", program: "o", finished: true, sets: [{ name: "Incline DB press", side: null, set: 1, weight: "60", reps: "10" }], ratings: [] }],
  health: { metrics: {}, labs: [], food: [], goals: { cal: 2500, protein: 200, carbs: 250, fat: 80 } } } as const;
const saved: SuggestedProgram[] = [];
// Mirrors supabase/functions/mcp/index.ts: key check, POST JSON-RPC, 202 for notifications, 405 for GET.
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, "http://x");
  if (url.searchParams.get("key") !== "fs_test") { res.writeHead(401).end(); return; }
  if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
  let raw = ""; for await (const c of req) raw += c;
  const body = JSON.parse(raw);
  const batch = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(batch.map((m) => handleRpc(m, { snapshot: snapshot as never, now: new Date("2026-10-27"), suggest: async (p) => { saved.push(p); return "1"; } })))).filter(Boolean);
  if (!out.length) { res.writeHead(202).end(); return; }
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(Array.isArray(body) ? out : out[0]));
});
server.listen(5181, async () => {
  const client = new Client({ name: "e2e", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost:5181/mcp?key=fs_test")));
  console.log("server:", client.getServerVersion()?.name, "| instructions:", !!client.getInstructions());
  const { tools } = await client.listTools();
  console.log("tools:", tools.map((t) => t.name).join(", "));
  const ov = await client.callTool({ name: "get_overview", arguments: {} });
  console.log("overview:", (ov.content as { text: string }[])[0].text.slice(0, 60));
  const lh = await client.callTool({ name: "get_lift_history", arguments: { exercise: "incline" } });
  console.log("lift:", (lh.content as { text: string }[])[0].text.replace(/\s+/g, " ").slice(0, 90));
  const sp = await client.callTool({ name: "suggest_program", arguments: { title: "Upper focus", days: { Tue: { title: "Upper", blocks: [{ label: "Straight", rest: 90, exercises: [{ name: "Pull-up", sets: 4, reps: "6-8" }] }] } } } });
  console.log("suggest:", sp.isError, (sp.content as { text: string }[])[0].text.slice(0, 50), "| stored:", saved.length);
  await client.close(); server.close();
});
