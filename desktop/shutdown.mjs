export function createShutdownController({ close, quit }) {
  let exitAllowed = false;
  let shutdownPromise;

  return {
    get exitAllowed() {
      return exitAllowed;
    },
    request(event) {
      if (exitAllowed) return Promise.resolve();
      event?.preventDefault();
      if (!shutdownPromise) {
        shutdownPromise = Promise.resolve()
          .then(close)
          .finally(() => {
            exitAllowed = true;
            quit();
          });
      }
      return shutdownPromise;
    }
  };
}
