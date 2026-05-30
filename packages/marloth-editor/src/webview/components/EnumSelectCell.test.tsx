import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { EnumSelectCell } from "./EnumSelectCell";

const columnDef = {
  key: "priority",
  name: "Priority",
  type: "enum" as const,
  enumId: "priority",
  options: ["Low", "High"],
};

describe("EnumSelectCell", () => {
  test("shows current value in native select", () => {
    render(<EnumSelectCell def={columnDef} value="High" onChange={async () => {}} />);

    const select = screen.getByRole("combobox", { name: "Priority" }) as HTMLSelectElement;
    expect(select.value).toBe("High");
    expect(select.className).toContain("marloth-enum-select");
  });

  test("change calls onChange with selected value", async () => {
    const onChange = mock(async () => {});

    render(<EnumSelectCell def={columnDef} value="High" onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Priority" }), {
      target: { value: "Low" },
    });
    expect(onChange).toHaveBeenCalledWith("Low");
  });

  test("disabled select cannot be interacted with", () => {
    render(<EnumSelectCell def={columnDef} value="High" disabled onChange={async () => {}} />);

    const select = screen.getByRole("combobox", { name: "Priority" }) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});
