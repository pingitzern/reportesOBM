import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const supabaseUrl = 'https://nvoihnnwpzeofzexblyg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52b2lobm53cHplb2Z6ZXhibHlnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzk0NDk3MCwiZXhwIjoyMDc5NTIwOTcwfQ.sUV2BVWxd5KDJ_CU6oh5hCbkcOMNAq0Y-8BHm9q-v5A';

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('maintenances')
  .select('id, type, service_date, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

if (error) {
  console.error('error', error);
  process.exit(1);
}

console.log(data);
