// Feature: chatbot-frontend, Property 14: Streaming response renders incrementally
// Feature: chatbot-frontend, Property 15: Loading state round-trip

import React from "react";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import MessageList from "@/app/components/MessageList";
import ChatInput from "@/app/components/ChatInput";

// Mock scrollIntoView since jsdom doesn't support it
window.HTMLElement.prototype.scrollIntoView = jest.fn();

/**
 * Arbitrary: generates a non-empty alphanumeric string chunk (1-20 chars).
 */
const arbChunk = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

/**
 * Arbitrary: generates an array of 2-5 non-empty alphanumeric string chunks.
 */
const arbChunks = (): fc.Arbitrary<string[]> =>
  fc.array(arbChunk(), { minLength: 2, maxLength: 5 });

/**
 * Arbitrary: generates a random boolean sequence of 2-6 elements
 * representing loading state transitions.
 */
const arbBoolSequence = (): fc.Arbitrary<boolean[]> =>
  fc.array(fc.boolean(), { minLength: 2, maxLength: 6 });

// Feature: chatbot-frontend, Property 14: Streaming response renders incrementally
// **Validates: Requirements 5.6**
describe("Property 14: Streaming response renders incrementally", () => {
  it("for each prefix of chunks, the streaming-message element contains the concatenated text", () => {
    fc.assert(
      fc.property(arbChunks(), (chunks) => {
        const onDataClick = jest.fn();

        // For each prefix of chunks, render MessageList with the concatenated streamingContent
        for (let i = 1; i <= chunks.length; i++) {
          const prefix = chunks.slice(0, i).join("");

          const { unmount } = render(
            <MessageList
              messages={[]}
              streamingContent={prefix}
              onDataClick={onDataClick}
            />
          );

          const streamingEl = screen.getByTestId("streaming-message");
          expect(streamingEl).toBeInTheDocument();
          expect(streamingEl.textContent).toBe(prefix);

          unmount();
        }
      }),
      { numRuns: 50 }
    );
  });
});

// Feature: chatbot-frontend, Property 15: Loading state round-trip
// **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
describe("Property 15: Loading state round-trip", () => {
  it("send → loading → response: disabled/enabled states toggle correctly", () => {
    fc.assert(
      fc.property(arbBoolSequence(), (boolSeq) => {
        const onSend = jest.fn();

        // Start with isLoading=false
        const { rerender, unmount } = render(
          <ChatInput isLoading={false} onSend={onSend} />
        );

        // Verify initial active state
        expect(screen.getByTestId("chat-textarea")).not.toBeDisabled();
        expect(screen.getByTestId("send-button")).toHaveTextContent("Send");

        // Transition to loading
        rerender(<ChatInput isLoading={true} onSend={onSend} />);
        expect(screen.getByTestId("chat-textarea")).toBeDisabled();
        expect(screen.getByTestId("send-button")).toHaveTextContent("...");

        // Transition back to active
        rerender(<ChatInput isLoading={false} onSend={onSend} />);
        expect(screen.getByTestId("chat-textarea")).not.toBeDisabled();
        expect(screen.getByTestId("send-button")).toHaveTextContent("Send");

        // Now run through the random boolean sequence for additional transitions
        for (const isLoading of boolSeq) {
          rerender(<ChatInput isLoading={isLoading} onSend={onSend} />);

          if (isLoading) {
            expect(screen.getByTestId("chat-textarea")).toBeDisabled();
            expect(screen.getByTestId("send-button")).toHaveTextContent("...");
          } else {
            expect(screen.getByTestId("chat-textarea")).not.toBeDisabled();
            expect(screen.getByTestId("send-button")).toHaveTextContent("Send");
          }
        }

        unmount();
      }),
      { numRuns: 50 }
    );
  });
});
