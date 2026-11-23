import { TagManager } from "@/components/analytics/TagManager";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getLocale } from "@/i18n/server";
import { getNavigation, getSettings } from "@/lib/public-api";

export default async function SiteLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  // Cached reads (lib/public-api.ts): the menus are in the first HTML; null falls back to built-in links.
  const [menus, settings] = await Promise.all([getNavigation(locale), getSettings(locale)]);
  const analytics = settings.gtmContainerId !== "";
  return (
    <>
      <SiteHeader menus={menus} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter menus={menus} analytics={analytics} />
      {/* Public pages only: the admin lives outside this layout. Both render nothing without a container ID. */}
      <ConsentBanner enabled={analytics} />
      <TagManager containerId={settings.gtmContainerId} />
    </>
  );
}
