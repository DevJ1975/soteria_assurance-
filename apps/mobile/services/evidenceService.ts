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
  const fileName = `${Date.now()}_${input.title.replace(/[^a-z0-9]+/gi, '_')}.jpg`;

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
      draft.mimeType = isImage ? 'image/jpeg' : 'application/octet-stream';
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
  await uploadEvidence(row.tenantId, row.auditId, row.fileName, blob, {
    contentType: row.mimeType,
  });
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
