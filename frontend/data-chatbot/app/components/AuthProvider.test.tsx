import React from "react";
import { render, screen } from "@testing-library/react";
import AuthProvider from "./AuthProvider";

// Mock the Authenticator component from @aws-amplify/ui-react
jest.mock("@aws-amplify/ui-react", () => ({
  Authenticator: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="authenticator">{children}</div>
  ),
}));

describe("AuthProvider", () => {
  it("wraps children with Authenticator", () => {
    render(
      <AuthProvider>
        <div data-testid="child">Hello</div>
      </AuthProvider>
    );

    const authenticator = screen.getByTestId("authenticator");
    expect(authenticator).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(authenticator).toContainElement(screen.getByTestId("child"));
  });

  it("renders children only inside Authenticator", () => {
    render(
      <AuthProvider>
        <span>Protected Content</span>
      </AuthProvider>
    );

    const authenticator = screen.getByTestId("authenticator");
    expect(authenticator).toHaveTextContent("Protected Content");
  });
});
