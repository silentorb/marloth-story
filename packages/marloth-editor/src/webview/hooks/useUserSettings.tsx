import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EditorApiClient } from "../../shared/http-client";
import {
  emptyUserSettings,
  isDefaultTableSort,
  nextSortOnColumnClick,
  normalizeTableSort,
  effectiveTableSort,
  tableSortOverrideForKey,
  type SortColumn,
  type TableSortSpec,
  type UserSettings,
} from "../../shared/user-settings";

interface UserSettingsContextValue {
  ready: boolean;
  hasTableSortOverride: (tableKey: string) => boolean;
  getTableSort: (tableKey: string, defaultSort?: TableSortSpec) => TableSortSpec;
  setTableSortColumns: (tableKey: string, orderBy: SortColumn[]) => void;
  toggleTableSortColumn: (
    tableKey: string,
    column: string,
    defaultSort?: TableSortSpec,
  ) => void;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

interface UserSettingsProviderProps {
  api: EditorApiClient;
  children: ReactNode;
}

export function UserSettingsProvider({ api, children }: UserSettingsProviderProps) {
  const [settings, setSettings] = useState<UserSettings>(() => emptyUserSettings());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await api.getUserSettings();
        if (!cancelled) setSettings(loaded);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const hasTableSortOverride = useCallback(
    (tableKey: string): boolean => tableSortOverrideForKey(settings, tableKey) !== undefined,
    [settings],
  );

  const getTableSort = useCallback(
    (tableKey: string, defaultSort?: TableSortSpec): TableSortSpec =>
      effectiveTableSort(settings, tableKey, defaultSort),
    [settings],
  );

  const persistTableSort = useCallback(
    (tableKey: string, orderBy: SortColumn[]) => {
      const spec = normalizeTableSort({ orderBy });
      const patchValue = isDefaultTableSort(spec) ? null : spec;

      setSettings((current) => {
        const tableSorts = { ...(current.tableSorts ?? {}) };
        if (patchValue === null) delete tableSorts[tableKey];
        else tableSorts[tableKey] = patchValue;
        const next: UserSettings = {
          version: 1,
          ...(Object.keys(tableSorts).length > 0 ? { tableSorts } : {}),
        };
        void api.patchUserSettings({ tableSorts: { [tableKey]: patchValue } }).catch(() => {
          /* keep optimistic local state */
        });
        return next;
      });
    },
    [api],
  );

  const setTableSortColumns = useCallback(
    (tableKey: string, orderBy: SortColumn[]) => {
      persistTableSort(tableKey, orderBy);
    },
    [persistTableSort],
  );

  const toggleTableSortColumn = useCallback(
    (tableKey: string, column: string, defaultSort?: TableSortSpec) => {
      const current = getTableSort(tableKey, defaultSort);
      persistTableSort(tableKey, nextSortOnColumnClick(current, column));
    },
    [getTableSort, persistTableSort],
  );

  const value = useMemo(
    (): UserSettingsContextValue => ({
      ready: true,
      hasTableSortOverride,
      getTableSort,
      setTableSortColumns,
      toggleTableSortColumn,
    }),
    [hasTableSortOverride, getTableSort, setTableSortColumns, toggleTableSortColumn],
  );

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings(): UserSettingsContextValue {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error("useUserSettings must be used within UserSettingsProvider");
  }
  return context;
}
