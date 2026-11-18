export type ProjectCategory =
  | "residential"
  | "apartments"
  | "commercial"
  | "hospitality"
  | "renovation";

export type ProjectStatus = "planning" | "in-progress" | "completed" | "on-hold";

export type Spec = { id: string; label: string; value: string };

export type Project = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  location: string;
  city: string;
  category: ProjectCategory;
  status: ProjectStatus;
  /** 0–100, used for timeline and stage display. */
  progress: number;
  startDate: string;
  estimatedCompletion: string;
  completionDate?: string;
  featured: boolean;
  cover: string;
  gallery: string[];
  specs: Spec[];
  architect: string;
  updatedAt: string;
};

export type Service = {
  id: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  features: string[];
  visible: boolean;
};

export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role: string;
  project: string;
  published: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
  visible: boolean;
};

export type InquiryStatus = "new" | "in-progress" | "resolved";

export type InquiryNote = { id: string; text: string; createdAt: string };

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  notes: InquiryNote[];
};

export type MediaCategory = "exterior" | "interior" | "construction" | "team" | "uploads";

export type MediaAsset = {
  id: string;
  name: string;
  src: string;
  alt: string;
  category: MediaCategory;
  width: number;
  height: number;
  /** Bytes. Approximate for seeded assets. */
  size: number;
  createdAt: string;
};

export type ThemePreference = "light" | "dark" | "system";

export type Settings = {
  companyName: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  hours: string;
  instagram: string;
  linkedin: string;
  facebook: string;
  theme: ThemePreference;
};

export type ActivityItem = {
  id: string;
  kind: "project" | "inquiry" | "service" | "testimonial" | "team" | "media" | "settings";
  message: string;
  at: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  at: string;
  read: boolean;
};

export type DB = {
  version: number;
  projects: Project[];
  services: Service[];
  testimonials: Testimonial[];
  team: TeamMember[];
  inquiries: Inquiry[];
  media: MediaAsset[];
  settings: Settings;
  activity: ActivityItem[];
  notifications: Notification[];
};
