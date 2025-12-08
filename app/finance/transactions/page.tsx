"use client";

import { useEffect, useState } from "react";
import TransactionList from "@/components/finance/TransactionList";
import CreateTransactionModal from "@/components/finance/CreateTransactionModal";
import { getTransactions } from "@/lib/finance";
import { Transaction } from "@/types/finance";
import { canViewAllTransactions, getUserRole, Role } from "@/lib/permissions";

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null); // Type as needed or any for now
    const [userRole, setUserRole] = useState<Role>("STAFF");

    // Filters
    const [filterDate, setFilterDate] = useState("");
    const [filterProject, setFilterProject] = useState("");
    const [filterSource, setFilterSource] = useState(""); // Source or Category
    const [filterAccount, setFilterAccount] = useState("");

    // Filter Options Data
    const [projects, setProjects] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(parsedUser);
            const computedRole = getUserRole(parsedUser);
            console.log("💳 Transactions - User Role:", computedRole);
            setUserRole(computedRole);
        }

        // Load Filter Options
        import("@/lib/finance").then(async (mod) => {
            const [p, a] = await Promise.all([mod.getProjects(), mod.getAccounts()]);
            setProjects(p);
            setAccounts(a);
        });
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const data = await getTransactions();

            // 1. Role-based Filter
            let filteredData = data;
            if (currentUser && !canViewAllTransactions(userRole)) {
                filteredData = data.filter(tx => tx.userId === currentUser.id || tx.userId === currentUser.uid);
            }

            // 2. UI Filters
            if (filterDate) {
                filteredData = filteredData.filter(tx => tx.date.startsWith(filterDate));
            }
            if (filterProject) {
                filteredData = filteredData.filter(tx => tx.projectId === filterProject);
            }
            if (filterAccount) {
                filteredData = filteredData.filter(tx => tx.accountId === filterAccount);
            }
            if (filterSource) {
                const term = filterSource.toLowerCase();
                filteredData = filteredData.filter(tx =>
                    (tx.source?.toLowerCase().includes(term)) ||
                    (tx.category?.toLowerCase().includes(term))
                );
            }

            // Sort by date desc
            filteredData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(filteredData);
        } catch (error) {
            console.error("Failed to fetch transactions", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchTransactions();
        }
    }, [currentUser, filterDate, filterProject, filterAccount, filterSource]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Transactions</h1>
                    <p className="text-[var(--muted)]">Track income and expenses</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="glass-button px-6 py-3 rounded-xl font-medium flex items-center gap-2 whitespace-nowrap"
                >
                    <span>+</span> New Transaction
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="glass-input p-2 rounded-lg w-full text-sm"
                />
                <select
                    value={filterProject}
                    onChange={e => setFilterProject(e.target.value)}
                    className="glass-input p-2 rounded-lg w-full text-sm"
                >
                    <option value="">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                    value={filterAccount}
                    onChange={e => setFilterAccount(e.target.value)}
                    className="glass-input p-2 rounded-lg w-full text-sm"
                >
                    <option value="">All Accounts</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input
                    type="text"
                    placeholder="Search Source/Category..."
                    value={filterSource}
                    onChange={e => setFilterSource(e.target.value)}
                    className="glass-input p-2 rounded-lg w-full text-sm"
                />
            </div>

            {loading ? (
                <div className="glass-card h-64 animate-pulse rounded-xl"></div>
            ) : (
                <TransactionList transactions={transactions} />
            )}

            <CreateTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchTransactions}
                currentUser={currentUser ? { 
                    id: currentUser.id || currentUser.uid,
                    uid: currentUser.uid || currentUser.id,
                    name: currentUser.name || currentUser.displayName || "Unknown",
                    role: userRole,
                    projectIds: currentUser.projectIds || []
                } : undefined}
            />
        </div>
    );
}
