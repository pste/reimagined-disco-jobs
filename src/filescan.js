const fs = require('node:fs/promises');
const path = require('path');
const NodeID3 = require('node-id3').Promise;
const mm = require('music-metadata');
const logger = require('./logger');
const api = require('./api');

/*
SAMPLE: {
	"title":"The Glass Prison", // TIT2
	"artist":"Dream Theater",   // TPE1
	"album":"Six Degrees of Inner Turbulence [Disc 1]", // TALB
	"trackNumber":"01",         // TRCK
	"year":"2002",              // TYER
	"genre":"Progressive",      // TCON
	"partOfSet":"1/2"           // TPOS
    "image" : ""            // APIC
}
*/

async function readid3(filepath) {
    const options = {
        noRaw: true,
        include: ['TIT2','TPE1','TALB','TRCK','TYER','TCON','TPOS','APIC'],
    };
    logger.trace(`ID3 for ${filepath} ...`)
    let tags = {}
    try {
        tags = await NodeID3.read(filepath, options);
    }
    catch(err) {
        logger.error(err, "filescan readid3 error:");
    }
    return tags;
}

// node-id3 non espone il bitrate: lo legge music-metadata (header only, niente durata).
// Nei VBR il bitrate medio è un float → arrotondato, la colonna files.bitrate è int.
async function readBitrate(filepath) {
    try {
        const { format } = await mm.parseFile(filepath, { duration: false });
        return (format.bitrate != null) ? Math.round(format.bitrate) : null;
    }
    catch(err) {
        logger.error(err, "filescan readBitrate error:");
        return null;
    }
}

async function filedetails(basedir, parentpath, filename) {
    const fullpath = path.join(basedir, parentpath, filename);
    logger.trace(`Filedetails for ${fullpath} ...`)
    const stats = await fs.stat(fullpath);
    return {
        basedir,
        parentpath,
        filename,
        fullpath,
        atime: stats.atime,
        mtime: stats.mtime,
        ctime: stats.ctime,
        birthtime: stats.birthtime,
    };
}

/**
 * Scans the music folder and syncs the DB via API.
 * @param {boolean} forceFullScan - if true, re-reads ID3 tags for every file
 */
async function fastscan(forceFullScan) {
    // scan disk
    const folder = await api.getBasedir();
    logger.info(`Start scanning on ${folder} ...`);
    const flist = await fs.readdir(folder, { recursive: true, withFileTypes: true });
    logger.info(`FastScan found ${flist.length} files`);
    const filesdisk = [];
    for await (const f of flist) {
        if (f.isFile() && f.name.toLowerCase().endsWith('.mp3')) {
            const relpath = path.relative(folder, f.parentPath);
            const details = await filedetails(folder, relpath, f.name);
            filesdisk.push(details);
        }
    }
    logger.info(`FastScan found ${filesdisk.length} mp3 files`);

    // get db state via API
    logger.info(`Start scanning on db ...`);
    const filesdb = await api.getFiles();
    const filesdbMap = new Map(
        filesdb.map(f => [path.join(f.basedir, f.file_path, f.file_name), f])
    );
    logger.info(`FastScan found ${filesdb.length} db files`);

    // upsert new/changed items
    logger.info(`DB updating ...`);
    for await (const diskfile of filesdisk) {
        const dbfile = filesdbMap.get(diskfile.fullpath);
        // 'modified' in DB è max(mtime, ctime) (vedi updateSong lato API): se su disco è
        // cambiato (es: file riscritto da id3write) i tag vanno riletti anche nel fast scan.
        // Tolleranza 1s per assorbire le differenze di precisione tra filesystem e DB.
        const diskModified = Math.max(diskfile.mtime.getTime(), diskfile.ctime.getTime());
        const changed = dbfile && Math.abs(diskModified - new Date(dbfile.modified).getTime()) > 1000;
        if (forceFullScan === true || !dbfile || changed) {
            diskfile.tags = await readid3(diskfile.fullpath);
            diskfile.bitrate = await readBitrate(diskfile.fullpath);
            logger.trace(`DB UPDATE: ${diskfile.fullpath}`);
            await api.upsertSong(diskfile);
        }
        if (dbfile) {
            filesdbMap.delete(diskfile.fullpath);
        }
    }

    // remove items missing from filesystem
    logger.info(`DB cleaning ...`);
    for await (const dbfile of filesdbMap.values()) {
        logger.trace(dbfile, "DB REMOVE");
        await api.removeSong(dbfile.song_id);
    }
    await api.cleanup();
    logger.info(`DB done!`);
}

module.exports = { fastscan };
