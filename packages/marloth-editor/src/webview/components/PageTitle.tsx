import "./page-title.css";

interface PageTitleProps {
  value: string;
  onChange: (value: string) => void;
}

export function PageTitle({ value, onChange }: PageTitleProps) {
  return (
    <textarea
      className="marloth-page-title"
      aria-label="Page title"
      value={value}
      rows={1}
      placeholder="Untitled"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
