const NodeID3 = require('node-id3').Promise;
const logger = require('./logger');
const api = require('./api');

// Deduce il mime dell'immagine dai magic bytes (la cover arriva senza mime, solo byte).
function sniffImageMime(buffer) {
    if (!buffer || buffer.length < 4) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
    return 'image/jpeg';
}

function buildTags(row) {
    const tags = {};
    if (row.title    != null) { tags.title       = row.title; }
    if (row.album    != null) { tags.album       = row.album; }
    if (row.artist   != null) { tags.artist      = row.artist; }
    if (row.year     != null) { tags.year        = String(row.year); }
    if (row.genre    != null) { tags.genre       = row.genre; }
    if (row.track_nr != null) { tags.trackNumber = String(row.track_nr); }
    if (row.disc_nr  != null) { tags.partOfSet   = String(row.disc_nr); }
    return tags;
}

async function run() {
    const pending = await api.getPendingTags();
    if (!pending.length) {
        logger.info('No pending ID3 writes.');
        return;
    }
    logger.info(`Writing ID3 tags for ${pending.length} songs...`);
    for (const entry of pending) {
        const { song_id } = entry;
        try {
            const fullpath = await api.getSongPath(song_id);
            const tags = buildTags(entry);
            // La cover arriva già nella lista pending (base64): la usiamo, niente ri-download.
            if (entry.cover) {
                const imageBuffer = Buffer.from(entry.cover, 'base64');
                tags.image = {
                    mime: sniffImageMime(imageBuffer),
                    type: { id: 3, name: 'front cover' },
                    description: '',
                    imageBuffer,
                };
            }
            await NodeID3.update(tags, fullpath);
            // delete condizionale: se l'utente ha risalvato il brano mentre scrivevamo,
            // la riga (più recente) resta pending e verrà scritta al prossimo giro
            await api.deleteTag(song_id, entry.updated_at);
            logger.trace(`ID3 written: ${fullpath}`);
        }
        catch(err) {
            logger.error(err, `ID3 write failed for song_id=${song_id}`);
            await api.setTagError(song_id);
        }
    }
    logger.info('ID3 write done.');
}

module.exports = { run };
