const SESSION_EXIT_TRANSITION = 'session-exit';
const AUTH_LAYOUT_SELECTOR = '[data-dwp-auth-layout]';
const DESTINATION_READY_TIMEOUT_MS = 1_500;

type SessionExitTransitionOptions = {
  endSession: () => Promise<void>;
  navigateToSignIn: () => void;
  reduceMotion: boolean;
};

function waitForDestination(): Promise<void> {
  if (document.querySelector(AUTH_LAYOUT_SELECTOR)) return Promise.resolve();

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.querySelector(AUTH_LAYOUT_SELECTOR)) finish();
    });
    const timeoutId = window.setTimeout(finish, DESTINATION_READY_TIMEOUT_MS);

    function finish() {
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve();
    }

    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (document.querySelector(AUTH_LAYOUT_SELECTOR)) finish();
  });
}

export async function exitSessionWithTransition({
  endSession,
  navigateToSignIn,
  reduceMotion,
}: SessionExitTransitionOptions): Promise<void> {
  let updateStarted = false;
  const updateView = async () => {
    updateStarted = true;
    try {
      await endSession();
    } catch {
      // AuthProvider still clears local state when the remote logout request fails.
    }
    navigateToSignIn();
    await waitForDestination();
  };

  if (reduceMotion || typeof document.startViewTransition !== 'function') {
    await updateView();
    return;
  }

  const root = document.documentElement;
  root.dataset.dwpTransition = SESSION_EXIT_TRANSITION;

  try {
    const transition = document.startViewTransition(updateView);
    await transition.finished;
  } catch {
    if (!updateStarted) await updateView();
  } finally {
    delete root.dataset.dwpTransition;
  }
}
