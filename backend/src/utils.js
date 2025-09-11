// Funções utilitárias para backend BolaoSCA

/**
 * Retorna paginação padronizada a partir do request
 */
export function getPagination(req, defaultPageSize = 30, maxPageSize = 100) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(req.query.pageSize) || defaultPageSize));
    const offset = (page - 1) * pageSize;
    return { page, pageSize, offset };
}

/**
 * Executa uma query e retorna rows, tratando erros
 */
export async function safeQuery(pool, sql, params = []) {
    try {
        const { rows } = await pool.query(sql, params);
        return rows;
    } catch (err) {
        console.error('Erro ao executar query:', err);
        throw err;
    }
}

// Para importação nomeada
// ...nenhuma exportação duplicada...

// Sanitiza texto simples removendo tags perigosas e scripts básicos
import sanitizeHtml from 'sanitize-html';
export function sanitizeText(str) {
    if (!str) return '';
    return sanitizeHtml(String(str), {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard'
    }).trim();
}

// Verificação aprofundada de imagem (decode) usando sharp
export async function verifyImageIntegrity(filePath) {
    try {
        const sharpMod = await import('sharp');
        const sharp = sharpMod.default || sharpMod;
        const meta = await sharp(filePath).metadata();
        // Limites simples para evitar zip bombs: dimensões muito grandes
        if (!meta.width || !meta.height) return false;
        if (meta.width > 8000 || meta.height > 8000) return false;
        return true;
    } catch (e) {
        return false;
    }
}

// Le magic bytes para validar imagem (PNG, JPG, GIF) – simples, extensível
export async function verifyImageSignature(filePath) {
    return new Promise((resolve, reject) => {
        import('fs').then(fsMod => {
            const fs = fsMod.default || fsMod;
            fs.open(filePath, 'r', (err, fd) => {
                if (err) return reject(err);
                const buf = Buffer.alloc(12);
                fs.read(fd, buf, 0, 12, 0, (err2) => {
                    fs.close(fd, ()=>{});
                    if (err2) return reject(err2);
                    const png = buf.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]));
                    const jpg = buf[0] === 0xFF && buf[1] === 0xD8; // JPEG SOI
                    const gif = buf.slice(0,3).toString('ascii') === 'GIF';
                    resolve(png || jpg || gif);
                });
            });
        }).catch(reject);
    });
}
