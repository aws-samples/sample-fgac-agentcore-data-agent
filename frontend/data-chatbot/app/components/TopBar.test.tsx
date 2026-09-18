import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopBar from "./TopBar";
import type { AuthUser } from "@/app/types";

function makeUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    username: "jdoe",
    email: "jdoe@example.com",
    team: "Team A",
    customAttributes: {},
    accessToken: "access-tok",
    idToken: "id-tok",
    ...overrides,
  };
}

describe("TopBar", () => {
  it("renders with data-testid topbar", () => {
    render(
      <TopBar user={makeUser()} onMenuToggle={jest.fn()} isMobile={false} />
    );
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
  });

  it("is fixed position and full width", () => {
    render(
      <TopBar user={makeUser()} onMenuToggle={jest.fn()} isMobile={false} />
    );
    const bar = screen.getByTestId("topbar");
    expect(bar).toHaveStyle({ position: "fixed", width: "100%" });
  });

  it("renders brand banner with app name", () => {
    render(
      <TopBar user={makeUser()} onMenuToggle={jest.fn()} isMobile={false} />
    );
    const banner = screen.getByTestId("brand-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText("FGAC Data Agent")).toBeInTheDocument();
  });

  it("renders account panel with username, email, and team badge", () => {
    render(
      <TopBar user={makeUser()} onMenuToggle={jest.fn()} isMobile={false} />
    );
    const panel = screen.getByTestId("account-panel");
    expect(panel).toBeInTheDocument();
    expect(screen.getByText("jdoe")).toBeInTheDocument();
    expect(screen.getByText("jdoe@example.com")).toBeInTheDocument();
    expect(screen.getByText("Team A")).toBeInTheDocument();
  });

  it("renders custom attributes", () => {
    const user = makeUser({
      customAttributes: { department: "Engineering", role: "Admin" },
    });
    render(
      <TopBar user={user} onMenuToggle={jest.fn()} isMobile={false} />
    );
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows hamburger menu on mobile", () => {
    render(
      <TopBar user={makeUser()} onMenuToggle={jest.fn()} isMobile={true} />
    );
    expect(screen.getByTestId("hamburger-menu")).toBeInTheDocument();
  });

  it("hides hamburger menu on desktop", () => {
    render(
      <TopBar user={makeUser()} onMenuToggle={jest.fn()} isMobile={false} />
    );
    expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
  });

  it("calls onMenuToggle when hamburger is clicked", async () => {
    const toggle = jest.fn();
    const user = userEvent.setup();
    render(
      <TopBar user={makeUser()} onMenuToggle={toggle} isMobile={true} />
    );
    await user.click(screen.getByTestId("hamburger-menu"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
