import { AboutSection } from "@/components/sections/home/AboutSection";
import { FeaturedProjects } from "@/components/sections/home/FeaturedProjects";
import { Hero } from "@/components/sections/home/Hero";
import { ServicesOverview } from "@/components/sections/home/ServicesOverview";
import { Testimonials } from "@/components/sections/home/Testimonials";

// What the company does (with the self-building 3D house) → what it offers → its work → who it is → what clients say.
// The site footer closes every page with the contact call to action and details.
export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesOverview />
      <FeaturedProjects />
      <AboutSection />
      <Testimonials />
    </>
  );
}
