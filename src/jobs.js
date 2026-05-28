const logger = require('./logger');
const cronParser = require('cron-parser');
const api = require('./api');
const filescan = require('./filescan');
const id3write = require('./id3write');

const HANDLERS = {
    'filescan': () => filescan.fastscan(false),
    'fullscan': () => filescan.fastscan(true),
    'id3write': () => id3write.run(),
};

async function requeueScan() {
    const pars = await api.getParameters();
    const cronRequeue = pars[0]?.cronRequeue;
    if (!cronRequeue) {
        logger.info('requeue: cronRequeue not configured, skipping');
        return;
    }
    const nextDate = cronParser.parseExpression(cronRequeue).next().toDate();
    const job = await api.createJob('filescan', nextDate);
    logger.info(`requeue: filescan scheduled at ${nextDate.toISOString()} [job_id: ${job.job_id}]`);
}

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
        await api.updateJob(job.job_id, 'done', 'done');
        if (job.name === 'filescan') {
            await requeueScan();
        }
    }
    catch(err) {
        logger.error(err, 'Job failed');
        await api.updateJob(job.job_id, 'error', err.message);
    }
}

module.exports = { run };
