// PROTOTYPE — throwaway. Runs the four Knock checks end to end. Never merge.
// Run: npx tsx scripts/PROTOTYPE-knock-checks.ts
import {
  knockEnv,
  notifyDiscussionReply,
  notifyNewEnrollment,
  signTokenFor,
} from "~/lib/PROTOTYPE-knock.server";

const KNOCK = "https://api.knock.app/v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Browser-shaped call: public key + signed user token, never the secret key.
async function asUser(userId: number, path: string, init: RequestInit = {}) {
  const token = await signTokenFor(userId);
  const res = await fetch(`${KNOCK}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${knockEnv.publicKey}`,
      "X-Knock-User-Token": token,
      "Content-Type": "application/json",
    },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}
const feed = (u: number, q = "") =>
  asUser(u, `/users/${u}/feeds/${knockEnv.feedChannelId}?page_size=50${q}`);

async function waitForEntry(u: number, workflow: string, since: number, ms = 20000) {
  for (let t = 0; t < ms; t += 1000) {
    const f = await feed(u);
    const hit = (f.body?.entries ?? []).find(
      (e: any) => (e.source?.key ?? e.workflow?.key) === workflow &&
        Date.parse(e.inserted_at) >= since
    );
    if (hit) return hit;
    await sleep(1000);
  }
  return null;
}

const results: Record<string, unknown> = {};

// 1. Signed user tokens
{
  const own5 = await feed(5);
  const cross = await asUser(5, `/users/6/feeds/${knockEnv.feedChannelId}`);
  const own6 = await feed(6);
  results["1 own feed (user 5)"] = own5.status;
  results["1 user 5 token -> user 6 feed"] = `${cross.status} ${JSON.stringify(cross.body)}`;
  results["1 own feed (user 6)"] = own6.status;
}

// 2. Trigger Discussion Reply: reply #2 by Sarah (2) to Emma's (5) question #1
{
  const since = Date.now() - 2000;
  const r = await notifyDiscussionReply(2);
  results["2 trigger"] = r;
  const hit = await waitForEntry(5, "discussion-reply", since);
  results["2 entry in Emma's feed"] = hit
    ? { id: hit.id, data: hit.data, blocks: hit.blocks?.map((b: any) => b.rendered) }
    : "NOT FOUND";

  // 3. Headless feed: counts + mark seen/read/unread
  if (hit) {
    const meta = async () => (await feed(5)).body.meta;
    const before = await meta();
    const seen = await asUser(5, `/messages/${hit.id}/seen`, { method: "PUT" });
    const read = await asUser(5, `/messages/${hit.id}/read`, { method: "PUT" });
    const afterRead = await meta();
    const unread = await asUser(5, `/messages/${hit.id}/read`, { method: "DELETE" });
    const afterUnread = await meta();
    const unreadFilter = await feed(5, "&status=unread");
    results["3 meta before"] = before;
    results["3 PUT seen / PUT read / DELETE read"] = [seen.status, read.status, unread.status];
    results["3 meta after read"] = afterRead;
    results["3 meta after unread"] = afterUnread;
    results["3 status=unread filter count"] = unreadFilter.body?.entries?.length;
    const batch = await asUser(5, `/messages/batch/seen`, {
      method: "POST",
      body: JSON.stringify({ message_ids: [hit.id] }),
    });
    results["3 batch seen"] = batch.status;
  }
}

// 4. Preferences: new Enrollment -> Instructor Sarah (2), student Emma (5), course 1
{
  const prefsPath = `/users/2/preferences/default`;
  results["4 prefs before"] = await asUser(2, prefsPath);

  let since = Date.now() - 2000;
  results["4 trigger (default prefs)"] = await notifyNewEnrollment(5, 1);
  const hitDefault = await waitForEntry(2, "new-enrollment", since, 12000);
  results["4 delivered with default prefs?"] = Boolean(hitDefault);

  const optIn = await asUser(2, prefsPath, {
    method: "PUT",
    body: JSON.stringify({
      categories: { enrollments: { channel_types: { in_app_feed: true } } },
    }),
  });
  results["4 opt-in PUT (user token)"] = `${optIn.status} ${JSON.stringify(optIn.body)}`;
  since = Date.now() - 2000;
  await notifyNewEnrollment(5, 1);
  results["4 delivered after opt-in?"] = Boolean(
    await waitForEntry(2, "new-enrollment", since, 12000)
  );

  const optOut = await asUser(2, prefsPath, {
    method: "PUT",
    body: JSON.stringify({
      categories: { enrollments: { channel_types: { in_app_feed: false } } },
    }),
  });
  results["4 opt-out PUT"] = optOut.status;
  since = Date.now() - 2000;
  await notifyNewEnrollment(5, 1);
  results["4 delivered after opt-out?"] = Boolean(
    await waitForEntry(2, "new-enrollment", since, 12000)
  );
  results["4 prefs after"] = (await asUser(2, prefsPath)).body;
}

console.log(JSON.stringify(results, null, 2));
