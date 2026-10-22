import type {IncomingMessage, ServerResponse} from 'node:http'
export function adminEnabled(): boolean
export function isManagementPath(url?: string): boolean
export function managementGate(req: IncomingMessage, res: ServerResponse, next: () => void): void
