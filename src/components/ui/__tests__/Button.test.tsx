import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock Icon component
vi.mock("../Icon", () => ({
  default: ({ name, size }: any) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

import Button from "../Button";

describe("Button", () => {
  it("renders with label", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);

    fireEvent.click(screen.getByText("Click"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const handler = vi.fn();
    render(<Button onClick={handler} disabled>Click</Button>);

    const button = screen.getByText("Click");
    fireEvent.click(button);
    expect(handler).not.toHaveBeenCalled();
  });

  it("renders with disabled attribute", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText("Disabled")).toBeDisabled();
  });

  it("applies primary variant class by default", () => {
    render(<Button>Primary</Button>);
    const button = screen.getByText("Primary");
    expect(button.className).toContain("btn-primary");
  });

  it("applies secondary variant class", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByText("Secondary");
    expect(button.className).toContain("btn-secondary");
  });

  it("applies ghost variant class", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByText("Ghost");
    expect(button.className).toContain("btn-ghost");
  });

  it("applies danger variant class", () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByText("Danger");
    expect(button.className).toContain("btn-danger");
  });

  it("renders with icon", () => {
    render(<Button icon="plus">Add</Button>);
    expect(screen.getByTestId("icon-plus")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("applies md size class by default", () => {
    render(<Button>Medium</Button>);
    const button = screen.getByText("Medium");
    expect(button.className).toContain("btn-md");
  });

  it("applies sm size class", () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByText("Small");
    expect(button.className).toContain("btn-sm");
  });

  it("sets aria-label when only icon is provided", () => {
    render(<Button icon="plus" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "plus");
  });
});
