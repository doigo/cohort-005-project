# Course Access ends at approval, Progress is kept, and a course is refunded once

When an Admin approves a Refund Request, the learner loses Course Access at that moment. They do not lose it when the Refund becomes an Issued Refund. Approval is the final decision (a Failed Refund still leaves the request approved), and the Refund flow is out of scope, so access tied to it might never end. The learner keeps Course Access while the request is open, because a request is not a decision and might be declined.

We keep the learner's Progress (watch history, completed lessons, quiz attempts) instead of deleting it. It is the evidence behind the decision, deleting it cannot be undone, and it comes back if the learner buys the course again.

Because Progress comes back, a learner who has an Approved Refund Request for a course cannot ask for a refund on that course again. Without this rule, a learner could buy, watch, get a refund, buy again and continue from where they stopped, and so get the course for nothing.

## Considered Options

- **End access when the money is sent (Issued Refund).** We rejected this because Refunds are not built yet, and a Failed Refund would leave access open with no end.
- **Delete Progress on approval.** We rejected this because it destroys the evidence and cannot be reversed. It would also have removed the reason for the one-refund rule, which is cheaper to keep.
