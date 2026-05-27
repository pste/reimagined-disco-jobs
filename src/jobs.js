const logger = require('./logger');
const api = require('./api');
const filescan = require('./filescan');

const HANDLERS = {
    'filescan': () => filescan.fastscan(false),
    'fullscan': () => filescan.fastscan(true),
};

async function run() {
    const job = await api.claimNextJob();
    if (!job) {
        logger.info('No pending jobs.');
        return;
    }
    logger.info(`Executing job [${job.job_id}] ${job.name}`);
    const handler = HANDLERS[job.name];
    if (!handler) {
        logger.warn(`Unknown job type: ${job.name}`);
        await api.updateJob(job.job_id, 'error', `Unknown job type: ${job.name}`);
        return;
    }
    try {
        await handler();
        await api.updateJob(job.job_id, 'done');
    }
    catch(err) {
        logger.error(err, 'Job failed');
        await api.updateJob(job.job_id, 'error', err.message);
    }
}

module.exports = { run };
