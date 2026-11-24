-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "media_provider" AS ENUM ('CLOUDFLARE_IMAGES', 'CLOUDFLARE_STREAM', 'STATIC');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "media_category" AS ENUM ('exterior', 'interior', 'construction', 'team', 'uploads');

-- CreateEnum
CREATE TYPE "project_category" AS ENUM ('residential', 'apartments', 'commercial', 'hospitality', 'renovation');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('planning', 'in-progress', 'completed', 'on-hold');

-- CreateEnum
CREATE TYPE "inquiry_status" AS ENUM ('new', 'in-progress', 'resolved');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('NEW_INQUIRY');

-- CreateEnum
CREATE TYPE "activity_kind" AS ENUM ('project', 'inquiry', 'service', 'testimonial', 'team', 'media', 'settings', 'auth', 'page', 'navigation', 'slide', 'redirect');

-- CreateEnum
CREATE TYPE "page_kind" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "system_page_key" AS ENUM ('home', 'projects', 'services', 'about', 'contact');

-- CreateEnum
CREATE TYPE "block_type" AS ENUM ('heading', 'text', 'image', 'gallery', 'video', 'embed');

-- CreateEnum
CREATE TYPE "nav_location" AS ENUM ('HEADER', 'FOOTER');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "user_agent" VARCHAR(400),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "kind" "media_kind" NOT NULL DEFAULT 'IMAGE',
    "provider" "media_provider" NOT NULL,
    "provider_key" VARCHAR(300) NOT NULL,
    "status" "media_status" NOT NULL DEFAULT 'PENDING',
    "filename" VARCHAR(255) NOT NULL,
    "alt_ka" VARCHAR(300) NOT NULL,
    "alt_en" VARCHAR(300),
    "category" "media_category" NOT NULL DEFAULT 'uploads',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "duration_seconds" INTEGER,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title_ka" VARCHAR(120) NOT NULL,
    "title_en" VARCHAR(120),
    "summary_ka" VARCHAR(180) NOT NULL,
    "summary_en" VARCHAR(180),
    "description_ka" TEXT NOT NULL,
    "description_en" TEXT,
    "location_ka" VARCHAR(120) NOT NULL,
    "location_en" VARCHAR(120),
    "city_ka" VARCHAR(80) NOT NULL,
    "city_en" VARCHAR(80),
    "category" "project_category" NOT NULL,
    "status" "project_status" NOT NULL,
    "progress" SMALLINT NOT NULL,
    "start_date" DATE NOT NULL,
    "estimated_completion" DATE NOT NULL,
    "completion_date" DATE,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "architect" VARCHAR(120) NOT NULL DEFAULT '',
    "cover_id" UUID NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "seo_title_ka" VARCHAR(70) NOT NULL DEFAULT '',
    "seo_title_en" VARCHAR(70),
    "seo_description_ka" VARCHAR(200) NOT NULL DEFAULT '',
    "seo_description_en" VARCHAR(200),
    "og_image_id" UUID,
    "robots_index" BOOLEAN NOT NULL DEFAULT true,
    "robots_follow" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_images" (
    "project_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "project_images_pkey" PRIMARY KEY ("project_id","position")
);

