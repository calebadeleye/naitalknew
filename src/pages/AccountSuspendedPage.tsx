import React, { useEffect } from "react";
import { PauseCircle } from "lucide-react";

/**
 * Where visitors of a suspended hosted website land: ISPConfig redirects every
 * request on a suspended site here (see IspconfigWebsiteStatusService), with
 * the requested path appended — so this route answers /account-suspended/*.
 *
 * The people seeing it are the hosted client's own visitors, not NAI TALK's,
 * so it's deliberately neutral: no marketing navigation, no analytics, and
 * kept out of search engines.
 */
export function AccountSuspendedPage() {
  useEffect(() => {
    document.title = "Account Suspended";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-4 py-16 text-[#07111f]">
      <div className="w-full max-w-lg rounded-2xl border border-black/5 bg-white p-8 text-center shadow-[0_20px_60px_rgba(7,17,31,0.08)] sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <PauseCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-2xl font-black sm:text-3xl">This account has been suspended</h1>
        <p className="mt-4 text-base leading-7 text-[#596273]">
          The website you are trying to visit is temporarily unavailable.
        </p>
        <p className="mt-2 text-base leading-7 text-[#596273]">
          If you are the owner of this website, please contact your web host.
        </p>
        <p className="mt-8 border-t border-black/5 pt-6 text-sm text-[#596273]">
          Website owner?{" "}
          <a href="/client/login" className="font-bold text-[#3f7d12] underline">
            Sign in to your client area
          </a>{" "}
          to renew or see why.
        </p>
      </div>
    </main>
  );
}
