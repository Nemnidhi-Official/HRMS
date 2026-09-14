# Lead assignment

New leads rotate across users whose role is `sales` and status is `active`, ordered by user ID. All normal lead creation paths use the Lead model save hook, including public forms, questionnaires, Meta ads, and Dashboard WhatsApp. CSV imports reserve a range from the same counter. With a stable team, a complete rotation gives each salesperson one lead. Manual assignments and transfers do not change the automatic rotation or rebalance existing workloads.

The Leads list displays the assignee and supports filtering by salesperson or Unassigned. Open a lead's detail page to assign it as an admin or transfer it as a salesperson. Salespeople can transfer any lead to any active salesperson, as requested. Existing lead visibility and editing permissions are retained. Other roles cannot use the assignment write endpoint. Each assignment records its previous owner, recipient, actor, method, and timestamp on the lead itself. Concurrent manual updates use an expected-owner check and return 409 if another person has already changed the assignment.

Existing leads retain their owners. If no active salespeople exist, incoming leads remain unassigned and can be assigned manually later. No automatic historical redistribution runs. Pending follow-ups retain their separate assignees.

The counter uses an atomic MongoDB update and works on standalone MongoDB as well as replica sets. Allocation and insertion are separate writes: a failed insertion can consume a turn, so exceptional write failures can leave a temporary difference in successful assignments. Team changes start using the current active roster on the next allocation. Neither case moves existing leads.

Validation uses a disposable local MongoDB instance bound to `127.0.0.1:27943`. Set `LEAD_ASSIGNMENT_TEST_URI` to `mongodb://127.0.0.1:27943/hrms_assignment_test_<unique suffix>` and run `npm run test:lead-assignment`. The test refuses application database URLs and checks concurrent distribution, shared batch reservations, transfers, access restrictions, stale writes, and roster changes. Use a new suffix for each run. It does not load application `.env` files.
