"use client";

import { useState, useEffect, useMemo } from "react";
import { getProjects, createProject, updateProject, getTransactions, deleteProject, getDuAnList } from "@/lib/finance";
import { Project } from "@/types/finance";
import { useRouter } from "next/navigation";
import { getUserRole, getAccessibleProjects, hasProjectPermission, Role } from "@/lib/permissions";
import { Users, Trash2, ChevronLeft, ChevronRight, ShieldX, Plus, Eye, Save, X, Edit2 } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { ActionCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";
import { getUsers } from "@/lib/users";
import { UserProfile } from "@/types/user";

const ITEMS_PER_PAGE = 10;

export default function ProjectsPage() {
    const { t } = useTranslation();
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters & Pagination
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        status: "ALL"
    });
    const [searchTerm, setSearchTerm] = useState("");

    // Form
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [status, setStatus] = useState<Project["status"]>("ACTIVE");
    const [budget, setBudget] = useState("");
    const [currency, setCurrency] = useState<"USD" | "VND" | "KHR">("USD");

    // Member picker (checkbox multi-select)
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [memberSearchTerm, setMemberSearchTerm] = useState("");

    // du_an picker (dropdown)
    const [duAnOptions, setDuAnOptions] = useState<Array<{ id: string; tenDuAn: string }>>([]);
    const [duAnLoading, setDuAnLoading] = useState(false);
    const [selectedDuAnId, setSelectedDuAnId] = useState<string>("");

    // Filtered data
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.description || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = activeFilters.status === "ALL" || p.status === activeFilters.status;
            return matchSearch && matchStatus;
        });
    }, [projects, searchTerm, activeFilters]);

    // Reset page when filter changes removed - DataTable handles its own internal state
    // But we might want to pass a key to DataTable to force reset if needed, 
    // however for now standard internal reset is fine.

    const loadUsersForProjectModal = async () => {
        if (usersLoading) return;
        if (allUsers.length > 0) return;
        setUsersLoading(true);
        try {
            const users = await getUsers();
            setAllUsers(users);
        } catch (e) {
            console.error("Failed to load users for project modal", e);
        } finally {
            setUsersLoading(false);
        }
    };

    const loadDuAnOptions = async () => {
        if (duAnLoading) return;
        if (duAnOptions.length > 0) return;
        setDuAnLoading(true);
        try {
            const options = await getDuAnList();
            setDuAnOptions(options);
        } catch (e) {
            console.error("Failed to load du_an options", e);
        } finally {
            setDuAnLoading(false);
        }
    };

    // Load user info
    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(parsedUser);
            setUserRole(getUserRole(parsedUser));
        } else {
            router.push("/login");
        }
    }, [router]);

    // Filter projects based on user permissions
    useEffect(() => {
        if (currentUser && allProjects.length > 0) {
            const accessibleProjects = getAccessibleProjects(currentUser, allProjects);
            setProjects(accessibleProjects);
        }
    }, [currentUser, allProjects]);

    // selectedMembers state removed

    const fetchData = async () => {
        setLoading(true);
        try {
            // Load projects first.
            // If transactions query fails (e.g. auth/RLS), we still want to render projects list.
            const projs = await getProjects();

            let txs: any[] = [];
            try {
                txs = await getTransactions();
            } catch (txErr) {
                console.error("Failed to load transactions for totals", txErr);
            }

            // Calculate totals per project efficiently:
            // Avoid O(projects * transactions) by grouping txs by projectId once.
            const statsByProjectId = new Map<string, { revenue: number; expense: number }>();
            for (const tx of txs as any[]) {
                if (tx?.status !== "APPROVED") continue;
                const pid = tx?.projectId;
                if (!pid) continue;

                const cur = statsByProjectId.get(pid) || { revenue: 0, expense: 0 };
                if (tx?.type === "IN") cur.revenue += Number(tx.amount || 0);
                if (tx?.type === "OUT") cur.expense += Number(tx.amount || 0);
                statsByProjectId.set(pid, cur);
            }

            const projectsWithStats = projs.map(p => {
                const stats = statsByProjectId.get(p.id);
                return {
                    ...p,
                    totalRevenue: stats?.revenue ?? 0,
                    totalExpense: stats?.expense ?? 0
                };
            });

            setAllProjects(projectsWithStats);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setSelectedProject(null);
        setName("");
        setDesc("");
        setStatus("ACTIVE");
        setBudget("");
        setCurrency("USD");
        setSelectedMemberIds([]);
        setMemberSearchTerm("");
        setSelectedDuAnId("");
        setIsModalOpen(true);
        void loadUsersForProjectModal();
        void loadDuAnOptions();
    };

    const openEditModal = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedProject(project);
        setName(project.name);
        setDesc(project.description || "");
        setStatus(project.status);
        setBudget(project.budget?.toString() || "");
        setCurrency(project.currency as any || "USD");
        setSelectedMemberIds(project.memberIds || []);
        setMemberSearchTerm("");
        setSelectedDuAnId("__CURRENT__");
        setIsModalOpen(true);
        void loadUsersForProjectModal();
        void loadDuAnOptions();
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Align du_an dropdown with current project name when du_an options are loaded.
    useEffect(() => {
        if (!isModalOpen) return;
        if (!selectedProject) return;
        if (duAnOptions.length === 0) return;

        const match = duAnOptions.find(opt => opt.tenDuAn === selectedProject.name);
        setSelectedDuAnId(match ? match.id : "__CURRENT__");
    }, [duAnOptions, isModalOpen, selectedProject?.id, selectedProject?.name]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (userRole !== "ADMIN") {
            alert(t("no_permission"));
            return;
        }

        try {
            if (selectedProject) {
                // UPDATE
                await updateProject(selectedProject.id, {
                    name,
                    description: desc,
                    status,
                    budget: budget ? parseFloat(budget) : 0,
                    currency,
                    memberIds: selectedMemberIds,
                });
            } else {
                // CREATE
                await createProject({
                    name,
                    description: desc,
                    status,
                    budget: budget ? parseFloat(budget) : 0,
                    currency,
                    totalRevenue: 0,
                    totalExpense: 0,
                    memberIds: selectedMemberIds,
                    createdAt: Date.now()
                });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Error: " + JSON.stringify(error) + "\n" + String(error));
        }
    };



    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // Chỉ ADMIN mới được xóa
        if (userRole !== "ADMIN") {
            alert(t("no_permission"));
            return;
        }

        if (!confirm(t("confirm_delete"))) return;
        try {
            await deleteProject(id);
            setAllProjects(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Delete failed", error);
            alert(t("delete_failed"));
        }
    };

    // Check if user can create projects
    const canCreateProject = userRole === "ADMIN";

    // Check if user has any accessible projects
    const hasAccessibleProjects = projects.length > 0;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">{t("projects")}</h1>
                    <p className="text-[var(--muted)]">{t("projects_desc")}</p>
                </div>
            </div>

            {/* Show access message if user has limited access */}
            {userRole !== "ADMIN" && hasAccessibleProjects && !loading && (
                <div className="glass-card p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-400">
                        {t("limited_project_view").replace("{count}", projects.length.toString())}
                    </p>
                </div>
            )}

            {/* If user has no accessible projects, show message */}
            {!hasAccessibleProjects && !loading && (
                <div className="glass-card p-8 rounded-xl text-center">
                    <ShieldX size={48} className="mx-auto text-[var(--muted)] mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">{t("no_access")}</h3>
                    <p className="text-[var(--muted)]">
                        {t("no_project_access_desc")}
                    </p>
                </div>
            )}

            {/* Toolbar */}
            <DataTableToolbar
                searchPlaceholder={t("search_projects")}
                onSearch={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => {
                    setActiveFilters({ status: "ALL" });
                    setSearchTerm("");
                }}
                onExport={() => exportToCSV(filteredProjects, "Danh_Sach_Du_An", {
                    name: t("name"),
                    description: t("description"),
                    status: t("status"),
                    budget: t("budget"),
                    currency: t("currency"),
                    totalRevenue: t("revenue"),
                    totalExpense: t("expenses")
                })}
                onAdd={canCreateProject ? openCreateModal : undefined}
                addLabel={t("create_project")}
                filters={[
                    {
                        id: "status",
                        label: t("status"),
                        options: [
                            { value: "ALL", label: t("all_status") },
                            { value: "ACTIVE", label: t("active") },
                            { value: "PAUSED", label: t("paused") },
                            { value: "COMPLETED", label: t("completed") }
                        ]
                    }
                ]}
            />

            <DataTable
                data={filteredProjects}
                isLoading={loading}
                columns={[
                    {
                        key: "name",
                        header: t("name"),
                        render: (p) => (
                            <div
                                onClick={() => router.push(`/finance/projects/${p.id}`)}
                                className="hover:text-blue-400 block cursor-pointer"
                            >
                                <div className="font-medium text-white">{p.name}</div>
                                <div className="text-xs text-[var(--muted)] font-normal line-clamp-1 max-w-[200px] mt-0.5">
                                    {p.description || t("no_description")}
                                </div>
                            </div>
                        )
                    },
                    {
                        key: "projectCode",
                        header: "Mã dự án",
                        render: (p) => {
                            const currencyText = (p.currency || p.defaultCurrency || "VND") as string;
                            return (
                                <span className="font-medium text-white">
                                    {p.name} - {currencyText}
                                </span>
                            );
                        }
                    },
                    {
                        key: "members",
                        header: t("members"),
                        render: (p) => (
                            <div className="flex items-center gap-1 text-[var(--muted)]">
                                <Users size={14} />
                                <span>{p.memberIds?.length || 0}</span>
                            </div>
                        )
                    },
                    {
                        key: "totalRevenue",
                        header: t("revenue"),
                        align: "right",
                        render: (p) => (
                            <span className="font-medium text-green-400">
                                ${p.totalRevenue.toLocaleString("vi-VN")}
                            </span>
                        )
                    },
                    {
                        key: "totalExpense",
                        header: t("expenses"),
                        align: "right",
                        render: (p) => (
                            <span className="font-medium text-red-400">
                                ${p.totalExpense.toLocaleString("vi-VN")}
                            </span>
                        )
                    },
                    {
                        key: "status",
                        header: t("status"),
                        align: "center",
                        render: (p) => (
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${p.status === "ACTIVE" ? "bg-green-500/10 text-green-500" :
                                p.status === "COMPLETED" ? "bg-blue-500/10 text-blue-500" :
                                    "bg-gray-500/10 text-gray-500"
                                }`}>
                                {p.status === "ACTIVE" ? t("active") :
                                    p.status === "COMPLETED" ? t("completed") :
                                        t("paused")}
                            </span>
                        )
                    },
                    {
                        key: "profit",
                        header: t("profit"),
                        align: "right",
                        render: (p) => (
                            <span className="font-bold text-white">
                                ${(p.totalRevenue - p.totalExpense).toLocaleString("vi-VN")}
                            </span>
                        )
                    },
                    {
                        key: "actions",
                        header: t("actions"),
                        align: "center",
                        width: "w-24",
                        render: (p) => (
                            <ActionCell>
                                <button
                                    onClick={(e) => { e.stopPropagation(); router.push(`/finance/projects/${p.id}`); }}
                                    className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors"
                                    title={t("view_detail")}
                                >
                                    <Eye size={14} />
                                </button>
                                {userRole === "ADMIN" && (
                                    <>
                                        <button
                                            onClick={(e) => openEditModal(p, e)}
                                            className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-yellow-400 transition-colors"
                                            title={t("edit")}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(p.id, e)}
                                            className="p-1.5 rounded hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-colors"
                                            title={t("delete")}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            </ActionCell>
                        )
                    }
                ]}
                itemsPerPage={ITEMS_PER_PAGE}
                onRowClick={(p) => router.push(`/finance/projects/${p.id}`)}
                emptyMessage={t("no_data")}
            />

            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card w-full max-w-md p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                {selectedProject ? <Edit2 size={24} className="text-yellow-400" /> : <Plus size={24} className="text-blue-400" />}
                                {selectedProject ? t("edit_project") : t("create_project")}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("name")}</label>
                                    <select
                                        value={selectedDuAnId}
                                        onChange={(e) => {
                                            const id = e.target.value;
                                            setSelectedDuAnId(id);
                                            if (id === "__CURRENT__") return;

                                            const opt = duAnOptions.find(o => o.id === id);
                                            if (opt) setName(opt.tenDuAn);
                                        }}
                                        className="glass-input w-full p-2 rounded-lg"
                                        required
                                        disabled={duAnLoading}
                                    >
                                        <option value="" disabled>
                                            {duAnLoading ? (t("loading") || "Loading...") : "Chọn dự án từ du_an"}
                                        </option>

                                        {duAnOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>
                                                {opt.tenDuAn}
                                            </option>
                                        ))}

                                        {selectedProject &&
                                            selectedDuAnId === "__CURRENT__" &&
                                            !duAnOptions.some(opt => opt.tenDuAn === selectedProject.name) && (
                                                <option value="__CURRENT__">{selectedProject.name}</option>
                                            )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("description")}</label>
                                    <textarea value={desc} onChange={e => setDesc(e.target.value)} className="glass-input w-full p-2 rounded-lg" rows={3} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("status")}</label>
                                    <select value={status} onChange={e => setStatus(e.target.value as any)} className="glass-input w-full p-2 rounded-lg">
                                        <option value="ACTIVE">{t("active")}</option>
                                        <option value="PAUSED">{t("paused")}</option>
                                        <option value="COMPLETED">{t("completed")}</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("budget")}</label>
                                        <CurrencyInput
                                            value={budget}
                                            onChange={setBudget}
                                            currency={currency}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("currency")}</label>
                                        <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="glass-input w-full p-2 rounded-lg">
                                            <option value="USD">USD</option>
                                            <option value="VND">VND</option>
                                            <option value="KHR">KHR</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-2">{t("members")}</label>
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={memberSearchTerm}
                                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                                            placeholder="Tìm theo tên/email/position..."
                                            className="glass-input w-full p-2 rounded-lg"
                                        />
                                        <div className="max-h-48 overflow-y-auto border border-white/10 bg-white/5 rounded-xl p-3 space-y-2">
                                        {usersLoading ? (
                                            <p className="text-sm text-[var(--muted)]">{t("loading") || "Loading..."}</p>
                                        ) : allUsers.length === 0 ? (
                                            <p className="text-sm text-[var(--muted)]">{t("no_data") || "No users"}</p>
                                        ) : (
                                            (() => {
                                                const q = memberSearchTerm.trim().toLowerCase();
                                                const visibleUsers = q
                                                    ? allUsers.filter((u) => {
                                                        const name = (u.displayName || "").toLowerCase();
                                                        const email = (u.email || "").toLowerCase();
                                                        const pos = (u.position || "").toLowerCase();
                                                        return name.includes(q) || email.includes(q) || pos.includes(q);
                                                    })
                                                    : allUsers;

                                                if (visibleUsers.length === 0) {
                                                    return (
                                                        <p className="text-sm text-[var(--muted)]">
                                                            Không tìm thấy thành viên phù hợp.
                                                        </p>
                                                    );
                                                }

                                                return visibleUsers.map((u) => {
                                                    const checked = selectedMemberIds.includes(u.uid);
                                                    return (
                                                        <label
                                                            key={u.uid}
                                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(e) => {
                                                                    const nextChecked = e.target.checked;
                                                                    setSelectedMemberIds(prev => {
                                                                        if (nextChecked) {
                                                                            if (prev.includes(u.uid)) return prev;
                                                                            return [...prev, u.uid];
                                                                        }
                                                                        return prev.filter(id => id !== u.uid);
                                                                    });
                                                                }}
                                                                className="w-4 h-4 rounded border-white/20 text-blue-400 focus:ring-blue-500/40"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium text-white truncate">
                                                                    {u.displayName || u.email}
                                                                </div>
                                                                <div className="text-xs text-[var(--muted)] truncate">
                                                                    {u.position || u.email}
                                                                </div>
                                                            </div>
                                                        </label>
                                                    );
                                                });
                                            })()
                                        )}
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" className="flex items-center justify-center gap-2 w-full p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white mt-4 border-none transition-all">
                                    <Save size={18} />
                                    {selectedProject ? t("update_project") : t("create_project_now")}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

