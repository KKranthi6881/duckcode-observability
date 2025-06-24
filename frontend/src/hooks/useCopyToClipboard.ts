import { useState, useCallback } from 'react';

export const useCopyToClipboard = () => {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      console.log("Copied to clipboard");
      
      // Reset the copied status after 2 seconds
      setTimeout(() => {
        setCopiedText(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedText(text);
        setTimeout(() => {
          setCopiedText(null);
        }, 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  }, []);

  const isTextCopied = useCallback((text: string) => copiedText === text, [copiedText]);

  return {
    copyToClipboard,
    isTextCopied,
    copiedText
  };
}; 