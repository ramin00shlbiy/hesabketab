const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        // گرفتن مقادیر از Environment Variables
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        
        // اعتبارسنجی متغیرهای محیطی
        if (!supabaseUrl || !supabaseServiceKey || !telegramToken || !telegramChatId) {
            console.error('Missing environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Server configuration error' 
                })
            };
        }
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const userData = JSON.parse(event.body);
        
        // اعتبارسنجی داده‌های ورودی
        if (!userData.firstName || !userData.lastName || !userData.nationalCode || !userData.phoneNumber) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'All fields are required' 
                })
            };
        }
        
        // ذخیره کاربر در Supabase
        const { data: user, error } = await supabase
            .from('Users')
            .insert({
                mobile: userData.phoneNumber,
                first_name: userData.firstName,
                last_name: userData.lastName,
                national_code: userData.nationalCode,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        // ارسال به تلگرام
        const message = `
📋 **درخواست ثبت‌نام جدید**

👤 **نام:** ${userData.firstName} ${userData.lastName}
🆔 **کد ملی:** ${userData.nationalCode}
📞 **شماره تماس:** ${userData.phoneNumber}
⏰ **زمان:** ${new Date().toLocaleString('fa-IR')}
🆔 **User ID:** ${user.id}

لطفا اقدام کنید:`;
        
        const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
        
        const telegramResponse = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text: message,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { 
                                text: '✅ تأیید (کد خودکار)', 
                                callback_data: `approve_${user.id}` 
                            },
                            { 
                                text: '❌ رد کاربر', 
                                callback_data: `reject_${user.id}` 
                            }
                        ],
                        [
                            { 
                                text: '🔑 دادن کد دستی', 
                                callback_data: `setcode_${user.id}` 
                            }
                        ]
                    ]
                }
            })
        });
        
        const telegramResult = await telegramResponse.json();
        
        // ذخیره message_id برای ویرایش بعدی
        if (telegramResult.ok) {
            await supabase
                .from('Users')
                .update({ telegram_message_id: telegramResult.result.message_id })
                .eq('id', user.id);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                userId: user.id,
                message: 'درخواست ارسال شد' 
            })
        };
        
    } catch (error) {
        console.error('Error in send-to-telegram:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Internal server error' 
            })
        };
    }
};
