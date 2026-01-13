"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUsers } from "@/lib/users";
import { UserProfile } from "@/types/user";
import { Search, History } from "lucide-react";

const ITEMS_PER_PAGE = 15;

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users
    const filteredUsers = users.filter(u => {
        const name = u.employment?.fullName || u.displayName || "";
        const email = u.email || "";
        const matchSearch = !search || 
            name.toLowerCase().includes(search.toLowerCase()) ||
            email.toLowerCase().includes(search.toLowerCase());
        
        return matchSearch;
    });

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Danh sách Người dùng</h1>
                    <p className="text-[10px] text-[var(--muted)]">Xem thông tin và lịch sử giao dịch của người dùng</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="glass-card p-3 rounded-xl border border-white/5">
                    <div className="text-[10px] text-[var(--muted)] uppercase">Tổng người dùng</div>
                    <div className="text-xl font-bold text-white">{users.length}</div>
                </div>
                <div className="glass-card p-3 rounded-xl border border-blue-500/20">
                    <div className="text-[10px] text-[var(--muted)] uppercase">Đang hiển thị</div>
                    <div className="text-xl font-bold text-blue-400">{filteredUsers.length}</div>
                </div>
            </div>

            {/* Search */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên hoặc email..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        className="glass-input w-full pl-8 pr-3 py-1.5 rounded-lg text-xs"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-[10px] font-semibold tracking-wider">
                            <tr>
                                <th className="p-3 border-b border-white/10">Tên</th>
                                <th className="p-3 border-b border-white/10">Email</th>
                                <th className="p-3 border-b border-white/10">Chức vụ</th>
                                <th className="p-3 border-b border-white/10">Số điện thoại</th>
                                <th className="p-3 border-b border-white/10 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-[var(--muted)]">Đang tải...</td></tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-[var(--muted)]">Không tìm thấy người dùng</td></tr>
                            ) : (
                                paginatedUsers.map((user) => {
                                    const displayName = user.employment?.fullName || user.displayName || "Unknown";
                                    const position = user.employment?.position || user.position || "-";
                                    const phoneNumber = user.employment?.phone || user.phoneNumber || "-";

                                    return (
                                        <tr key={user.uid} className="hover:bg-white/5 transition-colors">
                                            <td 
                                                className="p-3 font-medium text-white cursor-pointer hover:text-blue-400"
                                                onClick={() => router.push(`/finance/users/${user.uid}`)}
                                                title="Click để xem chi tiết"
                                            >
                                                {displayName}
                                            </td>
                                            <td className="p-3 text-[var(--muted)]">{user.email}</td>
                                            <td className="p-3 text-[var(--muted)]">{position}</td>
                                            <td className="p-3 text-[var(--muted)]">{phoneNumber}</td>
                                            <td className="p-3">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        onClick={() => router.push(`/finance/transactions?user=${user.uid}`)}
                                                        className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-green-400 transition-colors"
                                                        title="Xem lịch sử giao dịch"
                                                    >
                                                        <History size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-white/10">
                        <span className="text-[10px] text-[var(--muted)]">
                            Trang {currentPage}/{totalPages} ({filteredUsers.length} người dùng)
                        </span>
                        <div className="flex gap-1">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="px-2 py-1 rounded text-xs hover:bg-white/5 disabled:opacity-50"
                            >
                                Trước
                            </button>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="px-2 py-1 rounded text-xs hover:bg-white/5 disabled:opacity-50"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}