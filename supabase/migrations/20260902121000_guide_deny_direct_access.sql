CREATE POLICY guide_accounts_no_direct ON guide.accounts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY guide_sessions_no_direct ON guide.sessions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY guide_tickets_no_direct ON guide.tickets FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY guide_training_no_direct ON guide.training FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY guide_settings_no_direct ON guide.settings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
