/**
 * Application-level metadata for sync/backup tracking.
 * - dirty: true when local state diverges from last saved snapshot
 * - pendingCount: mirrors inbox length for quick badge display
 * - lastBackupAt: null if never backed up
 */
export interface Meta {
  lastBackupAt: string | null; // ISO 8601
  dirty: boolean;
  pendingCount: number;
}
