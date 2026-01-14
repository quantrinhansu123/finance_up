"use client";

import { useState, useEffect, useMemo } from "react";
import { getProjects, createProject, updateProject, getTransactions, deleteProject } from "@/lib/finance";
import { Project } from "@/types/finance";
import { useRouter } from "next/navigation";
import { getUserRole, getAccessibleProjects, hasProjectPermission, Role } from "@/lib/permissions";
import { Users, Trash2, ChevronLeft, ChevronRight, ShieldX, Plus, Eye, Save, X, Edit2 } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { ActionCell } from "@/components/finance/DataTable";

const ITEMS_PER_PAGE = 10;

export default function ProjectsPage() {
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
    const [currentPage, setCurrentPage] = useState(1);

    // Form
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [status, setStatus] = useState<Project["status"]>("ACTIVE");
    const [budget, setBudget] = useState("");
    const [currency, setCurrency] = useState<"USD" | "VND" | "KHR">("USD");

    // Filtered & Paginated data
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.description || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = activeFilters.status === "ALL" || p.status === activeFilters.status;
            return matchSearch && matchStatus;
        });
    }, [projects, searchTerm, activeFilters]);

    const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProjects.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredProjects, currentPage]);

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeFilters]);

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
            const [projs, txs] = await Promise.all([
                getProjects(),
                getTransactions()
            ]);

            // Calculate totals for each project
            const projectsWithStats = projs.map(p => {
                const projectTxs = txs.filter((t: any) => t.projectId === p.id && t.status === "APPROVED");
                const revenue = projectTxs.filter((t: any) => t.type === "IN").reduce((sum: number, t: any) => sum + t.amount, 0);
                const expense = projectTxs.filter((t: any) => t.type === "OUT").reduce((sum: number, t: any) => sum + t.amount, 0);
                return { ...p, totalRevenue: revenue, totalExpense: expense };
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
        setIsModalOpen(true);
    };

    const openEditModal = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedProject(project);
        setName(project.name);
        setDesc(project.description || "");
        setStatus(project.status);
        setBudget(project.budget?.toString() || "");
        setCurrency(project.currency as any || "USD");
        setIsModalOpen(true);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (userRole !== "ADMIN") {
            alert("Bạn không có quyền thực hiện thao tác này");
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
                    memberIds: [],
                    createdAt: Date.now()
                });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };



    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // Chỉ ADMIN mới được xóa
        if (userRole !== "ADMIN") {
            alert("Chỉ quản trị viên mới có quyền xóa dự án");
            return;
        }

        if (!confirm("Bạn có chắc chắn muốn xóa dự án này?")) return;
        try {
            await deleteProject(id);
            setAllProjects(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Delete failed", error);
            alert("Xóa thất bại");
        }
    };

    // Check if user can create projects
    const canCreateProject = userRole === "ADMIN";

    // Check if user has any accessible projects
    const hasAccessibleProjects = projects.length > 0;

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="glass-card h-64 animate-pulse rounded-xl"></div>
            </div>
        );
    }

    // If user has no accessible projects, show message
    if (!hasAccessibleProjects && !loading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Dự án</h1>
                        <p className="text-[var(--muted)]">Quản lý dự án và P&L</p>
                    </div>
                </div>

                <div className="glass-card p-8 rounded-xl text-center">
                    <ShieldX size={48} className="mx-auto text-[var(--muted)] mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Không có quyền truy cập</h3>
                    <p className="text-[var(--muted)]">
                        Bạn chưa được phân quyền vào bất kỳ dự án nào.
                        Vui lòng liên hệ quản trị viên để được cấp quyền.
                    </p>
                </div>
            </div>
        );
    }





    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dự án</h1>
                    <p className="text-[var(--muted)]">Quản lý dự án và P&L</p>
                </div>
            </div>

            {/* Show access message if user has limited access */}
            {userRole !== "ADMIN" && (
                <div className="glass-card p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-400">
                        📋 Bạn chỉ có thể xem các dự án mà bạn được phân quyền tham gia ({projects.length} dự án).
                        Liên hệ quản trị viên để được thêm vào dự án khác.
                    </p>
                </div>
            )}

            {/* Toolbar */}
            <DataTableToolbar
                searchPlaceholder="Tìm kiếm dự án..."
                onSearch={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => {
                    setActiveFilters({ status: "ALL" });
                    setSearchTerm("");
                }}
                onExport={() => exportToCSV(filteredProjects, "Danh_Sach_Du_An", {
                    name: "Tên dự án",
                    description: "Mô tả",
                    status: "Trạng thái",
                    budget: "Ngân sách",
                    currency: "Tiền tệ",
                    totalRevenue: "Doanh thu",
                    totalExpense: "Chi phí"
                })}
                onAdd={canCreateProject ? openCreateModal : undefined}
                addLabel="Tạo dự án mới"
                filters={[
                    {
                        id: "status",
                        label: "Trạng thái",
                        options: [
                            { value: "ALL", label: "Tất cả trạng thái" },
                            { value: "ACTIVE", label: "Đang hoạt động" },
                            { value: "PAUSED", label: "Tạm dừng" },
                            { value: "COMPLETED", label: "Hoàn thành" }
                        ]
                    }
                ]}
            />

            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="p-4 border-b border-white/10">Project Name</th>
                            <th className="p-4 border-b border-white/10">Members</th>
                            <th className="p-4 border-b border-white/10 text-right">Revenue</th>
                            <th className="p-4 border-b border-white/10 text-right">Expense</th>
                            <th className="p-4 border-b border-white/10 text-center">Status</th>
                            <th className="p-4 border-b border-white/10 text-right">Profit</th>
                            <th className="p-4 border-b border-white/10 text-center w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedProjects.map((project) => (
                            <tr
                                key={project.id}
                                className="hover:bg-white/5 transition-colors group cursor-pointer"
                                onClick={() => router.push(`/finance/projects/${project.id}`)}
                            >
                                <td className="p-4 font-medium text-white">
                                    <div
                                        onClick={() => router.push(`/finance/projects/${project.id}`)}
                                        className="hover:text-blue-400 block cursor-pointer"
                                    >
                                        {project.name}
                                        <div className="text-xs text-[var(--muted)] font-normal line-clamp-1 max-w-[200px] mt-0.5">
                                            {project.description || "No description"}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1 text-[var(--muted)]">
                                        <Users size={14} />
                                        <span>{project.memberIds?.length || 0}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-right font-medium text-green-400">
                                    ${project.totalRevenue.toLocaleString()}
                                </td>
                                <td className="p-4 text-right font-medium text-red-400">
                                    ${project.totalExpense.toLocaleString()}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${project.status === "ACTIVE" ? "bg-green-500/10 text-green-500" :
                                        project.status === "COMPLETED" ? "bg-blue-500/10 text-blue-500" :
                                            "bg-gray-500/10 text-gray-500"
                                        }`}>
                                        {project.status === "ACTIVE" ? "Doing" : project.status}
                                    </span>
                                </td>

                                <td className="p-4 text-right font-bold text-white">
                                    ${(project.totalRevenue - project.totalExpense).toLocaleString()}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1 justify-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); router.push(`/finance/projects/${project.id}`); }}
                                            className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors"
                                            title="Xem chi tiết"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        {userRole === "ADMIN" && (
                                            <>
                                                <button
                                                    onClick={(e) => openEditModal(project, e)}
                                                    className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-yellow-400 transition-colors"
                                                    title="Sửa"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(project.id, e)}
                                                    className="p-1.5 rounded hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {paginatedProjects.length === 0 && !loading && (
                            <tr><td colSpan={7} className="p-8 text-center text-[var(--muted)]">
                                {searchTerm || activeFilters.status !== "ALL" ? "Không tìm thấy dự án phù hợp" : "Chưa có dự án nào"}
                            </td></tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-white/10">
                        <div className="text-sm text-[var(--muted)]">
                            Trang {currentPage} / {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                                            ? "bg-blue-500 text-white"
                                            : "hover:bg-white/5 text-[var(--muted)]"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card w-full max-w-md p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                {selectedProject ? <Edit2 size={24} className="text-yellow-400" /> : <Plus size={24} className="text-blue-400" />}
                                {selectedProject ? "Sửa dự án" : "Tạo dự án mới"}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tên dự án</label>
                                    <input value={name} onChange={e => setName(e.target.value)} className="glass-input w-full p-2 rounded-lg" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Mô tả</label>
                                    <textarea value={desc} onChange={e => setDesc(e.target.value)} className="glass-input w-full p-2 rounded-lg" rows={3} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Trạng thái</label>
                                    <select value={status} onChange={e => setStatus(e.target.value as any)} className="glass-input w-full p-2 rounded-lg">
                                        <option value="ACTIVE">Đang hoạt động</option>
                                        <option value="PAUSED">Tạm dừng</option>
                                        <option value="COMPLETED">Hoàn thành</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Ngân sách</label>
                                        <CurrencyInput
                                            value={budget}
                                            onChange={setBudget}
                                            currency={currency}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tiền tệ</label>
                                        <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="glass-input w-full p-2 rounded-lg">
                                            <option value="USD">USD</option>
                                            <option value="VND">VND</option>
                                            <option value="KHR">KHR</option>
                                        </select>
                                    </div>
                                </div>

                                <button type="submit" className="flex items-center justify-center gap-2 w-full p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white mt-4 border-none transition-all">
                                    <Save size={18} />
                                    {selectedProject ? "Cập nhật dự án" : "Tạo dự án ngay"}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
