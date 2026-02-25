/**
 * Types of annotations users can place on document pages.
 * Transmitted over WebSocket for real-time collaboration.
 */
export enum AnnotationType {
  /** Text highlight on a document region */
  HIGHLIGHT = 'highlight',

  /** Free-text comment anchored to a position */
  COMMENT = 'comment',

  /** Bookmark marker on a specific page */
  BOOKMARK = 'bookmark',
}
