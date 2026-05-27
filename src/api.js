const logger = require('./logger');

const BASE_URL = process.env.API_URL;
const TOKEN = process.env.API_TOKEN;

async function _call(method, path, body) {
    const url = `${BASE_URL}${path}`;
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
        },
    };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    logger.trace(`${method} ${path}`);
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
}

async function claimNextJob() {
    return _call('POST', '/api/jobs/claim');
}

async function updateJob(job_id, status, result) {
    return _call('PATCH', `/api/jobs/${job_id}`, { status, result: result || null });
}

async function getFiles() {
    return _call('GET', '/api/scan/files');
}

async function getBasedir() {
    const data = await _call('GET', '/api/scan/basedir');
    return data.basedir;
}

async function upsertSong(fileinfo) {
    return _call('POST', '/api/scan/song', fileinfo);
}

async function removeSong(song_id) {
    return _call('DELETE', `/api/scan/song/${song_id}`);
}

async function cleanup() {
    return _call('POST', '/api/scan/cleanup');
}

async function getSongPath(song_id) {
    const data = await _call('GET', `/api/scan/song/${song_id}`);
    return data.fullpath;
}

async function getPendingTags() {
    return _call('GET', '/api/scan/id3/pending');
}

async function deleteTag(song_id) {
    return _call('DELETE', `/api/scan/id3/${song_id}`);
}

async function setTagError(song_id) {
    return _call('PATCH', `/api/scan/id3/${song_id}`);
}

module.exports = {
    claimNextJob,
    updateJob,
    getFiles,
    getBasedir,
    upsertSong,
    removeSong,
    cleanup,
    getSongPath,
    getPendingTags,
    deleteTag,
    setTagError,
};
