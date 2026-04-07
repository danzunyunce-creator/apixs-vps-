import { Request, Response, NextFunction } from 'express';

const IP_LIMITS = new Map<string, { count: number, resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 Minutes
const MAX_REQUESTS = 500; // 500 Requests per window

// Whitelist for local development - never rate limit loopback
const LOCAL_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1', 'localhost']);

/**
 * Unicorn Security Headers (Manual Helmet)
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;");
    next();
};

/**
 * Unicorn Rate Limiter (Enterprise-Grade)
 */
export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Whitelist localhost - never block local development or VPS loopback
    if (LOCAL_IPS.has(ip)) return next();
    
    const now = Date.now();
    
    let limitData = IP_LIMITS.get(ip);
    
    if (!limitData || now > limitData.resetAt) {
        limitData = { count: 1, resetAt: now + WINDOW_MS };
    } else {
        limitData.count++;
    }
    
    IP_LIMITS.set(ip, limitData);
    
    if (limitData.count > MAX_REQUESTS) {
        return res.status(429).json({ 
            error: 'Too Many Requests', 
            retryAfter: Math.ceil((limitData.resetAt - now) / 1000) 
        });
    }
    
    next();
};

/**
 * SSRF Guard (Server-Side Request Forgery)
 */
export const isSafeUrl = (url: string): boolean => {
    if (!url) return true;
    const lower = url.toLowerCase();
    
    // Block internal IP ranges and localhost
    const blockedRanges = [
        'localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.0.', '172.16.', '169.254.'
    ];
    
    return !blockedRanges.some(range => lower.includes(range));
};
