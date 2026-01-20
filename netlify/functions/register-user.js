// netlify/functions/register-user.js
const { MongoClient } = require('mongodb');

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const uri = process.env.MONGODB_URI;
    const client = await MongoClient.connect(uri);
    const db = client.db('telegram_bot');
    cachedDb = db;
    return db;
}

exports.handler = async (event, context) => {
    // اجازه CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const userData = JSON.parse(event.body);
        const db = await connectToDatabase();
        const users = db.collection('users');
        
        // تولید ID یکتا
        const userId = 'USER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // ذخیره کاربر
        await users.insertOne({
            userId: userId,
            ...userData,
            status: 'waiting',
            createdAt: new Date(),
            ip: event.headers['client-ip']
        });
        
        // ارسال به تلگرام
        const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
        
        const telegramMessage = `
📋 **درخواست ثبت‌نام جدید**

👤 **نام:** ${userData.firstName} ${userData.lastName}
🆔 **کد ملی:** ${userData.nationalCode}
📞 **شماره تماس:** ${userData.phoneNumber}
⏰ **زمان:** ${new Date().toLocaleString('fa-IR')}
🆔 **User ID:** ${userId}

✅ برای تأیید کلیک کنید:
`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: telegramMessage,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ تأیید کاربر', callback_data: `approve_${userId}` },
                            { text: '❌ رد کاربر', callback_data: `reject_${userId}` }
                        ],
                        [
                            { text: '📝 دادن کد دستی', callback_data: `setcode_${userId}` }
                        ]
                    ]
                }
            })
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                userId: userId,
                message: 'اطلاعات ارسال شد' 
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
