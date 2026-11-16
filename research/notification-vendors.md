# Hosted notification vendors for Cadence

Research for issue #7, a child of map #6 "In-app Notifications for Cadence".
Checked on 2026-11-16 against official vendor docs and pricing pages.
Each claim cites its source page.

## Question

Which hosted notification vendors fit Cadence?
Cadence needs these things:

- An in-app feed built with headless React hooks and our own shadcn/Radix UI.
- Browser web push.
- Email as a possible later channel. SMS is out of scope.
- Notifications for every role: Student, Instructor, Platform Admin, Team Admin.
- Instructor broadcasts to the Students on a course.
- A feed that loads by recipient id, so a DevUI user switch shows that user's feed.
- A hosted service with a free tier. No self-hosting.

## Summary

| Vendor | Headless React hooks | Browser web push | Real-time | Email | Preferences | Broadcast to a course | Node SDK | Client auth | Free tier | Next paid tier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Knock | Yes, full | Through FCM only | Yes | Yes | Yes, hook | Objects + subscriptions, audiences, broadcasts | `@knocklabs/node` | RS256 user JWT (enhanced security) | 10,000 messages/month | $250/month, 50,000 messages |
| Novu Cloud | Yes, full | Through FCM, OneSignal, Pushpad, Pusher Beams | Yes | Yes | Yes, hook | Topics (up to 100,000 subscribers) | `@novu/api` | HMAC `subscriberHash` | 10,000 workflow runs/month | From $30/month |
| SuprSend | Yes, full | Native (VAPID + service worker) | Yes | Yes (bring your provider) | Yes, but plan gate unclear | Lists + broadcasts | `@suprsend/node-sdk` | ES256 user JWT (enhanced security) | 10,000 notifications/month, branded feed | $100/month, 50,000 |
| Courier | Partial (`useCourier()`) | Through OneSignal or Pusher Beams | Yes | Yes | Yes, details unverified | Lists, audiences, `list_pattern` | `@trycourier/courier` | JWT required | 10,000 sends/month | $0.005 per send from the first |
| MagicBell | No hooks, components only | Native (VAPID + service worker) | Yes | Yes | API + component | Broadcasts, 1,000 recipients per call | `magicbell-js` | HS256 user JWT | 1,000 deliveries/month | $249/month, 50,000 |
| Stream Feeds v3 | Yes, full | No | Yes | No | Not found | Follow model (course feed) | `@stream-io/node-sdk` | JWT user token | 5,000 activities/month | $499-$599/month |

## Recommended shortlist

1. **Knock.** Knock has the most complete headless React SDK and the best model for courses.
   - A course can be a Knock object. Students subscribe to it. One workflow trigger fans out to every subscriber.
   - `usePreferences` gives a headless preference UI.
   - Trade-off: web push needs Firebase (FCM), a Firebase SDK in the browser, a service worker and a VAPID key.
   - Trade-off: the first paid tier costs $250/month.
2. **Novu Cloud.** Novu has full headless hooks, Topics for course broadcasts, and the cheapest paid tier.
   - `useNotifications`, `useCounts` and `usePreferences` cover the feed, the bell count and settings.
   - Trade-off: web push needs a third-party provider, such as FCM or Pushpad.
   - Trade-off: the free tier allows only 5 workflows and 24 hours of activity retention.
3. **SuprSend.** SuprSend is the only vendor with full headless hooks and native VAPID web push.
   - Lists and broadcasts are on the free plan. Web push is a broadcast channel.
   - Trade-off: the free feed shows SuprSend branding.
   - Trade-off: the pricing page lists User Preferences only on the Business plan ($250/month). Confirm this with SuprSend.
   - Trade-off: the docs have small errors and mixed SDK versions.

Not recommended:

- **MagicBell** has native web push, but no headless hooks and only 1,000 free deliveries.
- **Courier** has no native web push and needs OneSignal or Pusher Beams for it.
- **Stream** has no web push and no email channel.
- **OneSignal** is strong at web push but has no web in-app feed.

