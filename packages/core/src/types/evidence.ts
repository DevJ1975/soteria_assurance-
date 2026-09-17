import type { Timestamp } from './common';

export type EvidenceType =
  | 'photo'
  | 'video'
  | 'document'
  | 'screenshot'
  | 'audio'
  | 'signature';

export interface EvidenceGeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
  address?: string;
}

/**
 * A piece of audit evidence (photo, document, signature, etc.).
 */
export interface Evidence {
  id: string;
  auditId: string;
  tenantId: string;

  type: EvidenceType;
  title: string;
  description: string;

  // File Info
  /** Storage object path or signed URL. */
  fileUrl: string;
  fileName: string;
  /** Bytes. */
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;

  // Metadata
  capturedAt: Timestamp;
  capturedByAuditorId: string;

  /** Geolocation (for photos taken in the field). */
  geoLocation?: EvidenceGeoLocation;

  // References
  clauseNumbers: string[];
  findingIds: string[];

  // AI Analysis (for images)
  /** AI description of what's in the photo. */
  aiAnalysis?: string;
  aiHazardsDetected?: string[];

  /**
   * Lowercase hex SHA-256 of the captured bytes, recorded at upload.
   *
   * `undefined` means the row predates digest recording and its integrity
   * cannot be demonstrated — which is the honest answer, and better than
   * implying a verification the record cannot support.
   */
  contentSha256?: string;

  isVerified: boolean;
  verifiedAt?: Timestamp;
  verifiedByAuditorId?: string;
}
