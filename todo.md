# Hoyas Concession Volunteer Sign-Up — TODO

## Phase 1: Schema & Backend
- [x] Define database schema: concession_events, volunteer_positions, volunteers tables
- [x] Generate and apply Drizzle migration SQL
- [x] Seed concession dates (Mon/Tue/Thu through Nov 5, with exceptions)
- [x] Backend: volunteer CRUD procedures (create, list, update, delete)
- [x] Backend: event/position management procedures
- [x] Backend: admin procedures (check-in, status update, search/filter)
- [x] Backend: Excel export endpoint
- [x] Backend: double-booking prevention logic
- [x] Backend: automatic slot reopening on cancellation
- [x] Backend: season management (add/edit dates)

## Phase 2: Public Signup Page
- [x] HOYA branding: Navy Blue #003087 + Kelly Green #009A44 theme in index.css
- [x] Public homepage listing all upcoming events with open slots
- [x] Role cards showing position details, time, description, requirements
- [x] Volunteer signup modal/form with all required fields
- [x] Double-booking prevention UI feedback
- [x] Confirmation message after successful signup
- [x] Mobile-first responsive layout

## Phase 3: Admin Dashboard
- [x] Admin login via secure email-and-password authentication (role-based)
- [x] Dashboard overview: today's volunteers, open positions, stats
- [x] Volunteer list with search and filters
- [x] Edit volunteer record
- [x] Delete volunteer record
- [x] Check-in action
- [x] Status management: Completed / No Show / Canceled / Restore
- [x] Volunteer history view
- [x] Season management panel (add/edit/delete/toggle concession dates)
- [x] Excel export button

## Phase 4: Emails & Notifications
- [x] Confirmation email on signup
- [x] Morning reminder email via periodic heartbeat job
- [x] Email templates (HOYA branded)
- [x] Heartbeat cron setup/disable UI in Season panel
- [x] Add SMTP credentials in Settings → Secrets to activate email sending

## Phase 5: Polish & Tests
- [x] Vitest unit tests for core backend procedures (21 tests passing)
- [x] Responsive QA on mobile viewports
- [x] Final checkpoint and delivery

## Future / Optional
- [ ] Upload HOYA logo image and replace "H" text placeholder in header
- [x] Promote project owner to admin and add in-app administrator management

## Schedule Fix (July 27 update)
- [x] Clear all existing seeded events and re-seed with corrected schedule
- [x] Mon/Tue/Thu cadence, Aug 4 through Nov 5, 2025
- [x] Skip Sep 8 (Mon) — Sep 7 is a Sunday; skip the Monday Sep 8
- [x] Sep 9 (Tuesday) is KEPT as instructed
- [x] Skip Sep 22 (Mon), Sep 23 (Tue), Sep 25 (Thu) — no practice Sep 21-25
- [x] End by Nov 5: last events are Mon Nov 3 and Tue Nov 4 (Nov 5 is Wed, not a practice day)
- [x] 37 events total, 185 volunteer slots

## Admin Hardening (July 27 update)
- [x] ProtectedAdminRoute wrapper in App.tsx — all /admin/* routes redirect to login if not authenticated or not admin
- [x] Backend adminProcedure middleware throws FORBIDDEN for non-admins on all admin tRPC procedures
- [x] Admin login page with local email-and-password sign-in flow
- [x] Excel export (XLSX) wired in Volunteers page with client-side generation
- [x] Search by name/email/phone + status filter on Volunteers page
- [x] Today's Volunteers panel on Dashboard showing live data

## Admin Management
- [x] Add an admin-only Admin Access page that lists signed-in users and their current role
- [x] Allow existing admins to promote eligible users to admin and revoke non-owner admin access safely
- [x] Add role-management tests and verify the new page on desktop and mobile

## Password-Based Admin Authentication
- [x] Replace Manus OAuth login with secure email-and-password authentication
- [x] Store password hashes securely and issue signed, HTTP-only admin sessions
- [x] Update Admin Access so existing admins can create password-based administrator accounts
- [x] Test login, logout, invalid-password, session, and authorization flows

## Volunteer Roles
- [x] Remove Runner from all concession event slots and seed definitions
- [x] Update public signup, admin displays, exports, and tests to reflect the remaining roles

## Public Page Copy
- [x] Update the volunteer invitation text to the requested concession-duty wording