## How each vendor identifies recipients

Every shortlisted vendor identifies a recipient by our own user id.
The DevUI user switch must remount the provider with the new user id.
In development, each vendor can run without signed tokens.
In production, the server must sign a token or hash for the current user:

- Knock signs an RS256 JWT with `sub` set to the user id.
- Novu computes `HMAC-SHA256(secretKey, subscriberId)`.
- SuprSend signs an ES256 JWT with `entity_id` set to the user id.

## Knock

- **Headless hooks.** `@knocklabs/react` provides `KnockProvider`, `useNotifications(knockClient, channelId, opts)` and `useNotificationStore(feedClient)`. The store returns `items` and `metadata.unseen_count` / `metadata.unread_count`. Other hooks are `useKnockClient`, `useAuthenticatedKnockClient`, `useKnockAuthState` and `usePreferences`. <https://docs.knock.app/in-app-ui/react/headless/feed>
- **Feed actions.** The FeedClient has `markAsSeen/Unseen`, `markAsRead/Unread`, `markAsArchived/Unarchived`, `markAsInteracted`, `markAllAsSeen/Read/Archived` and `fetchNextPage`. <https://docs.knock.app/in-app-ui/javascript/sdk/feed-client>
- **Web push.** Knock has no native VAPID channel. Add an FCM channel in Knock. The browser uses the Firebase SDK, a service worker and a VAPID key to get a token. Store the token as FCM channel data on the Knock user. <https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm>, <https://docs.knock.app/integrations/push/firebase>
- **Real-time.** `feedClient.listenForUpdates()` opens a websocket and fires `items.received.realtime`. <https://docs.knock.app/in-app-ui/javascript/sdk/feed-client>
- **Email.** SES, Resend, Postmark, SendGrid, Mailgun, SMTP and others. <https://docs.knock.app/llms.txt>
- **Preferences.** `usePreferences({ preferenceSet?, tenant? })` returns the preference set and an update function. <https://docs.knock.app/in-app-ui/react/sdk/hooks/use-preferences>
- **Broadcast.** Objects with subscriptions fan out one trigger to each subscriber. Broadcasts go to users, audiences, all users or a CSV. Dynamic audiences became generally available on 2026-04-30. <https://docs.knock.app/concepts/broadcasts>, <https://knock.app/changelog/2026-04-30>
- **Node SDK.** `@knocklabs/node` v1. In v1, `notify()` became `workflows.trigger()`. <https://docs.knock.app/developer-tools/migration-guides/node>
- **Auth.** The provider takes a public `apiKey`, `user={{ id }}` and an optional `userToken`. With enhanced security mode on, Knock requires an RS256 JWT, signed by `signUserToken` and `KNOCK_SIGNING_KEY`. Knock recommends this mode for production. <https://docs.knock.app/in-app-ui/security-and-authentication>
- **Pricing.** Free covers up to 10,000 messages a month with no hard cap. Starter costs $250/month for 50,000 messages, then $0.005 each. <https://knock.app/pricing>
- **Notes.** `@knocklabs/react-notification-feed` is deprecated. <https://docs.knock.app/llms.txt>

## Novu Cloud

