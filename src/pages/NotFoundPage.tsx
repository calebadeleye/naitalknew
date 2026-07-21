import { ArrowRight, Home, MessageCircle } from "lucide-react";
import { PublicPage } from "../shared/marketingWidgets";

/**
 * Branded catch-all for any URL App.tsx's route table doesn't recognize.
 * server.js resolves the same 404 status for these paths (see
 * src/seo/publicRoutes.mjs) so search engines see a real 404, not a soft
 * 200 that happens to render this component.
 */
export function NotFoundPage() {
  return (
    <PublicPage seoOverrides={{ title: "Page Not Found | NAI TALK", description: "The page you're looking for doesn't exist or may have moved." }}>
      <section className="pub-section">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <span className="pub-eyebrow">404</span>
          <h1 className="mt-4 text-4xl font-black text-[#07111f] sm:text-5xl">We can't find that page</h1>
          <p className="mt-4 text-base leading-7 text-[#596273]">
            The page you're looking for doesn't exist or may have moved. Try heading back home, or reach out if you think this is a mistake.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/" className="btn-primary justify-center">
              <Home className="h-4 w-4" />
              Back to homepage
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/contact" className="btn-outline-light justify-center">
              <MessageCircle className="h-4 w-4" />
              Contact us
            </a>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
