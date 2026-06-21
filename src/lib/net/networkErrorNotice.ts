/**
 * Error copy for a failed network call. When the device is offline we reassure
 * the child that their saved games still work (the PWA plays them offline);
 * otherwise we fall back to a plain retry nudge.
 */
export function networkErrorNotice(online: boolean): string {
  return online
    ? "Something went wrong. Try again!"
    : "You're offline — but you can still play your saved games! 🎮";
}
