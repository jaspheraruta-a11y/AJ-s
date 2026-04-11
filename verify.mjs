import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://dxdvhdlpbruiodsfrlkd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZHZoZGxwYnJ1aW9kc2ZybGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MDE2MDksImV4cCI6MjA4NzI3NzYwOX0.OiWooYMDOnw0BcCTObBDi4kNMwbtqK8sF0Ho7UNl19c');

async function test() {
  const { data, error } = await supabase.from('Orders').select('*');
  console.log('Orders error:', error);
  console.log('Orders data:', data);
  
  const { data: d2, error: e2 } = await supabase.from('orders').select('*');
  console.log('orders error:', e2);
  console.log('orders data:', d2);
}

test();
