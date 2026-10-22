import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { FilterValue } from "../components/TestamentFilter";

interface BookFilterValue {
  filter: FilterValue;
  setFilter: (value: FilterValue) => void;
}

const BookFilterContext = createContext<BookFilterValue | undefined>(undefined);

export function BookFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const value = useMemo(() => ({ filter, setFilter }), [filter]);
  return <BookFilterContext.Provider value={value}>{children}</BookFilterContext.Provider>;
}

export function useBookFilter(): BookFilterValue {
  const value = useContext(BookFilterContext);
  if (!value) throw new Error("useBookFilter debe usarse dentro de BookFilterProvider");
  return value;
}
