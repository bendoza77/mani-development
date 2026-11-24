"use client";

import { api, ApiError, type MediaAsset } from "./api";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type UploadTicket = { id: string; uploadUrl: string; uploadMethod: "raw" | "multipart" };

async function dimensionsOf(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/**
 * Uploads one image: the server hands out a one-time upload address (Cloudflare, or the API
 * itself in local development), the browser sends the file there, then tells the server it's done.
 */
export async function uploadImage(file: File): Promise<MediaAsset> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError(400, "UNSUPPORTED_TYPE", `${file.name}: only JPEG, PNG, WebP or AVIF images.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError(400, "TOO_LARGE", `${file.name}: larger than 10 MB.`);
  }
  const size = await dimensionsOf(file).catch(() => {
    throw new ApiError(400, "UNREADABLE", `${file.name}: the image can't be read.`);
  });

  const ticket = await api<UploadTicket>("/api/admin/media/uploads", {
    method: "POST",
    body: { filename: file.name, mimeType: file.type, bytes: file.size },
  });

  let res: Response;
  try {
    if (ticket.uploadMethod === "multipart") {
      const form = new FormData();
      form.append("file", file);
      res = await fetch(ticket.uploadUrl, { method: "POST", body: form, credentials: "omit" });
    } else {
      res = await fetch(ticket.uploadUrl, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
        credentials: "include",
      });
    }
  } catch {
    throw new ApiError(0, "UPLOAD_FAILED", `${file.name}: upload failed (network).`);
  }
  if (!res.ok) throw new ApiError(res.status, "UPLOAD_FAILED", `${file.name}: upload failed (${res.status}).`);

  return api<MediaAsset>(`/api/admin/media/${ticket.id}/complete`, { method: "POST", body: size });
}
