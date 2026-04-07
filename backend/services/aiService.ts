import axios from 'axios';
import * as dbLayer from '../database';
import { CryptoProvider } from '../utils/cryptoProvider';

export class AIService {
    static async generateMetadata(title: string, tone: string = 'viral'): Promise<{ title: string; description: string; tags: string }> {
        try {
            // 1. Get API Key & Prompt from DB
            const configObj = await this.getConfig();
            const apiKey = CryptoProvider.decrypt(configObj.openai_api_key);
            
            let toneInstruction = 'Buat judul viral, deskripsi SEO, dan 10 hashtag';
            if (tone === 'professional') toneInstruction = 'Buat judul profesional, deskripsi mendalam yang informatif, dan tags relevan';
            else if (tone === 'clickbait') toneInstruction = 'Buat judul yang sangat memancing klik (clickbait), deskripsi penasaran, dan tags trending';
            else if (tone === 'educational') toneInstruction = 'Buat judul edukatif, deskripsi ringkasan materi, dan tags akademik';

            const promptTemplate = configObj.ai_prompt_template || `${toneInstruction} untuk video ini: {title}`;

            if (!apiKey) {
                throw new Error('OpenAI API Key belum di-set di Pengaturan.');
            }

            const prompt = promptTemplate.replace('{title}', title);

            // 2. Call OpenAI (GPT-4o / GPT-3.5)
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'Anda adalah pakar viral marketing dan SEO YouTube.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const content = response.data.choices[0].message.content;
            
            // 3. Simple Parsing (GPT usually returns structured text)
            // We assume GPT returns Title, Desc, and Tags. 
            // In a real product, we might use JSON Mode or stricter regex.
            return this.parseAIResponse(content, title);
        } catch (error: any) {
            console.error('[AIService] Failed to generate metadata:', error.response?.data || error.message);
            throw error;
        }
    }

    private static getConfig(): Promise<any> {
        return new Promise((resolve, reject) => {
            dbLayer.db.all(`SELECT key, value FROM app_config WHERE key IN ('openai_api_key', 'ai_prompt_template')`, [], (err, rows: any[]) => {
                if (err) return reject(err);
                const cfg: any = {};
                rows.forEach(r => { cfg[r.key] = r.value; });
                resolve(cfg);
            });
        });
    }

    private static parseAIResponse(text: string, originalTitle: string) {
        if (!text || text.trim().length < 10) {
            return { title: originalTitle, description: 'Stream AI Optimized', tags: '#live #streaming' };
        }

        // Improved parsing using multi-line matching
        let title = originalTitle;
        let description = '';
        let tags = '';

        // Extract Title: Look for "Title:", "Judul:", or first non-empty line
        const titleMatch = text.match(/(?:Judul|Title|Name|Nama):\s*(.*)/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim().replace(/["'*]/g, '');
        } else {
            const lines = text.split('\n').filter(l => l.trim() !== '');
            if (lines.length > 0) {
                title = lines[0].replace(/^(Title|Judul|Name|Nama):\s*/i, '').trim().replace(/["'*]/g, '');
            }
        }

        // Extract Tags: Look for "Tags:", "Hashtags:", "Hashtag:", etc.
        const tagsMatch = text.match(/(?:Tags|Hashtags|Hashtag|Kata Kunci):\s*([\s\S]+)/i);
        if (tagsMatch && tagsMatch[1]) {
            // Clean up tags: only keep words starting with # or words separated by commas/spaces
            const rawTags = tagsMatch[1].trim().split('\n')[0]; // only first line of matching
            tags = rawTags;
        }

        // Extract Description: Everything between Title and Tags, or the rest
        // We fallback to a cleaned version of the entire text if specialized blocks aren't found
        const descMatch = text.match(/(?:Deskripsi|Description|About):\s*([\s\S]+?)(?=(?:Tags|Hashtags|Hashtag|Kata Kunci):|$)/i);
        if (descMatch && descMatch[1]) {
            description = descMatch[1].trim();
        } else {
            // Heuristic: remove the title line and tags line(s)
            description = text.replace(title, '').replace(tags, '').trim();
        }

        // Final polishing
        if (title.length > 100) title = title.substring(0, 97) + '...';
        if (!description) description = `Live streaming: ${title}. Bergabunglah sekarang!`;

        return { 
            title: title || originalTitle, 
            description: description.substring(0, 5000), // YouTube limit
            tags: tags.substring(0, 500) // YouTube limit
        };
    }
}
