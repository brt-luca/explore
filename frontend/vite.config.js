import { defineConfig } from 'vite'

const STRAVA_COOKIE = '_currentH=d3d3LnN0cmF2YS5jb20=; _strava4_session=da22bi574g4b5t9t1i2t61i9rlg65f4c; CookieConsent={stamp:%27F0gDVnZTs3L066FmCHTs1YLvuaJtcDl5ox1FxIBf/cF+Q1Py1ObbtQ==%27%2Cnecessary:true%2Cpreferences:false%2Cstatistics:false%2Cmarketing:false%2Cmethod:%27explicit%27%2Cver:2%2Cutc:1777322931594%2Cregion:%27it%27}; globalHeatmapAboutModal=true; xp_session_identifier=p933wgm4pia; _strava_CloudFront-Expires=1778713379000'

export default defineConfig({
  base: '/explore/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },

  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy Strava heatmap — aggiunge il cookie di sessione
      '/strava-proxy': {
        target: 'https://heatmap-external-a.strava.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/strava-proxy/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Cookie', STRAVA_COOKIE)
            proxyReq.setHeader('Referer', 'https://www.strava.com/heatmap')
            proxyReq.setHeader('Origin', 'https://www.strava.com')
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            proxyReq.setHeader('Accept', 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8')
            proxyReq.setHeader('Accept-Language', 'it-IT,it;q=0.9,en;q=0.8')
          })
        },
      },
    },
  },

  assetsInclude: ['**/*.pbf'],
})
