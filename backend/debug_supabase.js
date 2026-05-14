const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('Checking Supabase Storage...');
  console.log('URL:', supabaseUrl);
  
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error('Error listing buckets:', bucketError.message);
    return;
  }
  
  console.log('Available Buckets:', buckets.map(b => `${b.name} (Public: ${b.public})`));
  
  const bucketName = process.env.SUPABASE_BUCKET_NAME || 'SGB';
  const targetBucket = buckets.find(b => b.name === bucketName);
  
  if (!targetBucket) {
    console.error(`Bucket "${bucketName}" NOT FOUND!`);
    console.log('Creating bucket...');
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    if (error) console.error('Failed to create bucket:', error.message);
    else console.log('Bucket created successfully!');
  } else {
    console.log(`Bucket "${bucketName}" found.`);
    if (!targetBucket.public) {
      console.log('Bucket is PRIVATE. Updating to PUBLIC...');
      const { data, error } = await supabase.storage.updateBucket(bucketName, {
        public: true
      });
      if (error) console.error('Failed to update bucket:', error.message);
      else console.log('Bucket updated to PUBLIC!');
    }
  }
}

checkStorage();
