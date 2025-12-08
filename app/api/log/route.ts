import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, details, userId, targetId } = body;

        // Extract IP
        const forwardedFor = req.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',')[0] : 'Unknown IP';
        const userAgent = req.headers.get('user-agent') || 'Unknown UA';

        // Simple Location Lookup (Mock for now, or use a free API if reliable)
        // For production, you'd use a service like ip-api.com or similar server-side
        // const locationData = await fetch(`http://ip-api.com/json/${ip}`).then(res => res.json());
        // const location = locationData.status === 'success' ? `${locationData.city}, ${locationData.country}` : 'Unknown Location';

        // Using "Unknown" as placeholder to avoid blocking on rate limits during dev
        // In a real implementation, we would un-comment the fetch above.
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
            userId: userId || 'anonymous',
            action,
            entityId: targetId || null, // Map targetId to entityId for consistency
            details: typeof details === 'string' ? details : JSON.stringify(details), // Ensure details is string if legacy expects it, or keep object if flexible
            ip,
            location,
            device: userAgent, // Map userAgent to device field
            timestamp: Date.now(),
            userName: body.userName || 'System' // Capture userName if passed
        };

        await addDoc(collection(db, 'finance_logs'), logEntry);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logging failed:', error);
        // We return 200 even if logging fails to not break the app flow, 
        // but in strict audit mode you might want 500.
        return NextResponse.json({ success: false, error: 'Logging failed' }, { status: 500 });
    }
}
