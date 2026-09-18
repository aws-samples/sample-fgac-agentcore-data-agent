import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import VisualizationDrawer from "./VisualizationDrawer";
import type { StructuredData } from "@/app/types";

const sampleData: StructuredData = {
  columns: ["id", "name", "score"],
  rows: [
    { id: 1, name: "Alice", score: 95 },
    { id: 2, name: "Bob", score: 87 },
  ],
};

const defaultProps = {
  isOpen: false,
  data: sampleData,
  onClose: jest.fn(),
  isMobile: false,
};

describe("VisualizationDrawer", () => {
  it("renders nothing when isOpen is false", () => {
    render(<VisualizationDrawer {...defaultProps} />);
    expect(screen.queryByTestId("visualization-drawer")).not.toBeInTheDocument();
  });

  it("renders the drawer when isOpen is true", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId("visualization-drawer")).toBeInTheDocument();
  });

  it("renders a close button", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId("drawer-close-button")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = jest.fn();
    render(<VisualizationDrawer {...defaultProps} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("drawer-close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders data as an HTML table with correct headers", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} />);
    const table = screen.getByTestId("drawer-table");
    expect(table).toBeInTheDocument();
    const headers = table.querySelectorAll("th");
    expect(headers).toHaveLength(3);
    expect(headers[0].textContent).toBe("id");
    expect(headers[1].textContent).toBe("name");
    expect(headers[2].textContent).toBe("score");
  });

  it("renders data rows correctly", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} />);
    const table = screen.getByTestId("drawer-table");
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    const firstRowCells = rows[0].querySelectorAll("td");
    expect(firstRowCells[0].textContent).toBe("1");
    expect(firstRowCells[1].textContent).toBe("Alice");
    expect(firstRowCells[2].textContent).toBe("95");
  });

  it("shows placeholder when data is null", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} data={null} />);
    expect(screen.queryByTestId("drawer-table")).not.toBeInTheDocument();
    expect(screen.getByText("No data to display")).toBeInTheDocument();
  });

  it("renders at 400px width on desktop", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} />);
    const drawer = screen.getByTestId("visualization-drawer");
    expect(drawer).toHaveStyle({ width: "400px" });
    expect(drawer).toHaveStyle({ position: "relative" });
  });

  it("renders at 100vw on mobile as overlay", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} isMobile={true} />);
    const drawer = screen.getByTestId("visualization-drawer");
    expect(drawer).toHaveStyle({ width: "100vw" });
    expect(drawer).toHaveStyle({ position: "fixed" });
  });

  it("renders backdrop on mobile", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} isMobile={true} />);
    expect(screen.getByTestId("drawer-backdrop")).toBeInTheDocument();
  });

  it("does not render backdrop on desktop", () => {
    render(<VisualizationDrawer {...defaultProps} isOpen={true} isMobile={false} />);
    expect(screen.queryByTestId("drawer-backdrop")).not.toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked on mobile", () => {
    const onClose = jest.fn();
    render(<VisualizationDrawer {...defaultProps} isOpen={true} isMobile={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("drawer-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("retains data across open/close cycles (parent manages data prop)", () => {
    const { rerender } = render(
      <VisualizationDrawer {...defaultProps} isOpen={true} data={sampleData} />
    );
    expect(screen.getByTestId("drawer-table")).toBeInTheDocument();

    // Close the drawer
    rerender(<VisualizationDrawer {...defaultProps} isOpen={false} data={sampleData} />);
    expect(screen.queryByTestId("visualization-drawer")).not.toBeInTheDocument();

    // Re-open — same data prop passed by parent
    rerender(<VisualizationDrawer {...defaultProps} isOpen={true} data={sampleData} />);
    expect(screen.getByTestId("drawer-table")).toBeInTheDocument();
    const headers = screen.getByTestId("drawer-table").querySelectorAll("th");
    expect(headers[0].textContent).toBe("id");
    expect(headers[1].textContent).toBe("name");
    expect(headers[2].textContent).toBe("score");
  });
});