-- CreateTable
CREATE TABLE "project_specs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "label_ka" VARCHAR(60) NOT NULL,
    "label_en" VARCHAR(60),
    "value_ka" VARCHAR(120) NOT NULL,
    "value_en" VARCHAR(120),

    CONSTRAINT "project_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title_ka" VARCHAR(80) NOT NULL,
    "title_en" VARCHAR(80),
    "summary_ka" VARCHAR(200) NOT NULL,
    "summary_en" VARCHAR(200),
    "description_ka" VARCHAR(2000) NOT NULL,
    "description_en" VARCHAR(2000),
    "features_ka" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features_en" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image_id" UUID NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "name_ka" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "role_ka" VARCHAR(100) NOT NULL,
    "role_en" VARCHAR(100),
    "bio_ka" VARCHAR(600) NOT NULL,
    "bio_en" VARCHAR(600),
    "photo_id" UUID NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "quote_ka" VARCHAR(400) NOT NULL,
    "quote_en" VARCHAR(400),
    "author_ka" VARCHAR(100) NOT NULL,
    "author_en" VARCHAR(100),
    "role_ka" VARCHAR(100) NOT NULL,
    "role_en" VARCHAR(100),
    "project_id" UUID,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40),
    "subject" VARCHAR(120) NOT NULL,
    "message" VARCHAR(5000) NOT NULL,
    "status" "inquiry_status" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_notes" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "kind" "activity_kind" NOT NULL,
    "message" VARCHAR(300) NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "company_name" VARCHAR(24) NOT NULL,
    "tagline_ka" VARCHAR(40) NOT NULL,
    "tagline_en" VARCHAR(40),
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "address_ka" VARCHAR(200) NOT NULL,
    "address_en" VARCHAR(200),
    "hours_ka" VARCHAR(100) NOT NULL,
    "hours_en" VARCHAR(100),
    "instagram_url" VARCHAR(300) NOT NULL DEFAULT '',
    "linkedin_url" VARCHAR(300) NOT NULL DEFAULT '',
    "facebook_url" VARCHAR(300) NOT NULL DEFAULT '',
    "whatsapp_number" VARCHAR(20) NOT NULL DEFAULT '',
    "messenger_username" VARCHAR(100) NOT NULL DEFAULT '',
    "map_url" VARCHAR(500) NOT NULL DEFAULT '',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "default_seo_description_ka" VARCHAR(300) NOT NULL DEFAULT '',
    "default_seo_description_en" VARCHAR(300),
    "default_og_image_id" UUID,
    "google_site_verification" VARCHAR(100) NOT NULL DEFAULT '',
    "gtm_container_id" VARCHAR(20) NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "kind" "page_kind" NOT NULL DEFAULT 'CUSTOM',
    "system_key" "system_page_key",
    "slug" VARCHAR(80) NOT NULL,
    "title_ka" VARCHAR(120) NOT NULL,
    "title_en" VARCHAR(120),
    "intro_ka" VARCHAR(400) NOT NULL DEFAULT '',
    "intro_en" VARCHAR(400),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "seo_title_ka" VARCHAR(70) NOT NULL DEFAULT '',
    "seo_title_en" VARCHAR(70),
    "seo_description_ka" VARCHAR(200) NOT NULL DEFAULT '',
    "seo_description_en" VARCHAR(200),
    "og_image_id" UUID,
    "robots_index" BOOLEAN NOT NULL DEFAULT true,
    "robots_follow" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" UUID NOT NULL,
    "page_id" UUID,
    "project_id" UUID,
    "position" SMALLINT NOT NULL,
    "type" "block_type" NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_block_media" (
    "block_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "content_block_media_pkey" PRIMARY KEY ("block_id","position")
);

