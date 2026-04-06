import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/order/', '/carrier-company/', '/dashboard/', '/register-login/'],
      },
    ],
    sitemap: 'https://chalan.pe/sitemap.xml',
  };
}
