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
  tableSortForKey,
  type SortColumn,
  type TableSortSpec,
  type UserSettings,
} from "../../shared/user-settings";

interface UserSettingsContextValue {
  ready: boolean;
  getTableSort: (tableKey: string) => TableSortSpec;
  setTableSortColumns: (tableKey: string, orderBy: SortColumn[]) => void;
  toggleTableSortColumn: (tableKey: string, column: string) => void;
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

  const getTableSort = useCallback(
    (tableKey: string): TableSortSpec => tableSortForKey(settings, tableKey),
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
    (tableKey: string, column: string) => {
      const current = getTableSort(tableKey);
      persistTableSort(tableKey, nextSortOnColumnClick(current, column));
    },
    [getTableSort, persistTableSort],
  );

  const value = useMemo(
    (): UserSettingsContextValue => ({
      ready: true,
      getTableSort,
      setTableSortColumns,
      toggleTableSortColumn,
    }),
    [getTableSort, setTableSortColumns, toggleTableSortColumn],
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
