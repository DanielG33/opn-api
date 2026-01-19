/**
 * Slug utility functions for series slugs
 */

const MAX_SLUG_LENGTH = 60;

/**
 * Normalizes a string into a URL-friendly slug
 * - Converts to lowercase
 * - Removes accents and diacritics
 * - Replaces spaces and underscores with hyphens
 * - Removes invalid characters
 * - Collapses multiple hyphens
 * - Trims hyphens from start/end
 * - Limits length to MAX_SLUG_LENGTH
 */
export function slugify(text: string): string {
  if (!text) return '';
  
  let slug = text
    .toString()
    .toLowerCase()
    .trim()
    // Remove accents/diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove invalid characters (keep only alphanumeric and hyphens)
    .replace(/[^a-z0-9-]/g, '')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Trim hyphens from start and end
    .replace(/^-+|-+$/g, '');

  // Limit length
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.substring(0, MAX_SLUG_LENGTH);
    // Remove trailing hyphen if length limit cuts in middle of word
    slug = slug.replace(/-+$/, '');
  }

  return slug;
}

/**
 * Validates a slug string
 * Returns true if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) return false;
  // Must match pattern: lowercase alphanumeric with hyphens, no leading/trailing hyphens
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugPattern.test(slug);
}

/**
 * Generates a slug with a numeric suffix
 * Example: "my-series" + 2 => "my-series-2"
 */
export function generateSlugWithSuffix(baseSlug: string, suffix: number): string {
  const suffixStr = `-${suffix}`;
  const maxBaseLength = MAX_SLUG_LENGTH - suffixStr.length;
  
  let base = baseSlug;
  if (base.length > maxBaseLength) {
    base = base.substring(0, maxBaseLength);
    base = base.replace(/-+$/, ''); // Remove trailing hyphen
  }
  
  return `${base}${suffixStr}`;
}

/**
 * Extracts base slug and numeric suffix from a slug
 * Returns { base: string, suffix: number | null }
 * Example: "my-series-2" => { base: "my-series", suffix: 2 }
 * Example: "my-series" => { base: "my-series", suffix: null }
 */
export function parseSlugSuffix(slug: string): { base: string; suffix: number | null } {
  const match = slug.match(/^(.+)-(\d+)$/);
  if (match) {
    return {
      base: match[1],
      suffix: parseInt(match[2], 10)
    };
  }
  return {
    base: slug,
    suffix: null
  };
}
