/**
 * Evidence capture pipeline (DESIGN_DOC §5.5).
 *
 * Flow for a field photo:
 *   1. compress + resize the captured image (expo-image-manipulator),
 *   2. read the current GPS fix (expo-location) to geotag it,
 *   3. write an Evidence row to WatermelonDB FIRST (RULE 9, offline-first),
 *   4. queue a background upload to tenant-scoped Storage (RULE 2) and, on
 *      success, flip `uploadStatus` -> 'uploaded' and schedule the metadata
 *      sync. The UI never awaits the upload.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import type { EvidenceGeoLocation, EvidenceType } from '@soteria/core';
import { uploadEvidence, getDownloadUrl } from '@soteria/firebase';
import { database } from '../db';
import type { Evidence } from '../db/models/Evidence';
import { TABLE_EVIDENCE } from '../db/schema';
import { scheduleSync } from './syncManager';

/** Max edge length for a compressed evidence photo (keeps uploads small). */
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_COMPRESSION = 0.7;

/**
 * File-extension → MIME map for the capture formats the app produces
 * (expo-camera JPEGs, expo-av recordings, picked videos/PDFs). Storage rules
 * validate the declared content type, so uploads must never fall back to
 * application/octet-stream.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  m4a: 'audio/m4a',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  caf: 'audio/x-caf',
  '3gp': 'audio/3gpp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pdf: 'application/pdf',
};

/** Fallback extension + MIME per evidence type when the URI has no usable one. */
const DEFAULT_FORMAT_BY_TYPE: Record<EvidenceType, { extension: string; mimeType: string }> = {
  photo: { extension: 'jpg', mimeType: 'image/jpeg' },
  screenshot: { extension: 'jpg', mimeType: 'image/jpeg' },
  signature: { extension: 'png', mimeType: 'image/png' },
  audio: { extension: 'm4a', mimeType: 'audio/m4a' },
  video: { extension: 'mp4', mimeType: 'video/mp4' },
  document: { extension: 'pdf', mimeType: 'application/pdf' },
};

/**
 * Resolves the real file extension + MIME type for an evidence file from its
 * local URI, falling back to the evidence type's default format. Images are
 * always re-encoded to JPEG by {@link compressImage} before this is called.
 */
export function resolveEvidenceFormat(
  type: EvidenceType,
  uri: string,
): { extension: string; mimeType: string } {
  const match = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri);
  const extension = match?.[1]?.toLowerCase();
  if (extension !== undefined && MIME_BY_EXTENSION[extension] !== undefined) {
    return { extension, mimeType: MIME_BY_EXTENSION[extension] };
  }
  return DEFAULT_FORMAT_BY_TYPE[type];
}

export interface CaptureEvidenceInput {
  tenantId: string;
  auditId: string;
  capturedByAuditorId: string;
  /** Local file URI of the freshly captured asset (from expo-camera). */
  uri: string;
  type: EvidenceType;
  title: string;
  description: string;
  /** Clause numbers this evidence supports. */
  clauseNumbers: string[];
  /** When true, attempt to read and attach a GPS fix. */
  geotag: boolean;
}

/** Compress + downscale an image, returning the new local URI and byte size. */
async function compressImage(
  uri: string,
): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_DIMENSION } }],
    { compress: JPEG_COMPRESSION, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, width: result.width, height: result.height };
}

/** Read the current GPS fix, returning null when permission is denied. */
async function readGeoLocation(): Promise<EvidenceGeoLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    return null;
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 0,
  };
}

/** Resolve the byte size of a local file via a HEAD-less fetch->blob read. */
async function fileSize(uri: string): Promise<number> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob.size;
}

/**
 * Capture a piece of evidence: compress, geotag, persist locally, and queue the
 * background upload. Returns the created Evidence row immediately (before the
 * upload completes) so the UI updates instantly.
 */
