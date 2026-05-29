import { useCallback, useState } from "react";
import type { DatabaseColumnDef } from "../../shared/types";
import "./enum-select-cell.css";

interface EnumSelectCellProps {
  def: DatabaseColumnDef;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void | Promise<void>;
}

export function EnumSelectCell({ def, value, disabled = false, onChange }: EnumSelectCellProps) {
  const [saving, setSaving] = useState(false);
  const options = def.options ?? [];

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (next === value) return;
      setSaving(true);
      try {
        await onChange(next);
      } finally {
        setSaving(false);
      }
    },
    [onChange, value],
  );

  if (options.length === 0) {
    return value ? <span className="marloth-database-cell-badge">{value}</span> : null;
  }

  const defaultValue = def.defaultValue && options.includes(def.defaultValue)
    ? def.defaultValue
    : options[0]!;
  const selectValue =
    value && options.includes(value) ? value : defaultValue;

  return (
    <select
      className="marloth-enum-select"
      value={selectValue}
      disabled={disabled || saving}
      aria-label={def.name}
      onChange={(event) => void handleChange(event)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      {value && !options.includes(value) ? (
        <option value={value}>{value}</option>
      ) : null}
    </select>
  );
}
