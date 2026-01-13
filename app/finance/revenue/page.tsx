"use client";

import { useEffect, useState } from "react";
import { getRevenues, createRevenue } from "@/lib/finance";
import { MonthlyRevenue, Currency } from "@/types/finance";
import { canManageRevenue, getUserRole, Role } from "@/lib/permissions";

export default function RevenuePage() {
    // State
    const [revenues, setRevenues] = useState<MonthlyRevenue[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userRole, setUserRole] = useState<Role>("USER");

    // Form
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [note, setNote] = useState("");

    const fetchRevenues = async () => {
        setLoading(true);
        try {
            const data = await getRevenues();
            setRevenues(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) {
            const parsedUser = JSON.parse(u);
            const computedRole = getUserRole(parsedUser);
            console.log("💰 Revenue - User Role:", computedRole);
            setUserRole(computedRole);
        }
        fetchRevenues();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createRevenue({
                month: month.toString(),
                year: year.toString(),
                amount: parseFloat(amount),
                currency,
                note,
                createdAt: Date.now()
            });
            setIsModalOpen(false);
            fetchRevenues();
            // Reset
            setAmount("");
            setNote("");
        } catch (e) {
            console.error(e);
        }
    };

    if (!canManageRevenue(userRole)) {
        return <div className="p-8 text-[var(--muted)]">You do not have permission to view this page.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Monthly Revenue</h1>
                    <p className="text-[var(--muted)]">Track manually entered revenue for KPI calculations</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="glass-button px-6 py-3 rounded-xl font-medium flex items-center gap-2"
                >
                    <span>+</span> Add Entry
                </button>
            </div>

            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="p-4 border-b border-white/10">Period</th>
                            <th className="p-4 border-b border-white/10 text-right">Revenue</th>
                            <th className="p-4 border-b border-white/10">Note</th>
                            <th className="p-4 border-b border-white/10 text-right">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {revenues.map(rev => (
                            <tr key={rev.id} className="hover:bg-[var(--card-hover)] transition-colors">
                                <td className="p-4 font-bold text-white">
                                    {rev.month}/{rev.year}
                                </td>
                                <td className="p-4 text-right font-bold text-green-400 text-lg">
                                    {rev.amount.toLocaleString()} <span className="text-sm text-[var(--muted)]">{rev.currency}</span>
                                </td>
                                <td className="p-4 text-[var(--muted)]">{rev.note || "-"}</td>
                                <td className="p-4 text-right text-[var(--muted)] text-xs">
                                    {new Date(rev.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {revenues.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-[var(--muted)]">No revenue data.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white">✕</button>
                        <h2 className="text-xl font-bold mb-6">Add Monthly Revenue</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Month</label>
                                    <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="glass-input w-full p-2 rounded-lg">
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Year</label>
                                    <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="glass-input w-full p-2 rounded-lg" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Total Revenue</label>
                                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="glass-input w-full p-2 rounded-lg" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Currency</label>
                                <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="glass-input w-full p-2 rounded-lg">
                                    <option value="USD">USD</option>
                                    <option value="VND">VND</option>
                                    <option value="KHR">KHR</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Note</label>
                                <textarea value={note} onChange={e => setNote(e.target.value)} className="glass-input w-full p-2 rounded-lg" rows={3}></textarea>
                            </div>
                            <button type="submit" className="glass-button w-full p-3 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white border-none mt-4">
                                Save Revenue
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
