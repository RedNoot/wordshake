// Errors AppReporter should never send: nothing in WordShake is broken when they happen.
// Firebase Auth fetches Google's sign-in helper (apis.google.com/js/api.js, then the gapi_iframes script it asks for)
// in the background on every page, and swallows the failure when a school filter, an extension or a dropped
// connection blocks it. Sign-in tries again when the teacher presses the button and says so if it still can't.
// Kept narrow: our own scripts failing still report.
export const REPORT_IGNORE = [/^LoadError: script failed to load: apis\.google\.com\//];
