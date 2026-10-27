import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const out = process.argv[2];
let fails = 0;
const ok = (c: unknown, m: string) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const state = async () => (await fetch("http://localhost:5190/__state")).json();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("http://localhost:5191/", { waitUntil: "networkidle" });

// Sign in with an email code
await p.click("[data-testid=tab-me]");
await p.fill("[data-testid=cloud] input[type=email]", "kay@test.dev");
await p.click("text=Email me a code");
await p.fill("[data-testid=cloud] input[inputmode=numeric]", "000000");
await p.click("[data-testid=cloud] >> text=Sign in");
await p.waitForTimeout(400);
ok((await p.textContent("[data-testid=cloud]"))!.includes("Token has expired"), "wrong code shows the server's error");
await p.fill("[data-testid=cloud] input[inputmode=numeric]", "123456");
await p.click("[data-testid=cloud] >> text=Sign in");
await p.waitForTimeout(500);
ok((await p.textContent("[data-testid=cloud]"))!.includes("Signed in as kay@test.dev"), "signs in with the code");

// Discover pulls other creators' published programs
await p.click("[data-testid=tab-discover]"); await p.waitForTimeout(1200);
ok((await p.textContent("[data-testid=discover]"))!.includes("Rae Glute Lab"), "Discover shows a cloud program from another creator");

// Build + publish a program with an uploaded demo video
await p.click("[data-testid=open-studio]"); await p.waitForTimeout(300);
await p.fill("[data-testid=me-name]", "Coach Kay"); await p.click("[data-testid=me-save]");
await p.click("[data-testid=new-program]"); await p.waitForTimeout(300);
await p.fill("[data-testid=program-title]", "Kay Cloud Upper");
await p.click("[data-testid=add-workout]");
await p.click("[data-testid=add-block-Straight]");
await p.click("[data-testid=add-exercise]");
await p.fill("[data-testid=vault-search]", "flat db");
await p.click("[data-testid=vault-item] >> nth=0");
await p.click("[data-testid=item] >> nth=0 >> .item-head");
await p.click("[data-testid=film]"); await p.waitForTimeout(500);
await p.setInputFiles(".sheet input[type=file]", { name: "demo.webm", mimeType: "video/webm", buffer: Buffer.alloc(4096, 7) });
await p.click("text=Use this"); await p.waitForTimeout(500);
await p.click("[data-testid=publish]"); await p.waitForTimeout(3500);
let s = await state();
const prog = s.programs.find((x: any) => x.title === "Kay Cloud Upper");
ok(prog && prog.published && prog.creator_id === "uuid-A" && prog.creator_name === "Coach Kay", "published program reaches the cloud under the signed-in creator");
const vref = prog?.days?.Mon?.groups?.[0]?.items?.[0]?.videoRef ?? Object.values(prog?.days ?? {})[0]?.groups?.[0]?.items?.[0]?.videoRef;
ok(typeof vref === "string" && vref.startsWith("http://localhost:5190/storage/v1/object/public/media/uuid-A/"), "demo video uploaded and its public URL is in the program: " + vref);
ok(Object.values(s.media).some((m: any) => m.bytes === 4096 && m.type === "video/webm"), "storage holds the 4 KB webm");
const pushes = s.log.filter((l: string) => l.startsWith("POST /rest/v1/programs")).length;
await p.fill("[data-testid=program-title]", "Kay Cloud Upper v2"); await p.waitForTimeout(3000);
s = await state();
ok(s.programs.some((x: any) => x.title === "Kay Cloud Upper v2"), "editing a published program pushes the change");
ok(s.log.filter((l: string) => l.startsWith("POST /storage")).length === 1, "media is not re-uploaded on later edits");

// Snapshot sync
await p.waitForTimeout(6000);
s = await state();
const snap = s.userData["uuid-A"];
ok(snap && snap.v === 1 && snap.sessions.some((x: any) => x.date === "2026-10-26" && x.sets.length === 27), "snapshot synced with the logged Oct 26 session");

