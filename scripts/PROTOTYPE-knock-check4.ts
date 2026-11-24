// PROTOTYPE — throwaway. Check 4 with count deltas on a fresh user. Never merge.
import { signUserToken } from "@knocklabs/node";
import { knock, knockEnv } from "~/lib/PROTOTYPE-knock.server";
const uid = `spike-instructor-${Date.now()}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const call = async (path: string, init: RequestInit = {}) => {
  const t = await signUserToken(uid, { expiresInSeconds: 600 });
  const r = await fetch(`https://api.knock.app/v1${path}`, { ...init, headers: { Authorization: `Bearer ${knockEnv.publicKey}`, "X-Knock-User-Token": t, "Content-Type": "application/json" } });
  return r.json() as any;
};
const total = async () => (await call(`/users/${uid}/feeds/${knockEnv.feedChannelId}`)).meta?.total_count ?? 0;
const fire = async (label: string) => {
  const before = await total();
  await knock.workflows.trigger("new-enrollment", { recipients: [{ id: uid, name: "Spike Instructor" }], data: { student_name: "X", course_title: "Y", url: "/" } });
  await sleep(10000);
  console.log(label, "delivered:", (await total()) > before);
};
const setPref = (v: boolean) => call(`/users/${uid}/preferences/default`, { method: "PUT", body: JSON.stringify({ categories: { enrollments: { channel_types: { in_app_feed: v } } } }) });
await knock.users.update(uid, { name: "Spike Instructor" });
await knock.users.setPreferences(uid, "default", { categories: { enrollments: { channel_types: { in_app_feed: false } } } });
await fire("server-seeded off, no user action:");
await setPref(true); await fire("user opts in (user token):");
await setPref(false); await fire("user opts out again:");
process.exit(0);
await fire("fresh user, no prefs:");
await setPref(false); await fire("after opt-out:");
await setPref(true); await fire("after opt-in:");
