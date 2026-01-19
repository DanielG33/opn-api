/**
 * Series publication status types
 */

export enum SeriesPublicationStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  REJECTED = 'REJECTED'
}

export type SeriesStatus = SeriesPublicationStatus;

/**
 * Status transition rules
 */
export const STATUS_TRANSITIONS: Record<SeriesPublicationStatus, SeriesPublicationStatus[]> = {
  [SeriesPublicationStatus.DRAFT]: [SeriesPublicationStatus.IN_REVIEW],
  [SeriesPublicationStatus.IN_REVIEW]: [SeriesPublicationStatus.PUBLISHED, SeriesPublicationStatus.REJECTED],
  [SeriesPublicationStatus.PUBLISHED]: [SeriesPublicationStatus.HIDDEN],
  [SeriesPublicationStatus.HIDDEN]: [SeriesPublicationStatus.IN_REVIEW, SeriesPublicationStatus.PUBLISHED],
  [SeriesPublicationStatus.REJECTED]: [SeriesPublicationStatus.IN_REVIEW]
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(from: SeriesPublicationStatus, to: SeriesPublicationStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) || false;
}
