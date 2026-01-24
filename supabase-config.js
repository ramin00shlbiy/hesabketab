// supabase-config.js
// این فایل باید در کنار index.html باشد
// کلیدها در Netlify Environment Variables قرار می‌گیرند

// فقط برای development (محلی) - در production از Netlify می‌آید
const localConfig = {
  URL: import.meta.env.VITE_SUPABASE_URL || '',
  KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

// اگر در مرورگر هستیم و متغیرهای محیطی وجود ندارند
// (Netlify خودش آنها را inject می‌کند)
const getConfig = () => {
  // در Netlify، import.meta.env کار می‌کند
  // در development هم با Vite کار می‌کند
  return {
    URL: import.meta.env.VITE_SUPABASE_URL || 
         window.__SUPABASE_URL || 
         localConfig.URL,
    KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 
         window.__SUPABASE_ANON_KEY || 
         localConfig.KEY
  };
};

export const SUPABASE_CONFIG = getConfig();

// تابع کمکی برای بررسی تنظیمات
export const checkSupabaseConfig = () => {
  const config = getConfig();
  
  if (!config.URL || !config.KEY) {
    console.error('❌ خطا: Supabase تنظیم نشده است');
    console.log('URL موجود:', !!config.URL);
    console.log('KEY موجود:', !!config.KEY);
    console.log('Environment:', import.meta.env.MODE);
    
    return false;
  }
  
  console.log('✅ Supabase تنظیمات OK');
  return true;
};
