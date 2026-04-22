// api/health.js (Vercel serverless function)
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    service: 'gift-store-api',
    timestamp: new Date().toISOString(),
  });
};
