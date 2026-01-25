const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }
        
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { userId } = event.queryStringParameters;
        
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId required' })
            };
        }
        
        const { data: user, error } = await supabase
            .from('Users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: user.status,
                uniqueCode: user.unique_code,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.mobile,
                approvedAt: user.approved_at
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
