// PROTOTYPE — throwaway Knock spike probe. Never merge.
// Run: npx tsx --env-file=.env scripts/PROTOTYPE-knock-probe.ts
import Knock from "@knocklabs/node";

const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });
console.log("feed channel id set:", Boolean(process.env.KNOCK_FEED_CHANNEL_ID));

for (const key of ["discussion-reply", "new-enrollment"]) {
  try {
    const r = await knock.workflows.trigger(key, {
      recipients: ["probe-user"],
      data: { probe: true },
    });
    console.log(key, "-> triggered", r);
  } catch (e: any) {
    console.log(key, "->", e.status, JSON.stringify(e.error ?? e.message));
  }
}

try {
  const prefs = await knock.users.listPreferences("probe-user");
  console.log("probe-user preferences:", JSON.stringify(prefs, null, 2));
} catch (e: any) {
  console.log("prefs ->", e.status, JSON.stringify(e.error ?? e.message));
}
