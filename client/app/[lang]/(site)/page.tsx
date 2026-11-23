import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { AboutSection } from "@/components/sections/home/AboutSection";
import { FeaturedProjects } from "@/components/sections/home/FeaturedProjects";
import { Hero } from "@/components/sections/home/Hero";
import { ServicesOverview } from "@/components/sections/home/ServicesOverview";
import { Slider } from "@/components/sections/home/Slider";
import { Testimonials } from "@/components/sections/home/Testimonials";
import { getLocale, getT } from "@/i18n/server";
import { getPageSeo, getSettings, getSlides, getTestimonials } from "@/lib/public-api";
import { contractorJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { routeMetadata } from "@/lib/seo/route";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT("meta");
  // The home page record's title already names the company, so it is used without the suffix.
  return routeMetadata({ path: "/", title: t("site.title"), absoluteTitle: true, seo: await getPageSeo("home", locale) });
}

// What the company does (with the self-building 3D house) → the slider (when the admin added
// slides) → what it offers → its work → who it is → what clients say.
// The site footer closes every page with the contact call to action and details.
export default async function HomePage() {
  const locale = await getLocale();
  const [slides, testimonials, settings] = await Promise.all([getSlides(locale), getTestimonials(locale), getSettings(locale)]);
  return (
    <>
      <JsonLd data={[websiteJsonLd(settings, locale), contractorJsonLd(settings, locale)]} />
      <Hero />
      {/* Below the opening (decision Q-20), so its images load lazily rather than competing with the hero. */}
      {slides.length > 0 && <Slider slides={slides} />}
      <ServicesOverview />
      <FeaturedProjects />
      <AboutSection />
      <Testimonials items={testimonials} />
    </>
  );
}
