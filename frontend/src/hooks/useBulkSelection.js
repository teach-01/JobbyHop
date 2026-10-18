import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * useBulkSelection — reusable bulk selection hook for Admin lists.
 *
 * @param {Array}  items     - The currently visible/filtered records (must have ._id fields)
 * @param {string} idKey     - Field to use as unique id (default: '_id')
 */
export function useBulkSelection(items = [], idKey = '_id') {
  const [selectedIds, setSelectedIds] = useState(new Set());

  // When the items list changes (filter/search/tab change), clear stale selections
  // that are no longer in the visible list to prevent ghost selections.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(items.map((item) => item[idKey]?.toString()));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      // Only update state if something actually changed
      return next.size === prev.size ? prev : next;
    });
  }, [items, idKey]);

  const toggleSelection = useCallback(
    (id) => {
      const strId = id?.toString();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(strId)) {
          next.delete(strId);
        } else {
          next.add(strId);
        }
        return next;
      });
    },
    []
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item[idKey]?.toString())));
  }, [items, idKey]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id) => selectedIds.has(id?.toString()),
    [selectedIds]
  );

  const selectedCount = selectedIds.size;

  const isAllSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items.length, selectedIds.size]
  );

  const isIndeterminate = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < items.length,
    [items.length, selectedIds.size]
  );

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    selectedIdsArray,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isIndeterminate,
  };
}
