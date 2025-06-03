const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetDatabase() {
  try {
    console.log('🔄 Database temizleniyor...');
    
    // Tabloları sırasıyla temizle (foreign key sırası önemli)
    const tables = ['leaderboard', 'votes', 'posts', 'rounds', 'users'];
    
    for (const table of tables) {
      console.log(`🗑️  ${table} tablosu temizleniyor...`);
      const { error } = await supabase.from(table).delete().neq('id', '');
      
      if (error) {
        console.error(`❌ ${table} temizlenirken hata:`, error.message);
      } else {
        console.log(`✅ ${table} tablosu temizlendi`);
      }
    }
    
    console.log('🎉 Database başarıyla temizlendi!');
    
  } catch (error) {
    console.error('❌ Database temizlenirken hata:', error.message);
  }
}

// Script'i çalıştır
resetDatabase(); 