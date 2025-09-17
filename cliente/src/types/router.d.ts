// src/types/router.d.ts
import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    guestOnly?: boolean;
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    requiresVerifiedEmail?: boolean; // default: true en tus guards
    title?: string;
  }
}
