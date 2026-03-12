import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock constants
vi.mock("../../../lib/constants", () => ({
  STATUS_CONFIG: {
    "": { label: "\u2014", cls: "status-empty" },
    X: { label: "X", cls: "status-ok" },
    "!": { label: "!", cls: "status-alert" },
    NOK: { label: "NOK", cls: "status-nok" },
    i: { label: "i", cls: "status-info" },
    "N/A": { label: "N/A", cls: "status-na" },
  },
}));

import StatusCell from "../StatusCell";

describe("StatusCell", () => {
  it("renders empty state with dash label", () => {
    render(<StatusCell value="" onChange={vi.fn()} />);
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("renders with X status", () => {
    render(<StatusCell value="X" onChange={vi.fn()} />);
    expect(screen.getByText("X")).toBeInTheDocument();
  });

  it("renders with alert status", () => {
    render(<StatusCell value="!" onChange={vi.fn()} />);
    expect(screen.getByText("!")).toBeInTheDocument();
  });

  it("renders with NOK status", () => {
    render(<StatusCell value="NOK" onChange={vi.fn()} />);
    expect(screen.getByText("NOK")).toBeInTheDocument();
  });

  it("cycles through statuses on click", () => {
    const onChange = vi.fn();

    // Starting from empty "", next should be "X"
    render(<StatusCell value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("X");
  });

  it("cycles from X to !", () => {
    const onChange = vi.fn();
    render(<StatusCell value="X" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("!");
  });

  it("cycles from N/A back to empty", () => {
    const onChange = vi.fn();
    render(<StatusCell value="N/A" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not call onChange in readOnly mode", () => {
    const onChange = vi.fn();
    render(<StatusCell value="X" onChange={onChange} readOnly />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has correct aria-label", () => {
    render(<StatusCell value="X" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Statut : X");
  });

  it("has correct aria-label for empty state", () => {
    render(<StatusCell value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Statut : \u2014");
  });

  it("applies correct CSS class for status", () => {
    render(<StatusCell value="NOK" onChange={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("status-nok");
  });

  it("responds to keyboard Enter in normal mode", () => {
    const onChange = vi.fn();
    render(<StatusCell value="" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("X");
  });

  it("does not respond to keyboard in readOnly mode", () => {
    const onChange = vi.fn();
    render(<StatusCell value="" onChange={onChange} readOnly />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
