/**
 * Series publication workflow validation and helpers
 */

import {Series} from "../models/series";
import {SeriesPublicationStatus, isValidStatusTransition} from "../types/series-status";

/**
 * User role types (placeholder - should be synced with actual auth system)
 */
export enum UserRole {
  PRODUCER = 'producer',
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin'
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Check if a series has all required fields to be submitted for review
 * This is the single source of truth for series completeness validation
 * Matches the frontend SeriesValidationService.canSubmitForReview()
 */
export function canSubmitForReview(seriesData: any): ValidationResult {
  const errors: string[] = [];

  // Check current status allows submission
  if (seriesData.publicationStatus === SeriesPublicationStatus.IN_REVIEW) {
    errors.push('Series is already in review');
  }

  if (seriesData.publicationStatus === SeriesPublicationStatus.PUBLISHED) {
    errors.push('Published series cannot be resubmitted');
  }

  // Core series fields validation
  if (!seriesData.title || seriesData.title.trim() === '') {
    errors.push('Title is required');
  }

  if (!seriesData.description || seriesData.description.trim() === '') {
    errors.push('Description is required');
  }

  if (!seriesData.categories || seriesData.categories.length === 0) {
    errors.push('At least one category is required');
  }

  if (!seriesData.cover || !seriesData.cover.url) {
    errors.push('Cover image is required');
  }

  if (!seriesData.type) {
    errors.push('Series type is required');
  }

  // Series page completeness validation
  // Hero banner validation
  if (!seriesData.seriesPage?.hero || seriesData.seriesPage.hero.length === 0) {
    errors.push('Hero banner is required');
  }

  // Description section validation
  if (!seriesData.seriesPage?.description?.title || 
      !seriesData.seriesPage?.description?.description ||
      !seriesData.seriesPage?.description?.logo?.url) {
    errors.push('Series page description (title, description, and logo) is required');
  }

  // Social media validation - at least one social media link required
  if (!seriesData.seriesPage?.socialMedia || 
      !Object.values(seriesData.seriesPage.socialMedia).filter(val => Boolean(val)).length) {
    errors.push('At least one social media link is required');
  }

  // Seasons validation (for season-based series only)
  if (seriesData.type === 'season-based' && (!seriesData.seasons || seriesData.seasons.length === 0)) {
    errors.push('At least one season is required for season-based series');
  }

  // Episodes validation
  if (!seriesData.episodes || seriesData.episodes.length === 0) {
    errors.push('At least one episode is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Check if a user can approve a series
 * Placeholder for role-based access control
 */
export function canApprove(series: Partial<Series>, userRole: string): ValidationResult {
  const errors: string[] = [];

  // Only super admins can approve
  if (userRole !== UserRole.SUPER_ADMIN) {
    errors.push('Only super admins can approve series');
  }

  // Series must be in review
  if (series.publicationStatus !== SeriesPublicationStatus.IN_REVIEW) {
    errors.push('Only series in review can be approved');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Check if a user can reject a series
 * Placeholder for role-based access control
 */
export function canReject(series: Partial<Series>, userRole: string): ValidationResult {
  const errors: string[] = [];

  // Only super admins can reject
  if (userRole !== UserRole.SUPER_ADMIN) {
    errors.push('Only super admins can reject series');
  }

  // Series must be in review
  if (series.publicationStatus !== SeriesPublicationStatus.IN_REVIEW) {
    errors.push('Only series in review can be rejected');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Check if a user can hide a series
 */
export function canHide(series: Partial<Series>, userRole: string, userId: string): ValidationResult {
  const errors: string[] = [];

  // Producers can hide their own series, super admins can hide any
  if (userRole !== UserRole.SUPER_ADMIN && series.producerId !== userId) {
    errors.push('You can only hide your own series');
  }

  // Series must be published
  if (series.publicationStatus !== SeriesPublicationStatus.PUBLISHED) {
    errors.push('Only published series can be hidden');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Check if a user can resubmit a series
 */
export function canResubmit(series: Partial<Series>, userId: string): ValidationResult {
  const errors: string[] = [];

  // Must be the series owner
  if (series.producerId !== userId) {
    errors.push('You can only resubmit your own series');
  }

  // Must be in rejected or hidden status
  const allowedStatuses = [SeriesPublicationStatus.REJECTED, SeriesPublicationStatus.HIDDEN];
  if (!series.publicationStatus || !allowedStatuses.includes(series.publicationStatus)) {
    errors.push('Only rejected or hidden series can be resubmitted');
  }

  // Check if series meets submission requirements
  const submissionCheck = canSubmitForReview(series);
  if (!submissionCheck.valid) {
    errors.push(...(submissionCheck.errors || []));
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Check if a status transition is allowed for a user
 */
export function canTransitionStatus(
  series: Partial<Series>,
  targetStatus: SeriesPublicationStatus,
  userRole: string,
  userId: string
): ValidationResult {
  const errors: string[] = [];

  if (!series.publicationStatus) {
    errors.push('Series has no publication status');
    return { valid: false, errors };
  }

  // Check if transition is valid according to workflow rules
  if (!isValidStatusTransition(series.publicationStatus, targetStatus)) {
    errors.push(`Cannot transition from ${series.publicationStatus} to ${targetStatus}`);
  }

  // Check role-based permissions for specific transitions
  switch (targetStatus) {
    case SeriesPublicationStatus.IN_REVIEW:
      // Producers submitting/resubmitting
      if (series.producerId !== userId) {
        errors.push('You can only submit your own series');
      }
      const submitCheck = canSubmitForReview(series);
      if (!submitCheck.valid) {
        errors.push(...(submitCheck.errors || []));
      }
      break;

    case SeriesPublicationStatus.PUBLISHED:
      // Only super admins can publish
      const approveCheck = canApprove(series, userRole);
      if (!approveCheck.valid) {
        errors.push(...(approveCheck.errors || []));
      }
      break;

    case SeriesPublicationStatus.REJECTED:
      // Only super admins can reject
      const rejectCheck = canReject(series, userRole);
      if (!rejectCheck.valid) {
        errors.push(...(rejectCheck.errors || []));
      }
      break;

    case SeriesPublicationStatus.HIDDEN:
      // Producers or super admins can hide
      const hideCheck = canHide(series, userRole, userId);
      if (!hideCheck.valid) {
        errors.push(...(hideCheck.errors || []));
      }
      break;

    default:
      errors.push(`Unknown target status: ${targetStatus}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Get user role from user data (placeholder implementation)
 * TODO: Integrate with actual role system
 */
export function getUserRole(userData: any): UserRole {
  // Placeholder - should check actual role field in user document
  if (userData?.isSuperAdmin || userData?.role === 'super_admin') {
    return UserRole.SUPER_ADMIN;
  }
  if (userData?.role === 'admin') {
    return UserRole.ADMIN;
  }
  return UserRole.PRODUCER;
}

/**
 * Check if series is visible to public
 */
export function isPubliclyVisible(series: Partial<Series>): boolean {
  return series.publicationStatus === SeriesPublicationStatus.PUBLISHED;
}

/**
 * Check if series is visible to producer
 */
export function isVisibleToProducer(series: Partial<Series>, producerId: string): boolean {
  // Producers can see all their series regardless of status
  return series.producerId === producerId;
}

/**
 * Check if series is visible to admin/super admin
 */
export function isVisibleToAdmin(series: Partial<Series>): boolean {
  // Admins can see all series regardless of status
  return true;
}
