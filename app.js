require('dotenv').config();
const logger = require('./src/logger');
const jobs = require('./src/jobs');

async function start() {
    logger.info('Jobs pod starting...');
    await jobs.run();
    logger.info('Jobs pod done.');
}

start().catch(err => {
    require('./src/logger').error(err, 'Fatal error');
    process.exit(1);
});
