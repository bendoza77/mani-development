import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config/env.js";
import { AppError } from "../lib/errors.js";

/**
 * Where uploaded photos live (docs/INTEGRATIONS.md §1). The browser always uploads straight to
 * the URL returned by `createUpload`, then asks the API to mark the photo ready.
 *
 * - local: a folder on this machine, served by the API at /media. Development only (Render's
 *   disk is wiped on every deploy; config refuses it in production).
 * - cloudflare: Cloudflare Images Direct Creator Upload. The browser posts the file to a
 *   one-time Cloudflare URL, so photos never pass through our server.
 */
export type UploadTarget = { providerKey: string; uploadUrl: string; uploadMethod: "raw" | "multipart" };

export type MediaStorage = {
  provider: "STATIC" | "CLOUDFLARE_IMAGES";
  createUpload(mediaId: string, mimeType: ImageType): Promise<UploadTarget>;
  /** True once the file has actually arrived. */
  isUploaded(providerKey: string): Promise<boolean>;
  /** Saves bytes sent to the local upload URL (local storage only). */
  saveLocal?(providerKey: string, bytes: Buffer): Promise<void>;
};

export const LOCAL_MEDIA_PREFIX = "local/";

/** Image types accepted for upload, with their file extensions. */
export const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as const;
export type ImageType = keyof typeof IMAGE_TYPES;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function createLocalStorage(dir: string, apiPublicUrl: string): MediaStorage {
  const root = path.resolve(dir);
  const fileOf = (providerKey: string) => path.join(root, path.basename(providerKey.slice(LOCAL_MEDIA_PREFIX.length)));
  return {
    provider: "STATIC",
    async createUpload(mediaId, mimeType) {
      return {
        providerKey: `${LOCAL_MEDIA_PREFIX}${mediaId}.${IMAGE_TYPES[mimeType]}`,
        uploadUrl: `${apiPublicUrl}/api/admin/media/${mediaId}/file`,
        uploadMethod: "raw",
      };
    },
    async isUploaded(providerKey) {
      try {
        await access(fileOf(providerKey));
        return true;
      } catch {
        return false;
      }
    },
    async saveLocal(providerKey, bytes) {
      await mkdir(root, { recursive: true });
      await writeFile(fileOf(providerKey), bytes);
    },
  };
}

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const TIMEOUT_MS = 10_000;

type CloudflareResponse<T> = { success: boolean; result: T; errors?: { message: string }[] };

export function createCloudflareStorage(settings: { accountId: string; apiToken: string }): MediaStorage {
  const base = `${CLOUDFLARE_API}/accounts/${settings.accountId}/images`;
  const call = async <T>(url: string, init: RequestInit = {}): Promise<{ status: number; body?: CloudflareResponse<T> }> => {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${settings.apiToken}`, ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => undefined)) as CloudflareResponse<T> | undefined;
      return { status: res.status, body };
    } catch {
      throw new AppError(502, "UPSTREAM_UNAVAILABLE", "The image service did not respond. Please try again.");
    }
  };

  return {
    provider: "CLOUDFLARE_IMAGES",
    async createUpload(mediaId) {
      const form = new FormData();
      form.set("requireSignedURLs", "false");
      // Links the remote image back to our row for clean-up (INTEGRATIONS §1.4).
      form.set("metadata", JSON.stringify({ mediaId }));
      const { status, body } = await call<{ id: string; uploadURL: string }>(`${base}/v2/direct_upload`, {
        method: "POST",
        body: form,
      });
      if (status >= 400 || !body?.success) {
        throw new AppError(502, "UPSTREAM_UNAVAILABLE", "The image service refused the upload. Please try again.");
      }
      return { providerKey: body.result.id, uploadUrl: body.result.uploadURL, uploadMethod: "multipart" };
    },
    async isUploaded(providerKey) {
      // NOT VERIFIED against the live API yet (INTEGRATIONS §1.4): a direct-upload image is
      // assumed to report `draft: true` (or 404) until the file arrives.
      const { status, body } = await call<{ draft?: boolean }>(`${base}/v1/${encodeURIComponent(providerKey)}`);
      if (status === 404) return false;
      if (status >= 400 || !body?.success) {
        throw new AppError(502, "UPSTREAM_UNAVAILABLE", "The image service did not respond. Please try again.");
      }
      return body.result.draft !== true;
    },
  };
}

export function createMediaStorage(config: Config): MediaStorage {
  return config.media.provider === "cloudflare"
    ? createCloudflareStorage(config.media)
    : createLocalStorage(config.media.dir, config.apiPublicUrl);
}

/** The address browsers load a photo from. */
export function mediaUrl(
  asset: { provider: string; providerKey: string },
  config: Pick<Config, "apiPublicUrl" | "media"> & { cloudflareHash?: string },
): string {
  if (asset.provider === "CLOUDFLARE_IMAGES") {
    const hash = config.media.provider === "cloudflare" ? config.media.accountHash : (config.cloudflareHash ?? "");
    return `https://imagedelivery.net/${hash}/${asset.providerKey}/public`;
  }
  if (asset.providerKey.startsWith(LOCAL_MEDIA_PREFIX)) {
    return `${config.apiPublicUrl}/media/${asset.providerKey.slice(LOCAL_MEDIA_PREFIX.length)}`;
  }
  // Seed images shipped with the website (e.g. /images/house-1.jpg).
  return asset.providerKey;
}
