// netlify/functions/telegram-webhook.js
const { MongoClient } = require('mongodb');

// استفاده از MongoDB Atlas رایگان یا یک دیتابیس ساده
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    
    // استفاده از MongoDB Atlas (رایگان 512MB)
    const uri = process.env.MONGODB_URI;
    const client = await MongoClient.connect(uri);
    const db = client.db('telegram_bot');
    cachedDb = db;
    return db;
}

exports.handler = async (event, context) => {
    try {
        const body = JSON.parse(event.body);
        const callbackQuery = body.callback_query;
        
        if (!callbackQuery) {
            return { statusCode: 200, body: 'No callback query' };
        }

        const callbackData = callbackQuery.data;
        const chatId = callbackQuery.from.id;
        const messageId = callbackQuery.message.message_id;
        
        const db = await connectToDatabase();
        const users = db.collection('users');
        
        let responseText = '';
        let userData = null;
        
        if (callbackData.startsWith('approve_')) {
            const userId = callbackData.replace('approve_', '');
            
            // پیدا کردن کاربر
            userData = await users.findOne({ userId: userId });
            
            if (userData) {
                // به‌روزرسانی وضعیت
                await users.updateOne(
                    { userId: userId },
                    { 
                        $set: { 
                            status: 'approved',
                            approvedAt: new Date(),
                            approvedBy: chatId 
                        } 
                    }
                );
                
                responseText = `✅ کاربر "${userData.firstName} ${userData.lastName}" تأیید شد.\n\nکد اختصاصی: ${generateUniqueCode()}`;
            }
        }
        else if (callbackData.startsWith('reject_')) {
            const userId = callbackData.replace('reject_', '');
            
            userData = await users.findOne({ userId: userId });
            
            if (userData) {
                await users.updateOne(
                    { userId: userId },
                    { 
                        $set: { 
                            status: 'rejected',
                            rejectedAt: new Date(),
                            rejectedBy: chatId 
                        } 
                    }
                );
                
                responseText = `❌ کاربر "${userData.firstName} ${userData.lastName}" رد شد.`;
            }
        }
        else if (callbackData.startsWith('setcode_')) {
            // منطق دادن کد دستی
            const userId = callbackData.replace('setcode_', '');
            // اینجا نیاز به پاسخ متنی دارید
        }
        
        // ارسال پاسخ به تلگرام
        const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: responseText || 'عملیات انجام شد',
                reply_to_message_id: messageId
            })
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
        
    } catch (error) {
        console.error('Error in webhook:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

function generateUniqueCode() {
    return 'USER-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
        }
