"use client";

import { useState, useEffect } from "react";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import type { AuthUser } from "@/app/types";

export function useAuthUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        console.log("[useAuthUser] Fetching auth session and attributes...");
        const [session, attributes] = await Promise.all([
          fetchAuthSession(),
          fetchUserAttributes(),
        ]);

        console.log("[useAuthUser] Session tokens present:", !!session.tokens);
        console.log("[useAuthUser] Attributes:", Object.keys(attributes));

        if (cancelled) return;

        const accessToken = session.tokens?.accessToken?.toString() ?? "";
        const idToken = session.tokens?.idToken?.toString() ?? "";

        // Extract cognito:username from the access token payload
        const tokenPayload = session.tokens?.accessToken?.payload as Record<string, unknown> | undefined;
        const cognitoUsername = (tokenPayload?.username ?? tokenPayload?.["cognito:username"] ?? "") as string;

        const username =
          cognitoUsername || attributes.preferred_username || attributes.sub || "";
        const email = attributes.email ?? "";
        const sub = attributes.sub ?? "";
        const team = (attributes as Record<string, string>)["custom:team"] ?? "";

        const customAttributes: Record<string, string> = {};
        for (const [key, value] of Object.entries(attributes)) {
          if (key.startsWith("custom:") && value !== undefined) {
            customAttributes[key] = value;
          }
        }

        setUser({
          username,
          sub,
          email,
          team,
          customAttributes,
          accessToken,
          idToken,
        });
        console.log("[useAuthUser] User loaded:", username, email, team);
      } catch (err) {
        console.error("[useAuthUser] Failed to load user:", err);
        // Auth session not available — user stays null
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
