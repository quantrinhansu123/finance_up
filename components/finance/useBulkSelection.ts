"use client";

import { useCallback, useMemo, useState } from "react";

export function useBulkSelection<T extends { id: string }>(
    items: T[],
    canSelect: (item: T) => boolean = () => true
) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkWorking, setBulkWorking] = useState(false);

    const selectableItems = useMemo(
        () => items.filter((item) => item.id && canSelect(item)),
        [items, canSelect]
    );

    const allSelected =
        selectableItems.length > 0 &&
        selectableItems.every((item) => selectedIds.has(item.id));

    const toggle = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(selectableItems.map((item) => item.id)));
    }, [allSelected, selectableItems]);

    const clear = useCallback(() => setSelectedIds(new Set()), []);

    const getSelected = useCallback(
        () => items.filter((item) => item.id && selectedIds.has(item.id)),
        [items, selectedIds]
    );

    return {
        selectedIds,
        selectedCount: selectedIds.size,
        selectableCount: selectableItems.length,
        allSelected,
        bulkWorking,
        setBulkWorking,
        toggle,
        toggleAll,
        clear,
        getSelected,
    };
}
