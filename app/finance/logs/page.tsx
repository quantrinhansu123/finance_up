"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, limit, startAfter, where, Timestamp, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { ActivityLog } from "@/types/finance";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, FileJson, Loader2 } from "lucide-react";

const ITEMS_PER_PAGE = 30;
const INITIAL_LOAD = 100; // Load 100 records initially
const LOAD_MORE_COUNT = 100;

export default function LogsPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [totalEstimate, setTotalEstimate] = useState(0);

    // Filters
    const [filterAction, setFilterAction] = useState("");
    const [filterUser, setFilterUser] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        // Default: 7 days ago
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [filterDateTo, setFilterDateTo] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [filterEntity, setFilterEntity] = useState("");
    
    // Pagination (client-side for filtered results)
    const [currentPage, setCurrentPage] = useState(1);

    // Cache for dropdown options
    const [cachedUsers, setCachedUsers] = useState<string[]>([]);
    const [cachedEntities, setCachedEntities] = useState<string[]>([]);

    const fetchLogs = useCallback(async (isInitial = true) => {
        if (isInitial) {
            setLoading(true);
            setLogs([]);
            setLastDoc(null);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }

        try {
            // Build query with date range filter (server-side)
            let constraints: any[] = [orderBy("timestamp", "desc")];
            
            if (filterDateFrom) {
                const fromDate = new Date(filterDateFrom);
                fromDate.setHours(0, 0, 0, 0);
                constraints.push(where("timestamp", ">=", fromDate.getTime()));
            }
            
            if (filterDateTo) {
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                constraints.push(where("timestamp", "<=", toDate.getTime()));
            }

            constraints.push(limit(isInitial ? INITIAL_LOAD : LOAD_MORE_COUNT));

            if (!isInitial && lastDoc) {
                constraints.push(startAfter(lastDoc));
            }

            const q = query(collection(db, "finance_logs"), ...constraints);
            const snapshot = await getDocs(q);
            
            const newLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
            
            if (isInitial) {
                setLogs(newLogs);
                // Update cached options
                const users = new Set(cachedUsers);
                const entities = new Set(cachedEntities);
                newLogs.forEach(log => {
                    if (log.userName) users.add(log.userName);
                    if (log.entityType) entities.add(log.entityType);
                });
                setCachedUsers(Array.from(users).sort());
                setCachedEntities(Array.from(entities).sort());
            } else {
                setLogs(prev => [...prev, ...newLogs]);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === (isInitial ? INITIAL_LOAD : LOAD_MORE_COUNT));
            
            // Estimate total (rough)
            if (isInitial && snapshot.docs.length > 0) {
                setTotalEstimate(snapshot.docs.length);
            }

        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filterDateFrom, filterDateTo, lastDoc, cachedUsers, cachedEntities]);

    // Initial load
    useEffect(() => {
        fetchLogs(true);
    }, [filterDateFrom, filterDateTo]);

    // Client-side filtering (for action, user, entity)
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (filterAction && log.action !== filterAction) return false;
            if (filterUser && !log.userName.toLowerCase().includes(filterUser.toLowerCase())) return false;
            if (filterEntity && log.entityType !== filterEntity) return false;
            return true;
        });
    }, [logs, filterAction, filterUser, filterEntity]);

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredLogs, currentPage]);

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filterAction, filterUser, filterEntity]);

    // Actions list
    const actions = ["LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "TRANSFER", "VIEW"];

    // Export Functions
    const formatLogForExport = (log: ActivityLog) => ({
        "ID": log.id,
        "Thời gian": new Date(log.timestamp).toLocaleString("vi-VN", {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }),
        "Timestamp": log.timestamp,
        "Người dùng": log.userName,
        "User ID": log.userId,
        "Hành động": log.action,
        "Loại đối tượng": log.entityType,
        "ID đối tượng": log.entityId,
        "Chi tiết": log.details,
        "IP": log.ip || "",
        "Vị trí": log.location || "",
        "Thiết bị": log.device || "",
    });

    const exportToCSV = async () => {
        setExporting(true);
        try {
            // Load all data for export if needed
            const dataToExport = await getAllLogsForExport();
            const formatted = dataToExport.map(formatLogForExport);
            const headers = Object.keys(formatted[0] || {});
            
            const csvContent = [
                '\ufeff',
                headers.join(','),
                ...formatted.map(row => 
                    headers.map(header => {
                        const value = String(row[header as keyof typeof row] || '');
                        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    }).join(',')
                )
            ].join('\n');

            downloadFile(csvContent, `nhat-ky_${getDateTimeString()}.csv`, 'text/csv;charset=utf-8');
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    const exportToJSON = async () => {
        setExporting(true);
        try {
            const dataToExport = await getAllLogsForExport();
            const jsonContent = JSON.stringify({
                exportedAt: new Date().toISOString(),
                totalRecords: dataToExport.length,
                filters: { action: filterAction || "Tất cả", user: filterUser || "Tất cả", dateFrom: filterDateFrom, dateTo: filterDateTo },
                logs: dataToExport
            }, null, 2);
            downloadFile(jsonContent, `nhat-ky_${getDateTimeString()}.json`, 'application/json');
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    const exportToExcel = async () => {
        setExporting(true);
        try {
            const dataToExport = await getAllLogsForExport();
            const formatted = dataToExport.map(formatLogForExport);
            const headers = Object.keys(formatted[0] || {});
            
            let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="H"><Font ss:Bold="1"/><Interior ss:Color="#1a1a1a" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="Logs"><Table>`;
            xml += '<Row>' + headers.map(h => `<Cell ss:StyleID="H"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('') + '</Row>';
            formatted.forEach(row => {
                xml += '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(String(row[h as keyof typeof row] || ''))}</Data></Cell>`).join('') + '</Row>';
            });
            xml += '</Table></Worksheet></Workbook>';
            downloadFile(xml, `nhat-ky_${getDateTimeString()}.xls`, 'application/vnd.ms-excel');
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    const exportToTXT = async () => {
        setExporting(true);
        try {
            const dataToExport = await getAllLogsForExport();
            let txt = `NHẬT KÝ HOẠT ĐỘNG - Xuất lúc: ${new Date().toLocaleString("vi-VN")}\nTổng: ${dataToExport.length} bản ghi\n${'='.repeat(50)}\n\n`;
            dataToExport.forEach((log, i) => {
                txt += `#${i + 1} | ${new Date(log.timestamp).toLocaleString("vi-VN")} | ${log.userName} | ${log.action} | ${log.entityType} | ${log.details}\nIP: ${log.ip || 'N/A'} | Device: ${log.device || 'N/A'}\n\n`;
            });
            downloadFile(txt, `nhat-ky_${getDateTimeString()}.txt`, 'text/plain;charset=utf-8');
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    // Load all logs for export (with current filters)
    const getAllLogsForExport = async (): Promise<ActivityLog[]> => {
        // If we have all data loaded, use filtered logs
        if (!hasMore) {
            return filteredLogs;
        }

        // Otherwise, fetch all with date range
        let constraints: any[] = [orderBy("timestamp", "desc")];
        if (filterDateFrom) {
            const fromDate = new Date(filterDateFrom);
            fromDate.setHours(0, 0, 0, 0);
            constraints.push(where("timestamp", ">=", fromDate.getTime()));
        }
        if (filterDateTo) {
            const toDate = new Date(filterDateTo);
            toDate.setHours(23, 59, 59, 999);
            constraints.push(where("timestamp", "<=", toDate.getTime()));
        }

        const q = query(collection(db, "finance_logs"), ...constraints);
        const snapshot = await getDocs(q);
        let allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));

        // Apply client-side filters
        if (filterAction) allLogs = allLogs.filter(l => l.action === filterAction);
        if (filterUser) allLogs = allLogs.filter(l => l.userName.toLowerCase().includes(filterUser.toLowerCase()));
        if (filterEntity) allLogs = allLogs.filter(l => l.entityType === filterEntity);

        return allLogs;
    };

    const getDateTimeString = () => {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    };

    const escapeXml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setFilterAction("");
        setFilterUser("");
        setFilterEntity("");
        const d = new Date();
        d.setDate(d.getDate() - 7);
        setFilterDateFrom(d.toISOString().split('T')[0]);
        setFilterDateTo(new Date().toISOString().split('T')[0]);
    };

    const setQuickDateRange = (days: number) => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        setFilterDateFrom(from.toISOString().split('T')[0]);
        setFilterDateTo(to.toISOString().split('T')[0]);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Nhật ký Hoạt động</h1>
                    <p className="text-[10px] text-[var(--muted)]">Theo dõi lịch sử truy cập và thay đổi</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fetchLogs(true)} 
                        disabled={loading}
                        className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-white/5 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : "🔄"} Làm mới
                    </button>
                    
                    {/* Export Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            disabled={filteredLogs.length === 0 || exporting}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
                        >
                            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            Xuất
                        </button>
                        
                        {showExportMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                                <div className="absolute right-0 mt-1 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                                    <button onClick={exportToExcel} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-xs">
                                        <FileSpreadsheet size={14} className="text-green-400" /> Excel
                                    </button>
                                    <button onClick={exportToCSV} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-xs">
                                        <FileText size={14} className="text-blue-400" /> CSV
                                    </button>
                                    <button onClick={exportToJSON} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-xs">
                                        <FileJson size={14} className="text-yellow-400" /> JSON
                                    </button>
                                    <button onClick={exportToTXT} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-xs">
                                        <FileText size={14} className="text-gray-400" /> TXT
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Date Range */}
            <div className="flex flex-wrap gap-2">
                <span className="text-[10px] text-[var(--muted)] self-center">Nhanh:</span>
                {[
                    { label: "Hôm nay", days: 0 },
                    { label: "7 ngày", days: 7 },
                    { label: "30 ngày", days: 30 },
                    { label: "90 ngày", days: 90 },
                ].map(({ label, days }) => (
                    <button
                        key={days}
                        onClick={() => setQuickDateRange(days)}
                        className="px-2 py-1 text-[10px] rounded bg-white/5 hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="glass-card p-3 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold">Bộ lọc</h3>
                    <button onClick={clearFilters} className="text-[10px] text-[var(--muted)] hover:text-white">Xóa</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    <div>
                        <label className="block text-[10px] text-[var(--muted)] mb-0.5">Từ ngày</label>
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                            className="glass-input w-full p-1.5 rounded text-xs" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--muted)] mb-0.5">Đến ngày</label>
                        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                            className="glass-input w-full p-1.5 rounded text-xs" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--muted)] mb-0.5">Hành động</label>
                        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                            className="glass-input w-full p-1.5 rounded text-xs">
                            <option value="">Tất cả</option>
                            {actions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--muted)] mb-0.5">Người dùng</label>
                        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                            className="glass-input w-full p-1.5 rounded text-xs">
                            <option value="">Tất cả</option>
                            {cachedUsers.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--muted)] mb-0.5">Đối tượng</label>
                        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
                            className="glass-input w-full p-1.5 rounded text-xs">
                            <option value="">Tất cả</option>
                            {cachedEntities.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 text-xs">
                <span className="text-[var(--muted)]">Đã tải: <span className="text-white font-bold">{logs.length}</span></span>
                <span className="text-[var(--muted)]">Hiển thị: <span className="text-blue-400 font-bold">{filteredLogs.length}</span></span>
                {hasMore && <span className="text-yellow-400">Còn dữ liệu...</span>}
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] text-[10px] uppercase font-semibold tracking-wider sticky top-0">
                            <tr>
                                <th className="p-2 border-b border-white/10">Thời gian</th>
                                <th className="p-2 border-b border-white/10">Người dùng</th>
                                <th className="p-2 border-b border-white/10">Hành động</th>
                                <th className="p-2 border-b border-white/10">Đối tượng</th>
                                <th className="p-2 border-b border-white/10">Chi tiết</th>
                                <th className="p-2 border-b border-white/10">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-[var(--muted)] text-xs">
                                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />Đang tải...
                                </td></tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-[var(--muted)] text-xs">Không có dữ liệu</td></tr>
                            ) : (
                                paginatedLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-white/5 text-[11px]">
                                        <td className="p-2 text-[var(--muted)] whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString("vi-VN", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-2 font-medium text-white">{log.userName}</td>
                                        <td className="p-2">
                                            <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${
                                                log.action === "APPROVE" ? "bg-green-500/20 text-green-400" :
                                                log.action === "REJECT" || log.action === "DELETE" ? "bg-red-500/20 text-red-400" :
                                                log.action === "CREATE" ? "bg-blue-500/20 text-blue-400" :
                                                log.action === "UPDATE" ? "bg-yellow-500/20 text-yellow-400" :
                                                "bg-white/10 text-white/70"
                                            }`}>{log.action}</span>
                                        </td>
                                        <td className="p-2 text-[var(--muted)]">{log.entityType}</td>
                                        <td className="p-2 text-[var(--muted)] max-w-[200px] truncate" title={log.details}>{log.details}</td>
                                        <td className="p-2 text-[10px] text-[var(--muted)] font-mono">{log.ip || "-"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination + Load More */}
                <div className="flex items-center justify-between p-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        {hasMore && (
                            <button
                                onClick={() => fetchLogs(false)}
                                disabled={loadingMore}
                                className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-white/5 disabled:opacity-50"
                            >
                                {loadingMore ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                                Tải thêm
                            </button>
                        )}
                        <span className="text-[10px] text-[var(--muted)]">
                            Trang {currentPage}/{totalPages || 1}
                        </span>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                className="p-1 rounded hover:bg-white/5 disabled:opacity-50"><ChevronLeft size={14} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                className="p-1 rounded hover:bg-white/5 disabled:opacity-50"><ChevronRight size={14} /></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
