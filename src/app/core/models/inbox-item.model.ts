/**
 * Quick-capture item sitting in the inbox before being
 * promoted to a full graph node.
 * - status stays "pending" until the user processes it
 */
export interface InboxItem {
  id: string;
  content: string;
  createdAt: string; // ISO 8601
  status: 'pending';
}
