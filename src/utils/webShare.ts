// The Web Share API, where the browser offers it. Detected once: it does not
// appear or disappear at runtime.
export const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export async function share(data: ShareData): Promise<void> {
  try {
    await navigator.share(data);
  } catch (error) {
    // Dismissing the share sheet rejects with AbortError; nothing to report.
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error('Failed to share:', error);
    }
  }
}
