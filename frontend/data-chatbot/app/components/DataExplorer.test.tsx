import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataExplorer from "./DataExplorer";
import NotificationProvider from "./NotificationProvider";
import type { DatabaseNode } from "@/app/types";

// Helper to create a mock SchemaClient
function makeMockSchemaClient(
  result: DatabaseNode[] | Error = []
): { fetchSchema: jest.Mock } {
  const fetchSchema = jest.fn();
  if (result instanceof Error) {
    fetchSchema.mockRejectedValue(result);
  } else {
    fetchSchema.mockResolvedValue(result);
  }
  return { fetchSchema };
}

function renderWithNotifications(ui: React.ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const sampleDbs: DatabaseNode[] = [
  { name: "tickit2", tables: ["users", "venue", "sales_extended"] },
  { name: "analytics", tables: ["events", "metrics"] },
];

describe("DataExplorer", () => {
  it("renders with data-testid data-explorer", async () => {
    const client = makeMockSchemaClient(sampleDbs);
    renderWithNotifications(<DataExplorer schemaClient={client as any} />);
    expect(screen.getByTestId("data-explorer")).toBeInTheDocument();
    await waitFor(() => expect(client.fetchSchema).toHaveBeenCalledTimes(1));
  });

  it("shows loading state while fetching", () => {
    // Never-resolving promise to keep loading state
    const client = { fetchSchema: jest.fn(() => new Promise(() => {})) };
    renderWithNotifications(<DataExplorer schemaClient={client as any} />);
    expect(screen.getByTestId("schema-loading")).toBeInTheDocument();
  });

  it("fetches schema on mount and renders database nodes", async () => {
    const client = makeMockSchemaClient(sampleDbs);
    renderWithNotifications(<DataExplorer schemaClient={client as any} />);

    await waitFor(() => {
      expect(screen.getByTestId("db-node-tickit2")).toBeInTheDocument();
      expect(screen.getByTestId("db-node-analytics")).toBeInTheDocument();
    });
    expect(client.fetchSchema).toHaveBeenCalledTimes(1);
  });

  it("toggles table visibility on database node click", async () => {
    const client = makeMockSchemaClient(sampleDbs);
    const user = userEvent.setup();
    renderWithNotifications(<DataExplorer schemaClient={client as any} />);

    await waitFor(() => {
      expect(screen.getByTestId("db-node-tickit2")).toBeInTheDocument();
    });

    // Tables should not be visible initially
    expect(screen.queryByTestId("table-tickit2-users")).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByTestId("db-node-tickit2"));
    expect(screen.getByTestId("table-tickit2-users")).toBeInTheDocument();
    expect(screen.getByTestId("table-tickit2-venue")).toBeInTheDocument();
    expect(screen.getByTestId("table-tickit2-sales_extended")).toBeInTheDocument();

    // Click again to collapse
    await user.click(screen.getByTestId("db-node-tickit2"));
    expect(screen.queryByTestId("table-tickit2-users")).not.toBeInTheDocument();
  });

  it("renders refresh button", async () => {
    const client = makeMockSchemaClient(sampleDbs);
    renderWithNotifications(<DataExplorer schemaClient={client as any} />);
    expect(screen.getByTestId("refresh-button")).toBeInTheDocument();
    await waitFor(() => expect(client.fetchSchema).toHaveBeenCalled());
  });

  it("refresh clears and reloads schema", async () => {
    const client = makeMockSchemaClient(sampleDbs);
    const user = userEvent.setup();
    renderWithNotifications(<DataExplorer schemaClient={client as any} />);

    await waitFor(() => {
      expect(screen.getByTestId("db-node-tickit2")).toBeInTheDocument();
    });

    // Update mock to return different data on next call
    const updatedDbs: DatabaseNode[] = [{ name: "newdb", tables: ["t1"] }];
    client.fetchSchema.mockResolvedValue(updatedDbs);

    await user.click(screen.getByTestId("refresh-button"));

    await waitFor(() => {
      expect(screen.getByTestId("db-node-newdb")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("db-node-tickit2")).not.toBeInTheDocument();
    expect(client.fetchSchema).toHaveBeenCalledTimes(2);
  });

  it("routes errors to NotificationSystem", async () => {
    const client = makeMockSchemaClient(new Error("Lambda invoke error: timeout"));
    renderWithNotifications(<DataExplorer schemaClient={client as any} />);

    await waitFor(() => {
      expect(screen.getByText("Lambda invoke error: timeout")).toBeInTheDocument();
    });
  });
});
