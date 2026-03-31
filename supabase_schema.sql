-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'financeiro', 'dentista', 'recepcao')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Patients Table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Procedure Catalog Table
CREATE TABLE procedure_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  default_cost NUMERIC(10, 2),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Treatments Table
CREATE TABLE treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name_snapshot TEXT NOT NULL,
  patient_phone_snapshot TEXT,
  patient_email_snapshot TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'in_progress', 'completed', 'cancelled')),
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method_preference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Treatment Items Table
CREATE TABLE treatment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id UUID REFERENCES treatments(id) ON DELETE CASCADE,
  procedure_id UUID REFERENCES procedure_catalog(id) ON DELETE SET NULL,
  procedure_name_snapshot TEXT NOT NULL,
  unit_price_snapshot NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total NUMERIC(10, 2) NOT NULL,
  notes TEXT
);

-- 6. Payment Plans Table
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id UUID REFERENCES treatments(id) ON DELETE CASCADE,
  installment_count INTEGER NOT NULL DEFAULT 1,
  first_due_date DATE NOT NULL,
  interval_type TEXT DEFAULT 'monthly',
  total_value NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Installments Table
CREATE TABLE installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID REFERENCES payment_plans(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES treatments(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  amount_paid NUMERIC(10, 2) DEFAULT 0,
  payment_date DATE,
  payment_method_used TEXT,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  manual_settlement BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Payment Records Table
CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID REFERENCES installments(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10, 2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  payment_method TEXT NOT NULL,
  reference_code TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. Communication Logs Table
CREATE TABLE communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  installment_id UUID REFERENCES installments(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  template_name TEXT,
  message_snapshot TEXT NOT NULL,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  notes TEXT
);

-- 10. App Settings Table
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name TEXT,
  clinic_document_name TEXT,
  clinic_phone TEXT,
  clinic_email TEXT,
  clinic_address TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  beneficiary_name TEXT,
  beneficiary_document TEXT,
  default_payment_instructions TEXT,
  default_contract_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. Audit Logs Table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Authenticated users can read/write)
-- Note: In a real app, you would refine these based on the 'role' in profiles
CREATE POLICY "Allow authenticated access to profiles" ON profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to patients" ON patients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to procedure_catalog" ON procedure_catalog FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to treatments" ON treatments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to treatment_items" ON treatment_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to payment_plans" ON payment_plans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to installments" ON installments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to payment_records" ON payment_records FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to communication_logs" ON communication_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to app_settings" ON app_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to audit_logs" ON audit_logs FOR ALL USING (auth.role() = 'authenticated');
