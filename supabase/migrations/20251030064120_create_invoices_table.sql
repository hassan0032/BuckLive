CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  issue_date date DEFAULT current_date,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
