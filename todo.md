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
- [x] Admin login via Manus OAuth (role-based)
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
- [ ] Add SMTP credentials in Settings → Secrets to activate email sending

## Phase 5: Polish & Tests
- [x] Vitest unit tests for core backend procedures (21 tests passing)
- [x] Responsive QA on mobile viewports
- [x] Final checkpoint and delivery

## Future / Optional
- [ ] Upload HOYA logo image and replace "H" text placeholder in header
- [ ] Promote admin user via DB (set role = 'admin' for your Manus account)