- **Headless hooks.** `@novu/react` provides `NovuProvider`, `useNotifications`, `useCounts`, `usePreferences` and `useNovu`. `useNotifications` filters on read, seen and archived state and returns `fetchMore`, `readAll`, `seenAll` and `archiveAll`. Each notification has `read()`, `unread()`, `seen()`, `archive()` and `unarchive()`. <https://docs.novu.co/platform/inbox/headless-mode>, <https://docs.novu.co/platform/sdks/react/hooks/use-notifications>
- **Web push.** Novu has no native VAPID web push. Web push goes through FCM, OneSignal, Pusher Beams, Pushpad or a Push Webhook. Device tokens are stored as credentials on each subscriber. <https://docs.novu.co/platform/integrations/push>
- **Real-time.** The hooks update over a websocket. `novu.on("notifications.notification_received")` gives an event for toasts. <https://docs.novu.co/platform/inbox/headless-mode>
- **Email.** About 19 providers, including SendGrid, SES, Resend, Postmark and SMTP. <https://docs.novu.co/platform/integrations/email>
- **Preferences.** Global and per-workflow preferences. Subscribers cannot turn off critical workflows. React has `usePreferences`. The API is `PATCH /v2/subscribers/{subscriberId}/preferences`. <https://docs.novu.co/platform/inbox/configuration/preferences>, <https://docs.novu.co/api-reference/subscribers/update-subscriber-preferences>
- **Broadcast.** Topics hold up to 100,000 subscribers. Trigger with `to: { type: "Topic", topicKey }`. An `actor` excludes the sender. <https://docs.novu.co/platform/concepts/topics>
- **Node SDK.** `@novu/api`. `@novu/node` is legacy. <https://docs.novu.co/guides/migration-to-new-dashboard/application-and-cutover>
- **Auth.** The client sends `applicationIdentifier` and `subscriber`. With HMAC on, the server passes `subscriberHash`. <https://docs.novu.co/platform/inbox/prepare-for-production>
- **Pricing.** Free: 10,000 workflow runs a month, unlimited subscribers, 5 workflows, 24-hour retention, 3 team members. Pro: from $30/month, 20 workflows, 7-day retention, $1.20 per extra 1,000 runs. <https://novu.co/pricing>

## SuprSend

- **Headless hooks.** `@suprsend/react-core` provides `SuprSendProvider` (`publicApiKey`, `distinctId`), `SuprSendFeedProvider`, `useFeedData()` and `useFeedClient()`. The client has `markAsRead`, `markAsSeen`, `markAllAsRead`, archive and `fetchNextPage`. The page does not document an unread-count hook. <https://docs.suprsend.com/docs/react-headless>
- **Web push.** Native. Pass `vapidKey` from the dashboard to `SuprSendProvider`. Serve `/serviceworker.js` from the site root. Call `client.webpush.registerPush()` from a user click. <https://docs.suprsend.com/docs/react-webpush>
- **Real-time.** The feed updates over a socket. `useFeed()` returns `reachability`. <https://docs.suprsend.com/docs/react-headless>, <https://docs.suprsend.com/changelog/overview>
- **Email.** Yes. You bring your own provider, such as SendGrid or Mailjet. <https://suprsend.com/pricing>
- **Preferences.** Headless methods in `@suprsend/react-core` for channel and category preferences. `@suprsend/react-preferences-headless` is deprecated. The pricing page lists User Preferences only on Business. <https://docs.suprsend.com/docs/preferences-react-headless>, <https://suprsend.com/pricing>
- **Broadcast.** Subscriber lists have no size limit. `subscriber_lists.broadcast(...)` sends to a list. Web push became a broadcast channel on 2026-07-31. <https://docs.suprsend.com/docs/node-broadcast>, <https://docs.suprsend.com/docs/node-lists>
- **Node SDK.** `@suprsend/node-sdk`. <https://docs.suprsend.com/docs/integrate-node-sdk>
- **Auth.** Enhanced Security Mode needs a server-signed ES256 JWT with `entity_id` set to the distinct id. The sandbox does not check tokens. <https://docs.suprsend.com/docs/client-authentication>
- **Pricing.** Free: 10,000 notifications a month, branded feed, lists and broadcasts included, no hard stop. Essentials: $100/month for 50,000. Business: $250/month for 50,000, with Preferences and Digest. <https://suprsend.com/pricing>
- **Notes.** The docs show both web-sdk 4.0.0 and a v5 JS SDK. Some code samples have bugs.

## Courier

