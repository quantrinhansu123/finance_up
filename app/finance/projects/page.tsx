"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { getProjects, createProject, updateProject, getTransactions, deleteProject } from "@/lib/finance";
import { Project } from "@/types/finance";
import { useRouter } from "next/navigation";
import { getUserRole, getAccessibleProjects, hasProjectPermission, Role } from "@/lib/permissions";
import { Users, Trash2, ChevronLeft, ChevronRight, ShieldX, Plus, Eye, Save, X, Edit2, ChevronDown } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { ActionCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";
import { formatProjectMaLan } from "@/lib/project-display";
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
    const [membersPickerOpen, setMembersPickerOpen] = useState(false);
    const membersPickerRef = useRef<HTMLDivElement>(null);
    const [memberPanelPos, setMemberPanelPos] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);

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
        setMembersPickerOpen(false);
        setIsModalOpen(true);
        void loadUsersForProjectModal();
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
        setMembersPickerOpen(false);
        setIsModalOpen(true);
        void loadUsersForProjectModal();
    };

    useEffect(() => {
        fetchData();
    }, []);

    useLayoutEffect(() => {
        if (!membersPickerOpen || !membersPickerRef.current) {
            setMemberPanelPos(null);
            return;
        }
        const sync = () => {
            const wrap = membersPickerRef.current;
            if (!wrap) return;
            const r = wrap.getBoundingClientRect();
            setMemberPanelPos({
                top: r.bottom + 8,
                left: r.left,
                width: r.width,
            });
        };
        sync();
        window.addEventListener("resize", sync);
        return () => window.removeEventListener("resize", sync);
    }, [membersPickerOpen]);

    useEffect(() => {
        if (!membersPickerOpen) return;
        const onDocMouseDown = (ev: MouseEvent) => {
            const el = membersPickerRef.current;
            if (el && !el.contains(ev.target as Node)) setMembersPickerOpen(false);
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, [membersPickerOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (userRole !== "ADMIN") {
            alert(t("no_permission"));
            return;
        }

        if (!name.trim()) {
            alert(t("name_required") || "Vui lòng nhập tên dự án");
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
                        render: (p) => (
                            <span className="font-medium text-white">{formatProjectMaLan(p)}</span>
                        ),
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
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="glass-input w-full p-2 rounded-lg"
                                        placeholder={t("name")}
                                        required
                                    />
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
                                    <div className="relative" ref={membersPickerRef}>
                                    <button
                                        type="button"
                                        onClick={() => setMembersPickerOpen((o) => !o)}
                                        className="glass-input w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left min-h-[42px] hover:bg-white/[0.06] transition-colors"
                                    >
                                        <span className={`text-sm truncate ${selectedMemberIds.length ? "text-white" : "text-[var(--muted)]"}`}>
                                            {selectedMemberIds.length === 0
                                                ? t("pick_members_placeholder")
                                                : t("members_selected_count").replace(
                                                      "{count}",
                                                      String(selectedMemberIds.length)
                                                  )}
                                        </span>
                                        <ChevronDown
                                            size={18}
                                            className={`text-[var(--muted)] transition-transform shrink-0 ${membersPickerOpen ? "rotate-180" : ""}`}
                                        />
                                    </button>
                                    {membersPickerOpen && memberPanelPos && (
                                        <div
                                            className="fixed z-[100] rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden max-h-[min(16rem,calc(100vh-24px))]"
                                            style={{
                                                top: memberPanelPos.top,
                                                left: memberPanelPos.left,
                                                width: memberPanelPos.width,
                                            }}
                                        >
                                            <div className="p-2 border-b border-white/10">
                                                <input
                                                    type="text"
                                                    value={memberSearchTerm}
                                                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                                                    placeholder="Tìm theo tên/email/chức vụ…"
                                                    className="glass-input w-full p-2 rounded-lg text-sm"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                                                {usersLoading ? (
                                                    <p className="text-sm text-[var(--muted)] px-2 py-3">{t("loading") || "Loading..."}</p>
                                                ) : allUsers.length === 0 ? (
                                                    <p className="text-sm text-[var(--muted)] px-2 py-3">{t("no_data") || "No users"}</p>
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
                                                                <p className="text-sm text-[var(--muted)] px-2 py-3">
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
                                                                            setSelectedMemberIds((prev) => {
                                                                                if (nextChecked) {
                                                                                    if (prev.includes(u.uid)) return prev;
                                                                                    return [...prev, u.uid];
                                                                                }
                                                                                return prev.filter((id) => id !== u.uid);
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
                                    )}
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