export async function captureEvidence(input: CaptureEvidenceInput): Promise<Evidence> {
  const isImage = input.type === 'photo' || input.type === 'screenshot';
  const processed = isImage ? await compressImage(input.uri) : { uri: input.uri };
  const geo = input.geotag ? await readGeoLocation() : null;
  const size = await fileSize(processed.uri).catch(() => 0);
  // Storage rules validate declared content types, so name the file with its
  // REAL extension (a meeting recording is `.m4a` audio, not a `.jpg`).
  const format = resolveEvidenceFormat(input.type, processed.uri);
  const fileName = `${Date.now()}_${input.title.replace(/[^a-z0-9]+/gi, '_')}.${format.extension}`;

  const collection = database.collections.get<Evidence>(TABLE_EVIDENCE);
  let created!: Evidence;

  await database.write(async () => {
    created = await collection.create((draft) => {
      draft.remoteId = null;
      draft.auditId = input.auditId;
      draft.tenantId = input.tenantId;
      draft.type = input.type;
      draft.title = input.title;
      draft.description = input.description;
      draft.localUri = processed.uri;
      draft.fileUrl = '';
      draft.fileName = fileName;
      draft.fileSize = size;
      draft.mimeType = format.mimeType;
      draft.thumbnailUrl = null;
      draft.capturedAt = new Date();
      draft.capturedByAuditorId = input.capturedByAuditorId;
      draft.geoLocation = geo;
      draft.clauseNumbers = input.clauseNumbers;
      draft.findingIds = [];
      draft.isVerified = false;
      draft.uploadStatus = 'local_only';
      draft.syncStatus = 'pending';
      draft.localUpdatedAt = new Date();
    });
  });

  // Fire-and-forget background upload — UI never awaits this (RULE 9).
  void uploadEvidenceFile(created).catch(() => {
    void database.write(async () => {
      await created.update((draft) => {
        draft.uploadStatus = 'failed';
      });
    });
  });

  return created;
}

/**
 * Uploads an evidence row's local file to tenant-scoped Storage, then writes the
 * resulting download URL back to the row and queues its metadata sync.
 */
export async function uploadEvidenceFile(row: Evidence): Promise<void> {
  if (row.localUri === null) {
    return;
  }

  await database.write(async () => {
    await row.update((draft) => {
      draft.uploadStatus = 'uploading';
    });
  });

  const response = await fetch(row.localUri);
  const blob = await response.blob();
  try {
    await uploadEvidence(row.tenantId, row.auditId, row.fileName, blob, {
      contentType: row.mimeType,
    });
  } catch (error) {
    // Evidence objects are create-only in Storage rules, so a retry after a
    // crash-between-upload-and-DB-write is rejected as an overwrite. If the
    // object already exists remotely, treat the upload as already done.
    const url = await getDownloadUrl(row.tenantId, row.auditId, row.fileName).catch(() => null);
    if (url === null) {
      throw error;
    }
  }
  const url = await getDownloadUrl(row.tenantId, row.auditId, row.fileName);

  await database.write(async () => {
    await row.update((draft) => {
      draft.fileUrl = url;
      draft.uploadStatus = 'uploaded';
      // Metadata can now sync to Firestore (the URL is a real Storage URL).
      draft.syncStatus = 'pending';
      draft.localUpdatedAt = new Date();
    });
  });

  scheduleSync();
}

/**
 * Retries the upload for any evidence rows stuck in `failed`/`local_only` —
 * called when connectivity returns.
 */
export async function retryPendingUploads(): Promise<void> {
  const { Q } = await import('@nozbe/watermelondb');
  const rows = await database.collections
    .get<Evidence>(TABLE_EVIDENCE)
    .query(Q.where('upload_status', Q.oneOf(['failed', 'local_only'])))
    .fetch();
  for (const row of rows) {
    await uploadEvidenceFile(row).catch(() => {
      /* stays 'failed'; will retry on next connectivity event */
    });
  }
}
