/**
 * Cross-platform clipboard utility that works on mobile and desktop browsers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try modern clipboard API first (works in secure contexts)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for mobile browsers and older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Prevent scrolling to bottom of page in MS Edge
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    textArea.setAttribute('readonly', '');
    
    document.body.appendChild(textArea);
    
    textArea.focus({ preventScroll: true });
    textArea.select();
    
    // Use execCommand for fallback
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Copy text with user feedback
 * Returns a promise that resolves when the operation is complete
 */
export async function copyWithFeedback(
  text: string,
  onSuccess?: () => void,
  onError?: (error: unknown) => void
): Promise<void> {
  try {
    const success = await copyToClipboard(text);
    if (success) {
      onSuccess?.();
    } else {
      throw new Error('Copy operation failed');
    }
  } catch (error) {
    onError?.(error);
  }
}
