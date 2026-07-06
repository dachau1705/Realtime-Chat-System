/**
 * Escape special HTML characters to prevent XSS attacks.
 * @param str The raw input string to escape
 * @returns The HTML-escaped string
 */
export function escapeHTML(str: string): string {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