// Cloud coach
await p.click("[data-testid=tab-coach]"); await p.waitForTimeout(400);
await p.fill("[data-testid=coach-input]", "what should I eat after training?");
await p.click("[data-testid=coach-send]"); await p.waitForTimeout(1200);
const reply = await p.textContent("[data-testid=coach-reply] >> nth=-1");
ok(reply!.startsWith("CLOUD COACH: what should I eat after training?") && !reply!.includes("built-in coach"), "coach answers through the cloud function");
s = await state();
ok(s.coachCalls[0]?.context.includes("Program:"), "coach request carries the data summary");

// Connector link + a real MCP client
await p.click("[data-testid=open-connect]"); await p.waitForTimeout(300);
await p.click("[data-testid=create-connector]"); await p.waitForTimeout(600);
const link = await p.inputValue("[data-testid=connector-url]");
ok(/^http:\/\/localhost:5190\/functions\/v1\/mcp\?key=fs_/.test(link), "connector link created");
const client = new Client({ name: "claude-sim", version: "1" });
await client.connect(new StreamableHTTPClientTransport(new URL(link)));
const ov = await client.callTool({ name: "get_overview", arguments: {} });
ok((ov.content as any)[0].text.includes("Program:"), "outside assistant reads the synced overview");
const lh = await client.callTool({ name: "get_lift_history", arguments: { exercise: "incline" } });
ok((lh.content as any)[0].text.includes("2026-10-26"), "outside assistant reads lift history from the snapshot");
await client.callTool({ name: "suggest_program", arguments: { title: "Claude Push Pull", summary: "From your assistant", days: { Tue: { title: "Pull", blocks: [{ label: "Superset", rest: 90, exercises: [{ name: "Lat pulldown (high pulley)", sets: 4, reps: "8-10", rir: "1" }, { name: "Face pull", sets: 3, reps: "15", rir: "2" }] }] } } } });
await client.close();
await p.keyboard.press("Escape").catch(() => {});

// Suggestion arrives in Studio when the app comes back to the foreground
await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p.waitForTimeout(1500);
const toastTxt = await p.textContent("body");
ok(toastTxt!.includes("New suggested program in Studio: Claude Push Pull"), "app announces the suggestion");
s = await state();
ok(s.suggestions[0].claimed_at, "suggestion marked claimed");
await p.reload({ waitUntil: "networkidle" });
await p.click("[data-testid=tab-discover]"); await p.click("[data-testid=open-studio]"); await p.waitForTimeout(400);
const studio = await p.textContent("[data-testid=studio]");
ok(studio!.includes("Claude Push Pull"), "suggested program is a Studio draft");
await p.click("[data-testid=my-program] >> text=Claude Push Pull"); await p.waitForTimeout(300);
await p.click("[data-testid=week-Tue]").catch(() => {});
await p.click("text=Tue").catch(() => {});
await p.waitForTimeout(300);
await p.screenshot({ path: out + "/c-suggested.png", fullPage: true });
const ed = await p.textContent("[data-testid=editor]");
ok(ed!.includes("Lat pulldown") && ed!.includes("Face pull") && ed!.includes("Draft"), "draft holds the suggested moves and isn't published");

// Deleting a published program removes it from the cloud too
await p.click("[aria-label='Back to Studio']"); await p.waitForTimeout(300);
await p.click("[data-testid=my-program] >> text=Kay Cloud Upper v2"); await p.waitForTimeout(300);
await p.click("text=Delete program"); await p.click("text=Delete for good"); await p.waitForTimeout(800);
s = await state();
ok(!s.programs.some((x: any) => x.title.startsWith("Kay Cloud Upper")), "deleting a published program removes it from the cloud");
ok(s.programs.some((x: any) => x.id === "remote-1"), "other creators' programs are untouched");

ok(errs.length === 0, "no page errors " + errs.join(" | "));
await b.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
