import crypto from 'crypto';
import config from '../config';

// The key should be 32 bytes for aes-256-gcm
// We use a fallback but STRONG alert to user to set this in .env
const ENCRYPTION_KEY = process.env.MASTER_ENCRYPTION_KEY || 'apixs_unicorn_default_key_32bytes_!!'; 
const IV_LENGTH = 16; 

export class CryptoProvider {
    /**
     * Encrypts text using AES-256-GCM
     */
    static encrypt(text: string): string {
        if (!text) return '';
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');
        
        // Format: iv:encrypted:authTag
        return `${iv.toString('hex')}:${encrypted}:${authTag}`;
    }

    /**
     * Decrypts text using AES-256-GCM
     */
    static decrypt(text: string): string {
        try {
            if (!text || !text.includes(':')) return text; // Probably not encrypted
            
            const [ivHex, encryptedHex, authTagHex] = text.split(':');
            if (!ivHex || !encryptedHex || !authTagHex) return text;

            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (e) {
            console.error('[CryptoProvider] Decryption failed. Returning original text.', (e as any).message);
            return text; 
        }
    }
}
