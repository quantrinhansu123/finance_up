import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, details, userId, targetId } = body;

        // Extract IP
        const forwardedFor = req.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',')[0] : 'Unknown IP';
        const userAgent = req.headers.get('user-agent') || 'Unknown UA';

        let location = "Unknown Location";
        if (ip !== 'Unknown IP' && ip !== '::1' && ip !== '127.0.0.1') {
            try {
                const locationRes = await fetch(`http://ip-api.com/json/${ip}`);
                if (locationRes.ok) {
                    const loc = await locationRes.json();
                    if (loc.status === 'success') {
                        location = `${loc.city}, ${loc.country}`;
                    }
                }
            } catch (e) {
                console.warn("GeoIP lookup failed", e);
            }
        }

        const logEntry = {
            user_id: userId && userId !== 'anonymous' && userId !== 'system' ? userId : "00000000-0000-0000-0000-000000000000",
            action,
            entity_id: targetId || null, 
            entity_type: body.entityType || 'unknown',
            details: typeof details === 'string' ? details : JSON.stringify(details),
            ip,
            location,
            device: userAgent,
            user_name: body.userName || 'System'
        };

        const { error } = await supabase.from('finance_activity_logs').insert([logEntry]);
        if (error) {
            console.error('Supabase logging failed:', error);
            // Non-fatal error to avoid breaking application flow
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logging endpoint failed:', error);
        return NextResponse.json({ success: false, error: 'Logging failed' }, { status: 500 });
    }
}
