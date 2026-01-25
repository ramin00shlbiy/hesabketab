// netlify/functions/send-to-telegram.js
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // 🔴 این خط را اضافه کنید!

exports.handler = async (event, context) => {
    console.log('📨 دریافت درخواست ثبت‌نام');
    
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
        // فقط POST می‌پذیریم
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Method not allowed' 
                })
            };
        }
        
        // پارس کردن JSON
        let userData;
        try {
            userData = JSON.parse(event.body);
            console.log('📋 داده دریافتی:', userData);
        } catch (parseError) {
            console.error('❌ خطا در پارس JSON:', parseError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Invalid JSON format' 
                })
            };
        }
        
        // اعتبارسنجی فیلدها
        if (!userData.firstName || !userData.lastName || 
            !userData.nationalCode || !userData.phoneNumber) {
            console.error('❌ فیلدهای ضروری خالی هستند');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'All fields are required' 
                })
            };
        }
        
        // گرفتن Environment Variables
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY;
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        
        // اگر Environment Variables تنظیم نشده باشد
        if (!supabaseUrl || !supabaseKey) {
            console.log('⚠️ Environment Variables تنظیم نشده - حالت تست');
            // حالت تست: بدون اتصال به Supabase
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    userId: 'test_' + Date.now(),
                    message: 'تست موفق - Environment Variables را تنظیم کنید' 
                })
            };
        }
        
        // اتصال به Supabase
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // ذخیره کاربر در Supabase
        const { data: user, error: supabaseError } = await supabase
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
        
        if (supabaseError) {
            console.error('❌ خطای Supabase:', supabaseError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Database error: ' + supabaseError.message 
                })
            };
        }
        
        console.log('✅ کاربر در Supabase ذخیره شد. ID:', user.id);
        
        // ارسال به تلگرام (اگر توکن تنظیم شده باشد)
        if (telegramToken && telegramChatId) {
            try {
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
                console.log('📨 نتیجه تلگرام:', telegramResult.ok ? '✅ ارسال شد' : '❌ خطا');
                
            } catch (telegramError) {
                console.error('⚠️ خطا در ارسال به تلگرام:', telegramError);
            }
        } else {
            console.log('⚠️ توکن تلگرام تنظیم نشده - پیام ارسال نشد');
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
        console.error('❌ خطا در function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message || 'Internal server error' 
            })
        };
    }
};
