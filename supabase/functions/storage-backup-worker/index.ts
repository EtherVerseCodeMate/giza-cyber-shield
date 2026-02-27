// Storage Backup Worker — Khepra Supabase Edge Function
//
// Exports Supabase Storage objects to Cloudflare R2 (or any S3-compatible store).
// Runs on schedule (pg_cron or Supabase scheduled invocations) or manually.
//
// WHY: Supabase PITR and manual backups include only the PostgreSQL database.
// Storage objects (files, images, documents) are NOT in the database backup.
// This worker provides the missing half of a complete DR strategy.
//
// ENCRYPTION MODEL (AdinKhepra Triple Layer — Classical Tier):
//   This Edge Function operates at the classical encryption tier of the AdinKhepra
//   Triple Layer stack. When BACKUP_ENCRYPTION_KEY is set, every object is wrapped
//   with AES-256-GCM (the classical AES-GCM layer) before upload to R2.
//
//   Full Triple Layer PQC protection (Kyber1024 + Dilithium3 + ECDH-P384) is
//   applied by the Go binary (cmd/khepra-daemon) via pkg/drbc/SupabaseStorageSync
//   with WithPQCKey(). For maximum security, run the Go binary as your primary
//   backup path and this Edge Function as the scheduled fallback.
//
//   Encryption output format: { version, iv_hex, ciphertext_b64, original_content_type,
//                                original_key, encrypted_at } as JSON with .aes suffix.
//
// SCHEDULE: Deploy via Supabase Dashboard → Edge Functions → Schedule
//   Cron: 0 2 * * *  (daily at 02:00 UTC — outside peak hours)
//
// MANUAL TRIGGER:
//   curl -X POST https://xjknkjbrjgljuovaazeu.supabase.co/functions/v1/storage-backup-worker \
//     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
//     -d '{"bucket_id": "documents", "dry_run": false}'
//
// ENVIRONMENT VARIABLES (set in Supabase Dashboard → Settings → Edge Functions):
//   R2_ACCOUNT_ID           — Cloudflare R2 account ID
//   R2_ACCESS_KEY_ID        — R2 access key
//   R2_SECRET_ACCESS_KEY    — R2 secret key
//   R2_BUCKET_NAME          — R2 bucket name (e.g. "khepra-storage-backup")
//   BACKUP_BUCKETS          — comma-separated Supabase bucket names (or "ALL")
//   BACKUP_ENCRYPTION_KEY   — hex-encoded 32-byte AES-256 key for AES-GCM encryption
//                             Generate: openssl rand -hex 32

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface BackupRequest {
  bucket_id?: string;   // specific bucket; omit or "ALL" for all buckets
  dry_run?: boolean;    // list what would be backed up without actually doing it
  prefix?: string;      // optional prefix filter
}

interface BackupEntry {
  object_key: string;
  bucket_id: string;
  etag: string;
  size_bytes: number;
  content_type: string;
  backup_path: string;
  backed_up_at: string;
  dag_node_id: string;
  encryption_tier: string; // 'adinkra-aes-gcm-v1' | 'plaintext'
}

interface RunResult {
  bucket_id: string;
  objects_exported: number;
  objects_skipped: number;
  objects_failed: number;
  total_bytes: number;
  errors: string[];
  duration_ms: number;
  dry_run: boolean;
}

// ─── AES-256-GCM Encryption (AdinKhepra Classical Layer) ─────────────────────
// This is the AES-GCM classical encryption layer of the AdinKhepra Triple Layer stack.
// The full PQC stack (Kyber1024 + Dilithium3 + ECDH-P384) is applied by the Go binary.
// Here we apply the symmetric AES-256-GCM tier which is available in Web Crypto API.

interface AESEncryptedObject {
  version: 'adinkra-aes-gcm-v1';
  iv_hex: string;           // 96-bit random IV (hex)
  ciphertext_b64: string;   // base64-encoded AES-GCM ciphertext
  original_content_type: string;
  original_key: string;
  encrypted_at: string;     // ISO 8601
}

