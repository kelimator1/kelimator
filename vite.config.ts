import { defineConfig } from 'vite';

// Static, folder-servable production build (docs/04-architecture.md §3):
// relative asset URLs so dist/ works from any local folder.
export default defineConfig({
  base: './',
});