-- CreateTable
CREATE TABLE "preview_tokens" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "target_type" VARCHAR(10) NOT NULL,
    "target_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preview_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_items" (
    "id" UUID NOT NULL,
    "location" "nav_location" NOT NULL,
    "label_ka" VARCHAR(40) NOT NULL,
    "label_en" VARCHAR(40),
    "page_id" UUID,
    "url" VARCHAR(500),
    "new_tab" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,

    CONSTRAINT "navigation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_slides" (
    "id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "heading_ka" VARCHAR(120) NOT NULL,
    "heading_en" VARCHAR(120),
    "text_ka" VARCHAR(300) NOT NULL DEFAULT '',
    "text_en" VARCHAR(300),
    "cta_label_ka" VARCHAR(40) NOT NULL DEFAULT '',
    "cta_label_en" VARCHAR(40),
    "cta_url" VARCHAR(500) NOT NULL DEFAULT '',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "home_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "from_path" VARCHAR(300) NOT NULL,
    "to_path" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_user_id_idx" ON "admin_sessions"("user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "media_assets_status_category_created_at_idx" ON "media_assets"("status", "category", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_assets_uploaded_by_id_idx" ON "media_assets"("uploaded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_provider_provider_key_key" ON "media_assets"("provider", "provider_key");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_cover_id_idx" ON "projects"("cover_id");

-- CreateIndex
CREATE INDEX "projects_og_image_id_idx" ON "projects"("og_image_id");

-- CreateIndex
CREATE INDEX "projects_is_published_updated_at_idx" ON "projects"("is_published", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "project_images_media_id_idx" ON "project_images"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_images_project_id_media_id_key" ON "project_images"("project_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_specs_project_id_position_key" ON "project_specs"("project_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_position_idx" ON "services"("position");

-- CreateIndex
CREATE INDEX "services_image_id_idx" ON "services"("image_id");

-- CreateIndex
CREATE INDEX "team_members_position_idx" ON "team_members"("position");

-- CreateIndex
CREATE INDEX "team_members_photo_id_idx" ON "team_members"("photo_id");

-- CreateIndex
CREATE INDEX "testimonials_published_created_at_idx" ON "testimonials"("published", "created_at" DESC);

-- CreateIndex
CREATE INDEX "testimonials_project_id_idx" ON "testimonials"("project_id");

-- CreateIndex
CREATE INDEX "inquiries_status_created_at_idx" ON "inquiries"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inquiries_created_at_idx" ON "inquiries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "inquiry_notes_inquiry_id_created_at_idx" ON "inquiry_notes"("inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_inquiry_id_idx" ON "notifications"("inquiry_id");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_log_actor_id_idx" ON "activity_log"("actor_id");

-- CreateIndex
CREATE INDEX "site_settings_default_og_image_id_idx" ON "site_settings"("default_og_image_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_system_key_key" ON "pages"("system_key");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_og_image_id_idx" ON "pages"("og_image_id");

-- CreateIndex
CREATE INDEX "content_blocks_page_id_position_idx" ON "content_blocks"("page_id", "position");

-- CreateIndex
CREATE INDEX "content_blocks_project_id_position_idx" ON "content_blocks"("project_id", "position");

-- CreateIndex
CREATE INDEX "content_block_media_media_id_idx" ON "content_block_media"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "preview_tokens_token_hash_key" ON "preview_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "preview_tokens_expires_at_idx" ON "preview_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "navigation_items_location_position_idx" ON "navigation_items"("location", "position");

-- CreateIndex
CREATE INDEX "navigation_items_page_id_idx" ON "navigation_items"("page_id");

-- CreateIndex
CREATE INDEX "home_slides_is_published_position_idx" ON "home_slides"("is_published", "position");

-- CreateIndex
CREATE INDEX "home_slides_image_id_idx" ON "home_slides"("image_id");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_from_path_key" ON "redirects"("from_path");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_cover_id_fkey" FOREIGN KEY ("cover_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_og_image_id_fkey" FOREIGN KEY ("og_image_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_specs" ADD CONSTRAINT "project_specs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_default_og_image_id_fkey" FOREIGN KEY ("default_og_image_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_og_image_id_fkey" FOREIGN KEY ("og_image_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_block_media" ADD CONSTRAINT "content_block_media_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_block_media" ADD CONSTRAINT "content_block_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_slides" ADD CONSTRAINT "home_slides_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-written: integrity rules Prisma can't express (docs/DATABASE_DESIGN.md §3) ───

ALTER TABLE "projects" ADD CONSTRAINT "projects_progress_range" CHECK (progress BETWEEN 0 AND 100);
ALTER TABLE "projects" ADD CONSTRAINT "projects_estimated_after_start" CHECK (estimated_completion >= start_date);
ALTER TABLE "projects" ADD CONSTRAINT "projects_completion_after_start" CHECK (completion_date IS NULL OR completion_date >= start_date);
ALTER TABLE "projects" ADD CONSTRAINT "projects_completed_requires_completion" CHECK (status <> 'completed' OR (completion_date IS NOT NULL AND progress = 100));
ALTER TABLE "projects" ADD CONSTRAINT "projects_slug_format" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "pages" ADD CONSTRAINT "pages_slug_format" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "pages" ADD CONSTRAINT "pages_system_consistency" CHECK ((kind = 'SYSTEM') = (system_key IS NOT NULL));
ALTER TABLE "pages" ADD CONSTRAINT "pages_system_published" CHECK (kind <> 'SYSTEM' OR is_published);
ALTER TABLE "services" ADD CONSTRAINT "services_slug_format" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "services" ADD CONSTRAINT "services_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "home_slides" ADD CONSTRAINT "home_slides_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "project_specs" ADD CONSTRAINT "project_specs_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "content_block_media" ADD CONSTRAINT "content_block_media_position_nonnegative" CHECK (position >= 0);
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_one_owner" CHECK (num_nonnulls(page_id, project_id) = 1);
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_one_target" CHECK (num_nonnulls(page_id, url) = 1);
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_url_format" CHECK (url IS NULL OR url ~ '^(/([^/].*)?|https://[^/[:space:]]+.*)$');
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_singleton" CHECK (id = 1);
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_whatsapp_format" CHECK (whatsapp_number = '' OR whatsapp_number ~ '^[0-9]{8,15}$');
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_messenger_format" CHECK (messenger_username ~ '^[A-Za-z0-9.]*$');
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_map_url_format" CHECK (map_url = '' OR map_url ~ '^https://');
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_gtm_format" CHECK (gtm_container_id = '' OR gtm_container_id ~ '^GTM-[A-Z0-9]+$');
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_verification_format" CHECK (google_site_verification ~ '^[A-Za-z0-9_-]*$');
ALTER TABLE "home_slides" ADD CONSTRAINT "home_slides_cta_complete" CHECK ((cta_label_ka = '') = (cta_url = ''));
ALTER TABLE "home_slides" ADD CONSTRAINT "home_slides_cta_url_format" CHECK (cta_url = '' OR cta_url ~ '^(/([^/].*)?|https://[^/[:space:]]+.*)$');
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_from_path_format" CHECK (from_path ~ '^/([^/].*)?$');
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_to_path_format" CHECK (to_path ~ '^/([^/].*)?$');
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_not_self" CHECK (from_path <> to_path);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_dimensions_positive" CHECK (width > 0 AND height > 0);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_bytes_nonnegative" CHECK (bytes >= 0);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_duration_positive" CHECK (duration_seconds IS NULL OR duration_seconds > 0);
ALTER TABLE "preview_tokens" ADD CONSTRAINT "preview_tokens_target_type" CHECK (target_type IN ('project', 'page'));

-- ─── Hand-written: baseline rows every environment starts with (§3.8–3.10) ───

INSERT INTO "site_settings" ("id", "company_name", "tagline_ka", "tagline_en", "email", "phone", "address_ka", "address_en", "hours_ka", "hours_en", "updated_at") VALUES (1, 'MANI DEVELOPMENT', 'კერძო სახლების მშენებლობა', 'Private house construction', 'info@manidevelopment.ge', '+995 32 200 14 14', 'ილია ჭავჭავაძის გამზ. 37მ, მე-5 სართული, Terminal, თბილისი', '37m Ilia Chavchavadze Ave, 5th floor, Terminal, Tbilisi', 'ორშ–პარ, 09:00–18:00', 'Mon–Fri, 09:00–18:00', now());

INSERT INTO "pages" ("id", "kind", "system_key", "slug", "title_ka", "title_en", "intro_ka", "intro_en", "is_published", "published_at", "seo_title_ka", "seo_title_en", "seo_description_ka", "seo_description_en", "updated_at") VALUES (gen_random_uuid(), 'SYSTEM', 'home', 'home', 'კერძო სახლები, დაგეგმილი და აშენებული ერთი გუნდის მიერ.', 'Private houses, designed and built by one team.', 'ციცაბო ქალაქური ნაკვეთებიდან ვენახებით დაფარულ ქედებამდე ვგეგმავთ, ვაპროექტებთ და ვაშენებთ საოჯახო სახლებს. პროექტის ერთი ხელმძღვანელი თქვენთან რჩება პირველი საძირკვლიდან ჩაბარებამდე.', 'From steep city plots to vineyard ridges, we plan, engineer and build family homes with one project lead who stays with you from the first footing to handover.', true, now(), 'MANI DEVELOPMENT — კერძო სახლების მშენებლობა', 'MANI DEVELOPMENT — Private House Construction', 'MANI DEVELOPMENT გეგმავს, აპროექტებს და აშენებს კერძო სახლებს მთელ საქართველოში — ერთი პასუხისმგებელი გუნდით, პირველი საძირკვლიდან ჩაბარებამდე.', 'MANI DEVELOPMENT plans, engineers and builds private houses across Georgia, with one accountable team from the first footing to handover.', now());
INSERT INTO "pages" ("id", "kind", "system_key", "slug", "title_ka", "title_en", "intro_ka", "intro_en", "is_published", "published_at", "seo_title_ka", "seo_title_en", "seo_description_ka", "seo_description_en", "updated_at") VALUES (gen_random_uuid(), 'SYSTEM', 'projects', 'projects', 'კერძო სახლები და ჩვენი სხვა ნამუშევრები', 'Private houses, and the rest of our work', 'საოჯახო სახლები და ვილები, ასევე მრავალბინიანი და საოფისე შენობები და რენოვაციის პროექტები, რომლებსაც ვაშენებთ. დასრულებული, მშენებარე და დაპროექტების ეტაპზე მყოფი.', 'Family houses and villas, alongside the apartment buildings, workplaces and renovations we also build. Completed, on site, and in design.', true, now(), 'პროექტები', 'Projects', 'კერძო სახლები, ასევე მრავალბინიანი, კომერციული და რენოვაციის პროექტები, რომლებიც MANI DEVELOPMENT-მა საქართველოს მასშტაბით ააშენა.', 'Private houses, plus apartment, commercial and renovation projects built by MANI DEVELOPMENT across Georgia.', now());
INSERT INTO "pages" ("id", "kind", "system_key", "slug", "title_ka", "title_en", "intro_ka", "intro_en", "is_published", "published_at", "seo_title_ka", "seo_title_en", "seo_description_ka", "seo_description_en", "updated_at") VALUES (gen_random_uuid(), 'SYSTEM', 'services', 'services', 'ყველაფერი, რაც საჭიროა, რომ თქვენი სახლი მიწიდან წამოიმართოს', 'Everything it takes to get your house out of the ground', 'დაგეგმვა, საინჟინრო პროექტირება და მშენებლობა ერთ ჭერქვეშ: ვინც თქვენს სახლს გეგმავს, სწორედ ის აშენებს მას.', 'Planning, engineering and construction under one roof, so the people who plan your house are the same people who build it.', true, now(), 'მომსახურება', 'Services', 'კერძო სახლების მშენებლობა, დაგეგმვა, კონსტრუქციული პროექტირება, რენოვაცია და პროექტის მართვა, ასევე მრავალბინიანი და კომერციული მშენებლობა.', 'Private house construction, planning, structural engineering, renovation and project management, plus apartment and commercial building. How a project runs, ways to work with us, and common questions.', now());
INSERT INTO "pages" ("id", "kind", "system_key", "slug", "title_ka", "title_en", "intro_ka", "intro_en", "is_published", "published_at", "seo_title_ka", "seo_title_en", "seo_description_ka", "seo_description_en", "updated_at") VALUES (gen_random_uuid(), 'SYSTEM', 'about', 'about', 'მშენებელი, რომელიც არქიტექტორის თვალით უყურებს საქმეს', 'A builder that thinks like an architect', 'MANI DEVELOPMENT ერთ მარტივ იდეაზე დაფუძნდა: შენობები უკეთესი გამოდის, როცა მათი დამპროექტებლები და მშენებლები ერთ მაგიდასთან სხედან.', 'MANI DEVELOPMENT was founded on a simple idea: buildings turn out better when the people who design them and the people who build them sit at the same table.', true, now(), 'ჩვენ შესახებ', 'About', 'MANI DEVELOPMENT-ის — კერძო სახლების დიზაინზე ორიენტირებული მშენებლის — ისტორია, ღირებულებები, სტანდარტები და გუნდი.', 'The story, values, standards and people behind MANI DEVELOPMENT, a design-led builder of private houses in Georgia.', now());
INSERT INTO "pages" ("id", "kind", "system_key", "slug", "title_ka", "title_en", "intro_ka", "intro_en", "is_published", "published_at", "seo_title_ka", "seo_title_en", "seo_description_ka", "seo_description_en", "updated_at") VALUES (gen_random_uuid(), 'SYSTEM', 'contact', 'contact', 'მოგვიყევით თქვენი ნაკვეთის შესახებ', 'Tell us about your site', 'ნაკვეთი, ესკიზი, ნახაზების კომპლექტი ან უბრალოდ შეკითხვა. ყველა წერილს ვკითხულობთ და, ჩვეულებრივ, ორი სამუშაო დღის განმავლობაში ვპასუხობთ.', 'A plot, a sketch, a set of drawings or just a question. We read every message and usually reply within two working days.', true, now(), 'კონტაქტი', 'Contact', 'დაიწყეთ პროექტი MANI DEVELOPMENT-თან: მოგვიყევით თქვენი ნაკვეთის, ესკიზის ან შეკითხვის შესახებ.', 'Start a project with MANI DEVELOPMENT: tell us about your site, sketch or question.', now());

INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'HEADER', 'მომსახურება', 'Services', "id", 0 FROM "pages" WHERE "system_key" = 'services';
INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'HEADER', 'პროექტები', 'Projects', "id", 1 FROM "pages" WHERE "system_key" = 'projects';
INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'HEADER', 'ჩვენ შესახებ', 'About', "id", 2 FROM "pages" WHERE "system_key" = 'about';
INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'FOOTER', 'მთავარი', 'Home', "id", 0 FROM "pages" WHERE "system_key" = 'home';
INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'FOOTER', 'მომსახურება', 'Services', "id", 1 FROM "pages" WHERE "system_key" = 'services';
INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'FOOTER', 'პროექტები', 'Projects', "id", 2 FROM "pages" WHERE "system_key" = 'projects';
INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'FOOTER', 'ჩვენ შესახებ', 'About', "id", 3 FROM "pages" WHERE "system_key" = 'about';
INSERT INTO "navigation_items" ("id", "location", "label_ka", "label_en", "page_id", "position") SELECT gen_random_uuid(), 'FOOTER', 'კონტაქტი', 'Contact', "id", 4 FROM "pages" WHERE "system_key" = 'contact';
