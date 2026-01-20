// netlify/functions/check-status.js
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
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    try {
        const { userId } = event.queryStringParameters;
        
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId required' })
            };
        }
        
        const db = await connectToDatabase();
        const users = db.collection('users');
        
        const user = await users.findOne({ userId: userId });
        
        if (!user) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ status: 'not_found' })
            };
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: user.status,
                data: user
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
