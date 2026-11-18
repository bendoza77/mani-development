import { Blueprint } from "@/components/3d/Blueprint";
import { Capabilities } from "@/components/sections/home/Capabilities";
import { FeaturedProjects } from "@/components/sections/home/FeaturedProjects";
import { Hero } from "@/components/sections/home/Hero";
import { Intro } from "@/components/sections/home/Intro";
import { Principles } from "@/components/sections/home/Principles";
import { ProcessSection } from "@/components/sections/home/ProcessSection";
import { Showcase } from "@/components/sections/home/Showcase";
import { Stats } from "@/components/sections/home/Stats";
import { Testimonials } from "@/components/sections/home/Testimonials";

export default function HomePage() {
  return (
    <>
      <Hero blueprint={<Blueprint className="size-full" />} />
      <Intro />
      <FeaturedProjects />
      <Showcase />
      <ProcessSection blueprint={<Blueprint className="size-full" label={false} />} />
      <Capabilities />
      <Stats />
      <Principles />
      <Testimonials />
    </>
  );
}
