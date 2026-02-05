/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@firebase/auth", "firebase"],
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:8000/:path*',
            },
        ];
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            undici: false,
        };
        return config;
    },
};

module.exports = nextConfig;
