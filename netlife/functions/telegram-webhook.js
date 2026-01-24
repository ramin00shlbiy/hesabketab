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
        const body = JSON.parse(event.body)
        };
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        return {
            statusCode: 200, // تلگرام نیاز به 200 دارد حتی اگر خطا
            body: JSON.stringify({ error: error.message })
        };
    }
};

// پردازش کلیک روی دکمه‌های اینلاین
async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    const callbackData = callbackQuery.data;
    
    console.log('🔘 Callback:', callbackData);
    
    // جدا کردن action و userId
    const parts = callbackData.split('_');
    const action = parts[0];
    const userId = parts[1];
    
    let responseText = '';
    
    switch (action) {
        case 'approve':
            // درخواست کد دستی برای تأیید
            responseText = `📝 لطفا کد اختصاصی را برای کاربر وارد کنید:\n\nمثال: POS123 یا CUSTOM456\n\nبرای کاربر: ${userId}`;
            
            // ذخیره حالت منتظر کد
            await supabase
                .from('telegram_sessions')
                .upsert({
                    chat_id: chatId.toString(),
                    user_id: userId,
                    action: 'waiting_for_approval_code',
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 دقیقه
                });
            break;
            
        case 'reject':
            // رد کاربر
            await updateUserStatus(userId, 'rejected');
            responseText = `❌ کاربر رد شد\n\nUser ID: ${userId}`;
            break;
            
        case 'setcode':
            // درخواست کد دستی (گزینه دوم)
            responseText = `🔑 لطفا کد اختصاصی دلخواه را وارد کنید:\n\nمثال: USER-2024 یا SHOP-001\n\nبرای کاربر: ${userId}`;
            
            await supabase
                .from('telegram_sessions')
                .upsert({
                    chat_id: chatId.toString(),
                    user_id: userId,
                    action: 'waiting_for_custom_code',
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                });
            break;
            
        default:
            responseText = '⚠️ دستور نامعتبر';
    }
    
    // ارسال پاسخ به تلگرام
    await sendTelegramMessage(chatId, responseText, messageId);
}

// پردازش پیام متنی (کد دستی از ادمین)
async function handleTextMessage(message) {
    const chatId = message.chat.id;
    const text = message.text.trim();
    const messageId = message.message_id;
    
    console.log('📝 Text message:', text);
    
    // پیدا کردن session فعال
    const { data: session, error } = await supabase
        .from('telegram_sessions')
        .select('*')
        .eq('chat_id', chatId.toString())
        .or('action.eq.waiting_for_approval_code,action.eq.waiting_for_custom_code')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (error || !session || session.length === 0) {
        console.log('No active session found');
        return;
    }
    
    const activeSession = session[0];
    const userId = activeSession.user_id;
    const action = activeSession.action;
    
    // بررسی اعتبار کد
    if (!isValidCode(text)) {
        await sendTelegramMessage(chatId, '⚠️ کد نامعتبر! کد باید حداقل ۳ کاراکتر و فقط حروف و اعداد باشد.', messageId);
        return;
    }
    
    // بررسی تکراری نبودن کد
    const { data: existingUser } = await supabase
        .from('Users')
        .select('unique_code')
        .eq('unique_code', text)
        .single();
    
    if (existingUser) {
        await sendTelegramMessage(chatId, '⚠️ این کد قبلاً استفاده شده است. لطفا کد دیگری وارد کنید.', messageId);
        return;
    }
    
    // ذخیره کد و تأیید کاربر
    await updateUserStatus(userId, 'approved', text);
    
    // پاک کردن session
    await supabase
        .from('telegram_sessions')
        .delete()
        .eq('id', activeSession.id);
    
    // دریافت اطلاعات کاربر برای نمایش
    const { data: user } = await supabase
        .from('Users')
        .select('*')
        .eq('id', userId)
        .single();
    
    // ارسال تأیید نهایی
    const successMessage = `
✅ کاربر تأیید شد!

👤 نام: ${user.first_name} ${user.last_name}
📞 موبایل: ${user.mobile}
🔑 کد اختصاصی: ${text}

⏰ زمان تأیید: ${new Date().toLocaleString('fa-IR')}
    `;
    
    await sendTelegramMessage(chatId, successMessage, messageId);
}

// اعتبارسنجی کد دستی
function isValidCode(code) {
    // حداقل ۳ کاراکتر، حروف انگلیسی و اعداد و خط تیره
    return code.length >= 3 && /^[A-Za-z0-9\-_]+$/.test(code);
}

// به‌روزرسانی وضعیت کاربر در Supabase
async function updateUserStatus(userId, status, uniqueCode = null) {
    const updates = {
        status: status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: 'telegram_admin'
    };
    
    if (uniqueCode) {
        updates.unique_code = uniqueCode;
    }
    
    const { error } = await supabase
        .from('Users')
        .update(updates)
        .eq('id', userId);
    
    if (error) {
        console.error('Error updating user:', error);
        throw error;
    }
    
    console.log(`User ${userId} updated to ${status} with code: ${uniqueCode}`);
}

// ارسال پیام به تلگرام
async function sendTelegramMessage(chatId, text, replyToMessageId = null) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    };
    
    if (replyToMessageId) {
        payload.reply_to_message_id = replyToMessageId;
    }
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return await response.json();
    } catch (error) {
        console.error('Telegram send error:', error);
        return null;
    }
}
