import { FreeSwitchClient, FreeSwitchEventData } from 'esl-lite'
import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express'
import { config } from './lib/config'
import { logNetworkAddresses, getNetworkAddresses } from './lib/network'
import { logger } from './utils/logger'
import {
  handleAllEvents,
  handleChannelCreate,
  handleChannelAnswer,
  handleChannelHangup,
  handleChannelDestroy,
  handleChannelBridge,
  handleChannelUnbridge,
  handleRecordStart,
  handleRecordStop,
  handleHeartbeat,
  handleShutdownRequested,
  handleStartup,
  handleReloadXml,
  handleBackgroundJob,
  handleApiResponse,
  handleChannelCallState,
  handleChannelState,
  handleChannelExecute,
  handleRequestParams,
  handleSofiaRegister,
} from './handlers/eventHandlers';

const app = express();
const httpServer = createServer(app);

let eslClient: FreeSwitchClient | null = null;

app.use(express.json());

app.get('/health', (req, res)=> {
  res.status(200).json({ status: 'ok', eslConnected: eslClient});
});

app.post('/commands/log', async (req: Request, res: Response, next: NextFunction) => {
  const { level = 'INFO', message } = req.body

  if (!message) {
    logger.warn('Received log command request without message body.');
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!eslClient) {
    logger.error('Cannot process log command: ESL client not connected.');
    return res.status(503).json({ error: 'ESL client not connected' });
  }

  try {
    // Sanitize level for safety, default to INFO
    const validLevels = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERR', 'CRIT', 'ALERT'];
    const safeLevel = validLevels.includes(String(level).toUpperCase())
      ? String(level).toUpperCase()
      : 'INFO';

    const sanitizedMessage = String(message).replace(/[\r\n]/g, ' '); // Basic sanitization
    const apiCmd = `log ${safeLevel} ${sanitizedMessage}`;

    logger.debug(`Executing ESL command: ${apiCmd}`);


    const apiResponse = await eslClient.bgapi(apiCmd, 5000); 

    logger.debug({ response: apiResponse }, `ESL command response received`);
    res.status(200).json({ success: true, response: apiResponse });

  } catch (error: any) {
    logger.error({ err: error }, 'Failed to execute ESL log command');
    res.status(500).json({ error: 'Failed to execute ESL command' });
  }
});


async function connectToEsl() {

  logger.info(`Attempting to connect to FreeSWITCH ESL at ${config.fsHost}:${config.fsPort}...`)
  logger.debug(`Using ESL Password: "${config.fsPassword}"`)


  eslClient = new FreeSwitchClient({
    host: config.fsHost,
    port: config.fsPort,
    password: config.fsPassword,
    logger,
  });



  // Channel lifecycle events
  eslClient.on('CHANNEL_CREATE', handleChannelCreate);
  eslClient.on('CHANNEL_ANSWER', handleChannelAnswer);
  eslClient.on('CHANNEL_HANGUP', handleChannelHangup);
  eslClient.on('CHANNEL_DESTROY', handleChannelDestroy);
  eslClient.on('CHANNEL_BRIDGE', handleChannelBridge);
  eslClient.on('CHANNEL_UNBRIDGE', handleChannelUnbridge);
  eslClient.on('CHANNEL_CALLSTATE', handleChannelCallState);
  eslClient.on('CHANNEL_STATE', handleChannelState);
  eslClient.on('CHANNEL_EXECUTE', handleChannelExecute);

  //sofia events

  eslClient.custom.on('sofia::register', handleSofiaRegister);
  //eslClient.custom.on('sofia::unregister', handleSofiaUnregister);
  //eslClient.custom.on('sofia::expire', handleSofiaExpire);

  //background API events
  eslClient.on('BACKGROUND_JOB', handleBackgroundJob);
  //eslClient.on('API', handleApiResponse);


  // Call recording events
  eslClient.on('RECORD_START', handleRecordStart);
  eslClient.on('RECORD_STOP', handleRecordStop);

  // System events
  //eslClient.on('HEARTBEAT', handleHeartbeat);
  eslClient.on('SHUTDOWN_REQUESTED', handleShutdownRequested);
  eslClient.on('STARTUP', handleStartup);
  eslClient.on('RELOADXML', handleReloadXml);
  eslClient.on('REQUEST_PARAMS', handleRequestParams);
  //eslClient.on('ALL', handleAllEvents);

}


// Start the connection process
connectToEsl()
.then(() => {
  const PORT = process.env.API_PORT || 8081;
  httpServer.listen(PORT, () => {
    logger.info(`HTTP server listening for commands on port ${PORT}`);
    console.log(`HTTP server listening for commands on port ${PORT}`);
    logNetworkAddresses(Number(PORT));
  });
})
.catch(err => {
  logger.fatal({ err }, 'Failed to start ESL application');
  process.exit(1);
});

//const PORT = 8080;
//httpServer.listen(PORT, () => {
//  logNetworkAddresses(PORT);
//});

// Graceful shutdown handler
function shutdown() {
  logger.info('Shutting down ESL connection...');
  if (eslClient) {
    try {
      eslClient.end();
      logger.info('ESL connection closed gracefully.');
    } catch (err) {
      logger.error('Error closing ESL connection during shutdown:', err);
    } finally {
      eslClient = null;
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);