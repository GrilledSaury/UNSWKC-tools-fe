import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: { adapter: adapter() },
  preprocess: vitePreprocess(),
  // onwarn: (warning, handler) => {
  //   if (warning.code === 'a11y-click-events-have-key-events') return
  //   handler(warning)
  // }
}
export default config
