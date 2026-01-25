const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    try {
        // گرفتن مقادیر از Environment Variables
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!supabaseUrl || !supabaseServiceKey || !telegramToken) {
            console.error('Missing environment variables');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = JSON.parse(event.body);
        
        // بقیه کد همان...
        // [کدهای قبلی شما]
        
    } catch (error) {
        console.error('Error in webhook:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
