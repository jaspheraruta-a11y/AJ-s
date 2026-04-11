import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://dxdvhdlpbruiodsfrlkd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZHZoZGxwYnJ1aW9kc2ZybGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MDE2MDksImV4cCI6MjA4NzI3NzYwOX0.OiWooYMDOnw0BcCTObBDi4kNMwbtqK8sF0Ho7UNl19c');

async function test() {
  const { data, error } = await supabase.from('orders').insert([
    {
      order_number: 'ORD-001',
      status: 'pending',
      order_type: 'walkin',
      subtotal: 150,
      discount_amount: 0,
      total: 150,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]).select();
  console.log('Insert error:', error);
  console.log('Insert data:', data);
}

test();
