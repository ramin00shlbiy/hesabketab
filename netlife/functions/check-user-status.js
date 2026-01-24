// netlify/functions/check-user-status.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
                body: JSON.stringify({ 
                    success: false, 
                    error: 'شناسه کاربر الزامی است' 
                })
            };
        }
        
        console.log('🔍 Checking status for user:', userId);
        
        // دریافت اطلاعات کاربر
        const { data: user, error } = await supabase
            .from('Users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error || !user) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'کاربر یافت نشد' 
                })
            };
        }
        
        // آماده‌سازی پاسخ
        const response = {
            success: true,
            status: user.status,
            userData: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                nationalCode: user.national_code,
                phone: user.mobile
            }
        };
        
        // اگر تأیید شده، کد را اضافه کن
        if (user.status === 'approved') {
            response.uniqueCode = user.unique_code;
            response.approvedAt = user.approved_at;
            response.message = 'کاربر تأیید شده است';
        } 
        else if (user.status === 'pending') {
            response.message = 'در انتظار تأیید ادمین';
        }
        else if (user.status === 'rejected') {
            response.message = 'کاربر رد شده است';
        }
        
        console.log('📊 User status:', user.status);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };
        
    } catch (error) {
        console.error('❌ Error checking status:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'خطا در بررسی وضعیت' 
            })
        };
    }
};
