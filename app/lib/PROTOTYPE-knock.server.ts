// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?".
// Lives on the prototype/knock-spike branch only. Never merge.
import Knock, { signUserToken } from "@knocklabs/node";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { comments, courses, lessons, modules, users } from "~/db/schema";

// The dev server doesn't load .env into process.env; Node 22 can.
if (!process.env.KNOCK_SECRET_API_KEY) process.loadEnvFile(".env");

export const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });

export const knockEnv = {
  publicKey: process.env.KNOCK_PUBLIC_API_KEY ?? "",
  feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? "",
};

// Cadence user id -> Knock user id. Plain string of the numeric id.
export const knockUserId = (userId: number) => String(userId);

export async function signTokenFor(userId: number) {
  // Reads KNOCK_SIGNING_KEY from the env by default.
  return signUserToken(knockUserId(userId), { expiresInSeconds: 60 * 60 });
}

function getUser(userId: number) {
  return db.select().from(users).where(eq(users.id, userId)).get();
}

// Inline identify: Knock upserts the recipient from the trigger payload.
function recipientFor(userId: number) {
  const u = getUser(userId);
  if (!u) throw new Error(`No user ${userId}`);
  return { id: knockUserId(u.id), name: u.name, email: u.email };
}

function lessonContext(lessonId: number) {
  return db
    .select({
      lessonTitle: lessons.title,
      lessonId: lessons.id,
      courseSlug: courses.slug,
      courseTitle: courses.title,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

// Discussion Reply -> question author. Not sent when you reply to yourself.
export async function notifyDiscussionReply(replyId: number) {
  const reply = db.select().from(comments).where(eq(comments.id, replyId)).get();
  if (!reply || reply.parentId === null) return { skipped: "not a reply" };
  const question = db
    .select()
    .from(comments)
    .where(eq(comments.id, reply.parentId))
    .get();
  if (!question) return { skipped: "question missing" };
  if (question.userId === reply.userId) return { skipped: "self-reply" };
  const ctx = lessonContext(reply.lessonId);
  if (!ctx) return { skipped: "lesson missing" };

  const actor = getUser(reply.userId);
  return knock.workflows.trigger("discussion-reply", {
    recipients: [recipientFor(question.userId)],
    actor: recipientFor(reply.userId),
    data: {
      replier_name: actor?.name,
      reply_excerpt: reply.body.slice(0, 140),
      lesson_title: ctx.lessonTitle,
      course_title: ctx.courseTitle,
      url: `/courses/${ctx.courseSlug}/lessons/${ctx.lessonId}#comment-${reply.id}`,
    },
  });
}

// new Enrollment -> Instructor. Catalogue says off by default, opt-in.
export async function notifyNewEnrollment(studentId: number, courseId: number) {
  const course = db.select().from(courses).where(eq(courses.id, courseId)).get();
  if (!course) throw new Error(`No course ${courseId}`);
  const student = getUser(studentId);
  return knock.workflows.trigger("new-enrollment", {
    recipients: [recipientFor(course.instructorId)],
    actor: recipientFor(studentId),
    data: {
      student_name: student?.name,
      course_title: course.title,
      url: `/instructor/${course.id}/students`,
    },
  });
}
