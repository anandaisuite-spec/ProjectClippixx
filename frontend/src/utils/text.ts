/**
 * Text formatting helpers.
 */

/**
 * Capitalize the first letter of a string, leaving the rest unchanged.
 * Safely handles empty/whitespace values.
 *
 *   capitalizeFirst('jacky')  // 'Jacky'
 *   capitalizeFirst('there')  // 'There'
 *   capitalizeFirst('')       // ''
 */
export function capitalizeFirst(value: string | null | undefined): string {
    if (!value) return '';
    const trimmed = value.trimStart();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