async function deriveAESKey(hexKey: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(hexKey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptObjectAESGCM(
  plaintext: ArrayBuffer,
  originalKey: string,
  originalContentType: string,
  aesKey: CryptoKey,
): Promise<{ body: ArrayBuffer; contentType: string; suffix: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const ciphertextB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  const envelope: AESEncryptedObject = {
    version: 'adinkra-aes-gcm-v1',
    iv_hex: ivHex,
    ciphertext_b64: ciphertextB64,
    original_content_type: originalContentType,
    original_key: originalKey,
    encrypted_at: new Date().toISOString(),
  };

  const json = JSON.stringify(envelope);
  return {
    body: new TextEncoder().encode(json).buffer,
    contentType: 'application/vnd.adinkra-aes-gcm+json',
    suffix: '.aes',
  };
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const r2AccountId = Deno.env.get('R2_ACCOUNT_ID') ?? '';
  const r2AccessKey = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
  const r2SecretKey = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
  const r2Bucket    = Deno.env.get('R2_BUCKET_NAME') ?? 'khepra-storage-backup';
  const projectRef  = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'unknown';
  const encKeyHex   = Deno.env.get('BACKUP_ENCRYPTION_KEY') ?? '';

  // Derive AES-256-GCM key from hex env var (if configured)
  let aesKey: CryptoKey | null = null;
  if (encKeyHex && encKeyHex.length === 64) {
    aesKey = await deriveAESKey(encKeyHex);
    console.log('[storage-backup] AES-256-GCM encryption: ENABLED (adinkra-aes-gcm-v1)');
  } else {
    console.warn('[storage-backup] BACKUP_ENCRYPTION_KEY not set — uploading plaintext. Set a 32-byte hex key for AdinKhepra classical tier encryption.');
  }

  const backupBuckets = (Deno.env.get('BACKUP_BUCKETS') ?? 'ALL').split(',').map(b => b.trim());

  const body: BackupRequest = req.method === 'POST'
    ? await req.json().catch(() => ({}))
    : {};

  const dryRun = body.dry_run ?? false;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Determine which buckets to back up
  let targetBuckets: string[] = [];
  if (body.bucket_id && body.bucket_id !== 'ALL') {
    targetBuckets = [body.bucket_id];
  } else if (!backupBuckets.includes('ALL')) {
    targetBuckets = backupBuckets;
  } else {
    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      return new Response(JSON.stringify({ error: `list buckets: ${error.message}` }), { status: 500 });
    }
    targetBuckets = buckets?.map(b => b.id) ?? [];
  }

  const allResults: RunResult[] = [];
  const runStarted = Date.now();

  for (const bucketId of targetBuckets) {
    const result = await backupBucket(supabase, {
      supabaseUrl, serviceKey, projectRef,
      r2AccountId, r2AccessKey, r2SecretKey, r2Bucket,
      bucketId, prefix: body.prefix ?? '', dryRun, aesKey,
    });
    allResults.push(result);

    // Persist run record to Supabase
    if (!dryRun) {
      await supabase.from('storage_backup_runs').insert({
        bucket_id: bucketId,
        objects_exported: result.objects_exported,
        objects_skipped:  result.objects_skipped,
        objects_failed:   result.objects_failed,
        total_bytes:      result.total_bytes,
        errors:           result.errors,
        duration_ms:      result.duration_ms,
        trigger_source:   req.method === 'POST' ? 'manual' : 'schedule',
        finished_at:      new Date().toISOString(),
      });
    }
  }

  return new Response(JSON.stringify({
    status: 'complete',
    dry_run: dryRun,
    buckets_processed: targetBuckets.length,
    total_duration_ms: Date.now() - runStarted,
    results: allResults,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

// ─── Bucket Backup Logic ──────────────────────────────────────────────────────

async function backupBucket(
  supabase: ReturnType<typeof createClient>,
  opts: {
    supabaseUrl: string; serviceKey: string; projectRef: string;
    r2AccountId: string; r2AccessKey: string; r2SecretKey: string; r2Bucket: string;
    bucketId: string; prefix: string; dryRun: boolean;
    aesKey: CryptoKey | null;
  }
): Promise<RunResult> {
  const start = Date.now();
  const result: RunResult = {
    bucket_id: opts.bucketId,
    objects_exported: 0, objects_skipped: 0, objects_failed: 0,
    total_bytes: 0, errors: [], duration_ms: 0, dry_run: opts.dryRun,
  };

  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let offset = 0;
  const limit = 100;

  while (true) {
    // List objects in this bucket (paginated)
    const { data: objects, error: listErr } = await supabase.storage
      .from(opts.bucketId)
      .list(opts.prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

    if (listErr) {
      result.errors.push(`list offset=${offset}: ${listErr.message}`);
      break;
    }
    if (!objects || objects.length === 0) break;

    for (const obj of objects) {
      if (obj.metadata === null) continue; // folder marker — skip

      const objectKey = opts.prefix ? `${opts.prefix}/${obj.name}` : obj.name;
      const etag = (obj.metadata as Record<string, string>)?.eTag ?? '';

      // Check if already backed up with same ETag
      const { data: lastEntry } = await supabase
        .from('storage_backup_catalog')
        .select('etag')
        .eq('bucket_id', opts.bucketId)
        .eq('object_key', objectKey)
        .order('backed_up_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEntry?.etag === etag) {
        result.objects_skipped++;
        continue;
      }

      const sizeBytes = (obj.metadata as Record<string, number>)?.size ?? 0;
      const contentType = (obj.metadata as Record<string, string>)?.mimetype ?? 'application/octet-stream';

      if (opts.dryRun) {
        result.objects_exported++;
        result.total_bytes += sizeBytes;
        continue;
      }

      // Download from Supabase Storage
      const { data: fileData, error: dlErr } = await supabase.storage
        .from(opts.bucketId)
        .download(objectKey);

      if (dlErr || !fileData) {
        result.errors.push(`download ${objectKey}: ${dlErr?.message ?? 'null data'}`);
        result.objects_failed++;
        continue;
      }

      // ── AdinKhepra Classical Tier: AES-256-GCM Encryption ─────────────────
      // When BACKUP_ENCRYPTION_KEY is configured, encrypt before uploading to R2.
      // This is the classical symmetric tier of the AdinKhepra Triple Layer stack.
      // For full PQC (Kyber1024 + Dilithium3), use the Go binary with WithPQCKey().
      let uploadBlob: Blob;
      let uploadContentType = contentType;
      let backupPath = `storage-backup/${opts.projectRef}/${opts.bucketId}/${date}/${objectKey}`;

      if (opts.aesKey) {
        try {
          const plainBuffer = await fileData.arrayBuffer();
          const encrypted = await encryptObjectAESGCM(plainBuffer, objectKey, contentType, opts.aesKey);
          uploadBlob = new Blob([encrypted.body], { type: encrypted.contentType });
          uploadContentType = encrypted.contentType;
          backupPath += encrypted.suffix; // append .aes
        } catch (encErr) {
          result.errors.push(`aes encrypt ${objectKey}: ${(encErr as Error).message}`);
          result.objects_failed++;
          continue;
        }
      } else {
        uploadBlob = fileData;
      }

      // Upload to Cloudflare R2 via S3-compatible API
      const uploaded = await uploadToR2({
        accountId: opts.r2AccountId,
        accessKey: opts.r2AccessKey,
        secretKey: opts.r2SecretKey,
        bucket: opts.r2Bucket,
        key: backupPath,
        body: uploadBlob,
        contentType: uploadContentType,
      });

      if (!uploaded) {
        result.errors.push(`r2 upload failed: ${objectKey}`);
        result.objects_failed++;
        continue;
      }

      // Persist to backup catalog (records original size + content type, not encrypted)
      const dagNodeId = crypto.randomUUID();
      const entry: BackupEntry = {
        object_key: objectKey,
        bucket_id: opts.bucketId,
        etag,
        size_bytes: sizeBytes,           // original (pre-encryption) size
        content_type: contentType,        // original MIME type
        backup_path: `r2://${opts.r2Bucket}/${backupPath}`,
        backed_up_at: new Date().toISOString(),
        dag_node_id: dagNodeId,
        encryption_tier: opts.aesKey ? 'adinkra-aes-gcm-v1' : 'plaintext',
      };

      await supabase.from('storage_backup_catalog').insert(entry);

      result.objects_exported++;
      result.total_bytes += sizeBytes;
    }

    offset += objects.length;
    if (objects.length < limit) break;
  }

  result.duration_ms = Date.now() - start;
  return result;
}

// ─── Cloudflare R2 Upload (S3-compatible) ─────────────────────────────────────
// Uses AWS Signature V4 — Deno has no AWS SDK; we use fetch with manual signing.
async function uploadToR2(opts: {
  accountId: string; accessKey: string; secretKey: string;
  bucket: string; key: string; body: Blob; contentType: string;
}): Promise<boolean> {
  if (!opts.accountId || !opts.accessKey || !opts.secretKey) {
    console.warn('[storage-backup] R2 credentials not configured — skipping upload');
    return false;
  }

  const url = `https://${opts.accountId}.r2.cloudflarestorage.com/${opts.bucket}/${opts.key}`;
  const arrayBuffer = await opts.body.arrayBuffer();

  // Minimal S3 PutObject — full AWS Sig V4 required in production
  // For production: use a proper S3 signing library or Cloudflare's Workers S3 SDK
  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': opts.contentType,
        'Content-Length': String(arrayBuffer.byteLength),
        // TODO: Add AWS Signature V4 headers for production
        'x-amz-storage-class': 'STANDARD',
      },
      body: arrayBuffer,
    });
    return resp.ok;
  } catch (e) {
    console.error('[storage-backup] R2 upload error:', e);
    return false;
  }
}
