// netlify/functions/send-to-telegram.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const userData = JSON.parse(event.body);
        console.log('📤 Registering user:', userData);
        
        // اعتبارسنجی داده‌ها
        if (!userData.firstName || !userData.lastName || !userData.nationalCode || !userData.phoneNumber) {
            throw new Error('Missing required fields');
        }
        
        if (userData.nationalCode.length !== 13 || isNaN(userData.nationalCode)) {
            throw new Error('Invalid national code');
        }
        
        if (userData.phoneNumber.length !== 10 || isNaN(userData.phoneNumber)) {
            throw new Error('Invalid phone number');
        }
        
        // بررسی تکراری نبودن شماره موبایل
        const { data: existingUser } = await supabase
            .from('Users')
            .select('id')
            .eq('mobile', userData.phoneNumber)
            .single();
        
        if (existingUser) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'این شماره موبایل قبلاً ثبت شده است' 
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
        
        if (error) throw error;
        
        console.log('✅ User saved to Supabase:', user.id);
        
        // ارسال به تلگرام
        const telegramResult = await sendToTelegram(user);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                userId: user.id,
                message: 'درخواست شما ارسال شد. منتظر تأیید ادمین باشید.',
                telegramMessageId: telegramResult?.result?.message_id
            })
        };
        
    } catch (error) {
        console.error('❌ Error in send-to-telegram:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};

// ارسال نوتیفیکیشن به تلگرام
async function sendToTelegram(user) {
    const message = `
📋 **درخواست ثبت‌نام جدید**

👤 **نام:** ${user.first_name} ${user.last_name}
🆔 **کد ملی:** ${user.national_code}
📞 **شماره تماس:** ${user.mobile}
⏰ **زمان ثبت‌نام:** ${new Date().toLocaleString('fa-IR')}
🆔 **User ID:** ${user.id}

لطفا یکی از گزینه‌ها را انتخاب کنید:
    `;
    
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { 
                                text: '✅ تأیید کاربر', 
                                callback_data: `approve_${user.id}` 
                            },
                            { 
                                text: '❌ رد کاربر', 
                                callback_data: `reject_${user.id}` 
                            }
                        ],
                        [
                            { 
                                text: '🔑 دادن کد اختصاصی', 
                                callback_data: `setcode_${user.id}` 
                            }
                        ]
                    ]
                }
            })
        });
        
        const result = await response.json();
        console.log('📨 Telegram response:', result.ok ? 'Sent' : 'Failed');
        
        // ذخیره message_id در Supabase
        if (result.ok) {
            await supabase
                .from('Users')
                .update({ telegram_message_id: result.result.message_id })
                .eq('id', user.id);
        }
        
        return result;
        
    } catch (error) {
        console.error('Telegram send error:', error);
        return null;
    }
}
