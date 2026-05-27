const NodeID3 = require('node-id3').Promise;
const logger = require('./logger');
const api = require('./api');

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
            await NodeID3.update(tags, fullpath);
            await api.deleteTag(song_id);
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
