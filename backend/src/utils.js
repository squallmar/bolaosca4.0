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

// Normaliza URLs de mídia (avatar/escudo) para caminhos relativos em /uploads
export function sanitizeMediaUrl(input, kind = 'avatar') {
    const AVATAR_DEFAULT = '/uploads/avatars/avatar_default.jpg';
    const ESCUDO_DEFAULT = '/uploads/escudos/_default.png';
    const ANUNCIO_DEFAULT = ESCUDO_DEFAULT; // pode ter um default específico no futuro
    const def = kind === 'escudo' ? ESCUDO_DEFAULT : (kind === 'anuncio' ? ANUNCIO_DEFAULT : AVATAR_DEFAULT);
    if (!input) return def;
    let u = String(input).trim();
    if (!u) return def;
    // Se vier concatenado com ';', pega a última parte
    if (u.includes(';')) {
        const parts = u.split(';').map(s => s.trim()).filter(Boolean);
        u = parts[parts.length - 1] || u;
    }
    // Se for URL do Cloudinary, retorna como está
    if (/^https?:\/\/.+cloudinary\.com\//i.test(u)) {
        return u;
    }
    // Se for absoluta mas não Cloudinary, extrai apenas o pathname
    try {
        if (/^https?:\/\//i.test(u)) {
            const url = new URL(u);
            u = url.pathname || u;
        }
    } catch {}
    // Se contiver '/uploads/', preserve a partir daí
    const idx = u.indexOf('/uploads/');
    if (idx >= 0) u = u.slice(idx);
    // Se já está em /uploads, garanta pasta correta para o tipo
    if (u.startsWith('/uploads/')) {
        const filename = u.split('/').pop() || '';
        if (!filename) return def;
        if (kind === 'escudo') return `/uploads/escudos/${filename}`;
        if (kind === 'anuncio') return `/uploads/anuncios/${filename}`;
        return `/uploads/avatars/${filename}`;
    }
    // Caso esteja apenas o filename
    const looksLikeFile = /\.[a-z0-9]{2,5}$/i.test(u);
    if (looksLikeFile) {
        if (kind === 'escudo') return `/uploads/escudos/${u.split('/').pop()}`;
        if (kind === 'anuncio') return `/uploads/anuncios/${u.split('/').pop()}`;
        return `/uploads/avatars/${u.split('/').pop()}`;
    }
    return def;
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
