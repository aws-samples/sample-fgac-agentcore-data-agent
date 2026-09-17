// Feature: chatbot-frontend, Property 11: Message role distinction

import React from "react";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import MessageList from "@/app/components/MessageList";
import type { ChatMessage } from "@/app/types";

// Mock scrollIntoView since jsdom doesn't support it
window.HTMLElement.prototype.scrollIntoView = jest.fn();

/**
 * Arbitrary: generates a random alphanumeric string (1-30 chars).
 */
const arbContent = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-zA-Z0-9]{1,30}$/);

/**
 * Arbitrary: generates a random UUID-like string for message ids.
 */
const arbId = (): fc.Arbitrary<string> => fc.uuid();

/**
 * Arbitrary: generates a random ISO timestamp string.
 */
const arbTimestamp = (): fc.Arbitrary<string> =>
  fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }).map(
    (d) => d.toISOString()
  );

/**
 * Arbitrary: generates a ChatMessage with a specific role.
 */
const arbChatMessage = (
  role: "user" | "assistant"
): fc.Arbitrary<ChatMessage> =>
  fc.record({
    id: arbId(),
    role: fc.constant(role),
    content: arbContent(),
    timestamp: arbTimestamp(),
  });

/**
 * Arbitrary: generates a mixed-role message list (2-10 messages)
 * guaranteed to contain at least one user and one assistant message.
 */
const arbMixedMessages = (): fc.Arbitrary<ChatMessage[]> =>
  fc
    .tuple(
      arbChatMessage("user"),
      arbChatMessage("assistant"),
      fc.array(
        fc.oneof(arbChatMessage("user"), arbChatMessage("assistant")),
        { minLength: 0, maxLength: 8 }
      )
    )
    .map(([userMsg, assistantMsg, rest]) =>
      fc.shuffledSubarray([userMsg, assistantMsg, ...rest], {
        minLength: rest.length + 2,
        maxLength: rest.length + 2,
      })
    )
    .chain((shuffled) => shuffled);

// **Validates: Requirements 5.1**
describe("Property 11: Message role distinction", () => {
  it("user messages have class 'message-user' and assistant messages have class 'message-assistant', and classes are distinct", () => {
    fc.assert(
      fc.property(arbMixedMessages(), (messages) => {
        const onDataClick = jest.fn();
        const { unmount } = render(
          <MessageList
            messages={messages}
            streamingContent=""
            onDataClick={onDataClick}
          />
        );

        for (const msg of messages) {
          const el = screen.getByTestId(`message-${msg.id}`);

          if (msg.role === "user") {
            // User messages must have message-user class
            expect(el).toHaveClass("message-user");
            // User messages must NOT have message-assistant class
            expect(el).not.toHaveClass("message-assistant");
          } else {
            // Assistant messages must have message-assistant class
            expect(el).toHaveClass("message-assistant");
            // Assistant messages must NOT have message-user class
            expect(el).not.toHaveClass("message-user");
          }
        }

        unmount();
      }),
      { numRuns: 50 }
    );
  });
});
