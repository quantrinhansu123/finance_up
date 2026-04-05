import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
    try {
        const { token } = await req.json();
        
        // Mật khẩu chung bảo mật giữa 2 trang (phải match với SECRET_KEY nơi tạo token).
        const SECRET_KEY = process.env.SSO_SECRET_KEY || "UPBANK_SECRET_KEY_12345!"; 

        // Sẽ throw error nếu sai secret key hoăc hết hạn (ví dụ expiresIn: '1m')
        const decoded = jwt.verify(token, SECRET_KEY);

        return NextResponse.json({ email: (decoded as any).email });
    } catch (error) {
        return NextResponse.json({ message: "Token không hợp lệ hoặc đã hết hạn truy cập" }, { status: 401 });
    }
}