- **Hooks.** `@trycourier/courier-react` v8 exposes `useCourier()`, which returns `inbox`, `preferences`, `auth` and `toast`. `inbox` has `feeds`, `totalUnreadCount` and message actions. <https://www.courier.com/docs/platform/inbox/web/react-sdk>, <https://www.courier.com/docs/sdk-libraries/courier-react-v8-migration-guide>
- **Web push.** No native VAPID web push. "Courier Push" is an in-app websocket channel. Browser push needs OneSignal or Pusher Beams. The FCM page covers only Android and iOS. <https://www.courier.com/docs/external-integrations/push/onesignal-push>, <https://www.courier.com/docs/platform/channels/push/pusher-beams/>
- **Real-time.** `inbox.listenForUpdates()` opens a websocket. <https://www.courier.com/docs/platform/inbox/web/react-sdk>
- **Email.** SES, SendGrid, Mailgun, Postmark, Resend, SMTP. <https://www.courier.com/docs/integrations/overview>
- **Preferences.** Hosted page, embedded component and a `preferences` surface in `useCourier()`. <https://www.courier.com/docs/guides/build-a-preference-center>
- **Broadcast.** The Send API accepts `list_id`, `audience_id` or `list_pattern` (for example `course.123.students`). <https://www.courier.com/docs/guides/announce-to-a-list>
- **Node SDK.** `@trycourier/courier`. <https://www.courier.com/docs/sdk-libraries/node>
- **Auth.** A JWT is required. The client calls `auth.signIn({ userId, jwt })`. <https://www.courier.com/docs/platform/inbox/web/react-sdk>
- **Pricing.** Free: 10,000 sends a month. Business: $0.005 per send, including the first 10,000. <https://www.courier.com/pricing>

## MagicBell

- **Hooks.** `@magicbell/react` has components only. A headless feed needs custom hooks around `magicbell-js/user-client`. The older `@magicbell/react-headless` package is not in the current docs. <https://www.magicbell.com/docs/libraries/react>, <https://www.magicbell.com/docs/libraries/magicbell-js>
- **Web push.** Native, with your own VAPID keys and a service worker that imports MagicBell's script. <https://www.magicbell.com/docs/channels/web_push>
- **Real-time.** `magicbell-js/realtime` over websocket. <https://www.magicbell.com/docs/libraries/magicbell-js>
- **Email.** Mailgun, SendGrid, SES, SMTP. <https://www.magicbell.com/docs/api/reference>
- **Broadcast.** `POST /broadcasts` takes 1 to 1,000 recipients. <https://www.magicbell.com/docs/primitive/broadcast>
- **Auth.** Server-signed HS256 user JWT. <https://www.magicbell.com/docs/api/authentication/user>
- **Pricing.** Free: 1,000 deliveries a month. Startup: $249/month for 50,000. Each channel delivery counts separately. <https://www.magicbell.com/pricing>

## Stream Activity Feeds v3

- **Hooks.** `@stream-io/feeds-react-sdk` has `useFeedActivities`, `useAggregatedActivities` and `useNotificationStatus` (unread and unseen, capped at 100). <https://getstream.io/activity-feeds/docs/react/contexts-and-hooks/>, <https://getstream.io/activity-feeds/docs/react/notification-feeds/>
- **Web push.** Not supported. The docs say "The Stream API doesn't support web push notifications." <https://getstream.io/docs/platform/push-notifications/>
- **Email and preferences.** Not found in the official docs.
- **Fan-out.** Each Student's notification feed follows a course feed. <https://getstream.io/activity-feeds/docs/node/v2-to-v3-code-migration/>
- **Auth.** Server-signed JWT user token. <https://getstream.io/activity-feeds/docs/node/tokens-and-authentication>
- **Pricing.** Free: 125,000 API calls and 5,000 activities a month, no overage. Start: $599/month, or $499/month billed annually. <https://getstream.io/activity-feeds/pricing/>

## OneSignal

OneSignal has a free web push tier and email.
Its pricing page does not mention a web in-app feed, so it does not fit the feed need.
<https://onesignal.com/pricing>

## Not verified

- SuprSend: the unread-count method in React, and which plan includes Preferences.
- Courier: exact inbox action signatures and preference hook names.
- MagicBell: topic syntax for broadcasts.
- Stream: any preference feature.
- Free-tier limits other than volume, such as seats and retention, for Knock and Courier.
