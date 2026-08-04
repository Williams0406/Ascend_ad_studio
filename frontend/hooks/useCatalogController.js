'use client';

import { useCallback, useState } from 'react';

export function useCatalogController({
  initialSort = 'recent',
  initialView = 'grid',
} = {}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [viewMode, setViewMode] = useState(initialView);
  const [selected, setSelected] = useState(null);

  const resetCatalog = useCallback(() => {
    setQuery('');
    setSort(initialSort);
    setSelected(null);
  }, [initialSort]);

  return {
    query,
    setQuery,
    sort,
    setSort,
    viewMode,
    setViewMode,
    selected,
    setSelected,
    resetCatalog,
  };
}
