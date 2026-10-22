export const adminEnabled = () => process.env.CANVAS_ADMIN_ENABLED === '1'

export function isManagementPath(url = '') {
  const pathname = new URL(url, 'http://localhost').pathname
  return pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/skills/config-admin') || pathname.startsWith('/api/skills/admin')
}

export function managementGate(req, res, next) {
  if (!adminEnabled() && isManagementPath(req.url)) {
    res.statusCode = 404
    res.setHeader('Cache-Control', 'no-store')
    res.end('Not found')
    return
  }
  next()
}
