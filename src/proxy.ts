import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
]);

// Service-to-service webhooks must never be touched by Clerk — they have their
// own signature verification (Inngest signing key, Svix for Clerk webhooks).
const isWebhookRoute = createRouteMatcher([
  "/api/inngest(.*)",
  "/api/webhooks/(.*)",
  "/api/unsubscribe/(.*)",
  "/api/track/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isWebhookRoute(req)) return;
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // App pages — skip static files, _next internals, and webhook endpoints
    "/((?!api/inngest|api/webhooks|api/unsubscribe|api/track|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API routes that DO need Clerk (everything under /api except webhooks/tracking)
    "/api/((?!inngest|webhooks|unsubscribe|track).*)",
    "/trpc/(.*)",
  ],
};
