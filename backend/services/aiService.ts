import axios from 'axios';
import * as dbLayer from '../database';
import { CryptoProvider } from '../utils/cryptoProvider';

export class AIService {
    static async generateMetadata(title: string): Promise<{ title: string; description: string; tags: string }> {
        try {
            // 1. Get API Key & Prompt from DB
            const configObj = await this.getConfig();
            const apiKey = CryptoProvider.decrypt(configObj.openai_api_key);
            const promptTemplate = configObj.ai_prompt_template || 'Buat judul viral, deskripsi SEO, dan 10 hashtag untuk video ini: {title}';

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
        // Simple heuristic: Line 1 = Title, rest is desc/tags
        const lines = text.split('\n').filter(l => l.trim() !== '');
        
        // Very basic parsing for demo - in production use JSON response format
        let title = lines[0].replace(/Judul:|Title:/i, '').trim() || originalTitle;
        let description = lines.slice(1).join('\n').trim();
        let tags = '';

        const tagsMatch = text.match(/Hashtag:|Tags:|Tag:([\s\S]+)/i);
        if (tagsMatch) {
            tags = tagsMatch[1].trim();
        }

        return { title, description, tags };
    }
}
