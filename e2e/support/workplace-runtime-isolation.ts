import type { Page } from '@playwright/test';

/** Keep a reused Vite server's edits from resetting an in-flight mocked product command. */
export async function isolateWorkplaceDevelopmentUpdates(page: Page) {
  await page.routeWebSocket(/\/\?token=/, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (typeof message === 'string') {
        try {
          const payload = JSON.parse(message) as { type?: string };
          if (payload.type === 'update' || payload.type === 'full-reload') return;
        } catch {
          /* Non-JSON transport messages still pass through. */
        }
      }
      socket.send(message);
    });
  });
}
