-- AlterTable
ALTER TABLE "home_slides" ADD COLUMN     "cta_label_ru" VARCHAR(40),
ADD COLUMN     "heading_ru" VARCHAR(120),
ADD COLUMN     "text_ru" VARCHAR(300);

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "alt_ru" VARCHAR(300);

-- AlterTable
ALTER TABLE "navigation_items" ADD COLUMN     "label_ru" VARCHAR(40);

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "intro_ru" VARCHAR(400),
ADD COLUMN     "seo_description_ru" VARCHAR(200),
ADD COLUMN     "seo_title_ru" VARCHAR(70),
ADD COLUMN     "title_ru" VARCHAR(120);

-- AlterTable
ALTER TABLE "project_specs" ADD COLUMN     "label_ru" VARCHAR(60),
ADD COLUMN     "value_ru" VARCHAR(120);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "city_ru" VARCHAR(80),
ADD COLUMN     "description_ru" TEXT,
ADD COLUMN     "location_ru" VARCHAR(120),
ADD COLUMN     "seo_description_ru" VARCHAR(200),
ADD COLUMN     "seo_title_ru" VARCHAR(70),
ADD COLUMN     "summary_ru" VARCHAR(180),
ADD COLUMN     "title_ru" VARCHAR(120);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "description_ru" VARCHAR(2000),
ADD COLUMN     "features_ru" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "summary_ru" VARCHAR(200),
ADD COLUMN     "title_ru" VARCHAR(80);

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "address_ru" VARCHAR(200),
ADD COLUMN     "default_seo_description_ru" VARCHAR(300),
ADD COLUMN     "hours_ru" VARCHAR(100),
ADD COLUMN     "tagline_ru" VARCHAR(40);

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "bio_ru" VARCHAR(600),
ADD COLUMN     "name_ru" VARCHAR(100),
ADD COLUMN     "role_ru" VARCHAR(100);

-- AlterTable
ALTER TABLE "testimonials" ADD COLUMN     "author_ru" VARCHAR(100),
ADD COLUMN     "quote_ru" VARCHAR(400),
ADD COLUMN     "role_ru" VARCHAR(100);
