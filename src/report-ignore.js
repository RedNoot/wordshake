// Errors AppReporter should never send: they aren't WordShake's.
// WordShake loads no Google scripts, so a failed apis.google.com/js/api.js is something on the device
// (a school filter or a Google extension) adding it to the page. Kept narrow: our own scripts failing still report.
export const REPORT_IGNORE = [/^LoadError: script failed to load: apis\.google\.com\//];
