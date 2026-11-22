// PROTOTYPE — throwaway Knock spike route at /prototype/knock.
// Answers "Does Knock hold up against Cadence?". Never merge.
import { useCallback, useEffect, useState } from "react";
import { data, Form, Link, useActionData } from "react-router";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Route } from "./+types/PROTOTYPE.knock";
import { getCurrentUserId } from "~/lib/session";
import { db } from "~/db";
import { comments, courses, enrollments, lessons, modules, users } from "~/db/schema";
import {
  knockEnv,
  knockUserId,
  notifyDiscussionReply,
  notifyNewEnrollment,
  signTokenFor,
} from "~/lib/PROTOTYPE-knock.server";

const KNOCK = "https://api.knock.app/v1";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }
  const me = db.select().from(users).where(eq(users.id, userId)).get()!;

  // Recent replies by someone other than the question author: candidates for check 2.
  const recentReplies = db
    .select({
      replyId: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      lessonId: comments.lessonId,
      lessonTitle: lessons.title,
      courseSlug: courses.slug,
      replierId: comments.userId,
    })
    .from(comments)
    .innerJoin(lessons, eq(comments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(isNotNull(comments.parentId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.id))
    .limit(5)
    .all();

  // Enrollments on courses this user teaches: candidates for check 4.
  const myEnrollments = db
    .select({
      studentId: enrollments.userId,
      courseId: courses.id,
      courseTitle: courses.title,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(courses.instructorId, userId))
    .limit(3)
    .all();

  return {
    me: { id: me.id, name: me.name, role: me.role },
    knockUserId: knockUserId(userId),
    userToken: await signTokenFor(userId),
    publicKey: knockEnv.publicKey,
    feedChannelId: knockEnv.feedChannelId,
    recentReplies,
    myEnrollments,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "reply") {
      const r = await notifyDiscussionReply(Number(form.get("replyId")));
      return { intent, result: r };
    }
    if (intent === "enrollment") {
      const r = await notifyNewEnrollment(
        Number(form.get("studentId")),
        Number(form.get("courseId"))
      );
      return { intent, result: r };
    }
  } catch (e: any) {
    return { intent, error: { status: e.status, body: e.error ?? e.message } };
  }
  return { intent, error: "unknown intent" };
}

export default function KnockSpike({ loaderData }: Route.ComponentProps) {
  const { me, knockUserId, userToken, publicKey, feedChannelId } = loaderData;
  const actionData = useActionData<typeof action>();
  const [log, setLog] = useState<{ label: string; status: number; body: unknown }[]>([]);
  const [feed, setFeed] = useState<any>(null);
  const [prefs, setPrefs] = useState<any>(null);

  // Every call goes browser -> Knock with the public key + signed user token.
  const call = useCallback(
    async (label: string, path: string, init?: RequestInit) => {
      const res = await fetch(`${KNOCK}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${publicKey}`,
          "X-Knock-User-Token": userToken,
          "Content-Type": "application/json",
        },
      });
      const body = await res.json().catch(() => null);
      setLog((l) => [{ label, status: res.status, body }, ...l].slice(0, 12));
      return { status: res.status, body };
    },
    [publicKey, userToken]
  );

  const loadFeed = useCallback(async () => {
    const r = await call(
      "list feed",
      `/users/${knockUserId}/feeds/${feedChannelId}?page_size=20`
    );
    setFeed(r.body);
  }, [call, knockUserId, feedChannelId]);

  const loadPrefs = useCallback(async () => {
    const r = await call("get prefs", `/users/${knockUserId}/preferences/default`);
    setPrefs(r.body);
  }, [call, knockUserId]);

  useEffect(() => {
    setFeed(null);
    setPrefs(null);
    setLog([]);
    if (feedChannelId) loadFeed();
    loadPrefs();
  }, [knockUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const markOne = async (id: string, status: "read" | "seen" | "unread") => {
    await call(`mark ${status}`, `/messages/${id}/${status}`, { method: "PUT" });
    loadFeed();
  };
  const markAllSeen = async () => {
    const ids = (feed?.entries ?? []).map((e: any) => e.id);
    await call("batch seen", `/messages/batch/seen`, {
      method: "POST",
      body: JSON.stringify({ message_ids: ids }),
    });
    loadFeed();
  };
  const setEnrollmentPref = async (inApp: boolean) => {
    await call(`prefs enrollments.in_app_feed=${inApp}`, `/users/${knockUserId}/preferences/default`, {
      method: "PUT",
      body: JSON.stringify({
        categories: { enrollments: { channel_types: { in_app_feed: inApp } } },
      }),
    });
    loadPrefs();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 font-mono text-sm">
      <div className="rounded border border-amber-500 bg-amber-50 p-3 text-amber-900">
        PROTOTYPE — Knock spike. Switch users in the DevUI panel; everything below follows.
      </div>

      <section>
        <h2 className="font-bold">1. Signed user token</h2>
        <div>Cadence user: {me.name} (#{me.id}, {me.role}) → Knock user "{knockUserId}"</div>
        <div className="break-all text-xs text-gray-500">token: {userToken.slice(0, 60)}…</div>
        <div>feed channel id: {feedChannelId || "MISSING — set KNOCK_FEED_CHANNEL_ID"}</div>
        <button
          className="mt-1 underline"
          onClick={() =>
            call(
              `(negative) read user ${Number(knockUserId) + 1}'s feed with my token`,
              `/users/${Number(knockUserId) + 1}/feeds/${feedChannelId}`
            )
          }
        >
          (negative) read another user's feed with my token — expect rejection
        </button>
      </section>

      <section>
        <h2 className="font-bold">2. Trigger Discussion Reply (Node SDK)</h2>
        <p>Replies posted on lesson pages also fire this automatically (hooked into createComment).</p>
        <ul>
          {loaderData.recentReplies.map((r) => (
            <li key={r.replyId}>
              <Form method="post" className="inline">
                <input type="hidden" name="intent" value="reply" />
                <input type="hidden" name="replyId" value={r.replyId} />
                <button className="underline">re-fire</button>
              </Form>{" "}
              reply #{r.replyId} by user #{r.replierId} on{" "}
              <Link className="underline" to={`/courses/${r.courseSlug}/lessons/${r.lessonId}`}>
                {r.lessonTitle}
              </Link>
              : "{r.body.slice(0, 50)}"
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-bold">3. Headless feed</h2>
        <div>
          unread: {feed?.meta?.unread_count ?? "?"} · unseen: {feed?.meta?.unseen_count ?? "?"} · total: {feed?.meta?.total_count ?? "?"}
        </div>
        <button className="underline" onClick={loadFeed}>refresh</button>{" "}
        <button className="underline" onClick={markAllSeen}>mark all seen</button>
        <ul className="mt-2 space-y-1">
          {(feed?.entries ?? []).map((e: any) => (
            <li key={e.id} className="rounded border p-2">
              <div>
                [{e.workflow?.key ?? e.source?.key}] {e.read_at ? "read" : "UNREAD"} · {e.seen_at ? "seen" : "UNSEEN"}
              </div>
              <div className="text-xs">{JSON.stringify(e.data)}</div>
              <button className="underline" onClick={() => markOne(e.id, "seen")}>seen</button>{" "}
              <button className="underline" onClick={() => markOne(e.id, "read")}>read</button>{" "}
              <button className="underline" onClick={() => markOne(e.id, "unread")}>unread</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-bold">4. Preferences: new Enrollment → Instructor (off by default)</h2>
        <ul>
          {loaderData.myEnrollments.length === 0 && <li>Switch to an Instructor with enrollments.</li>}
          {loaderData.myEnrollments.map((en) => (
            <li key={`${en.studentId}-${en.courseId}`}>
              <Form method="post" className="inline">
                <input type="hidden" name="intent" value="enrollment" />
                <input type="hidden" name="studentId" value={en.studentId} />
                <input type="hidden" name="courseId" value={en.courseId} />
                <button className="underline">fire new-enrollment</button>
              </Form>{" "}
              student #{en.studentId} → {en.courseTitle}
            </li>
          ))}
        </ul>
        <button className="underline" onClick={() => setEnrollmentPref(true)}>opt in (in_app_feed)</button>{" "}
        <button className="underline" onClick={() => setEnrollmentPref(false)}>opt out</button>
        <pre className="mt-2 max-h-60 overflow-auto bg-gray-100 p-2 text-xs">{JSON.stringify(prefs, null, 2)}</pre>
      </section>

      <section>
        <h2 className="font-bold">Last server action</h2>
        <pre className="bg-gray-100 p-2 text-xs">{JSON.stringify(actionData ?? null, null, 2)}</pre>
        <h2 className="font-bold">Browser → Knock call log</h2>
        <pre className="max-h-96 overflow-auto bg-gray-100 p-2 text-xs">{JSON.stringify(log, null, 2)}</pre>
      </section>
    </div>
  );
}
