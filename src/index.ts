import { FreeSwitchClient, FreeSwitchEventData } from 'esl-lite'
import { createServer } from 'http';
import express = require('express'); 
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
  handleReloadXml
} from './handlers/eventHandlers';

const app = express();
const httpServer = createServer(app);

let eslClient: FreeSwitchClient | null = null;


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

  // Call recording events
  eslClient.on('RECORD_START', handleRecordStart);
  eslClient.on('RECORD_STOP', handleRecordStop);

  // System events
  eslClient.on('HEARTBEAT', handleHeartbeat);
  eslClient.on('SHUTDOWN_REQUESTED', handleShutdownRequested);
  eslClient.on('STARTUP', handleStartup);
  eslClient.on('RELOADXML', handleReloadXml);
  //eslClient.on('ALL', handleAllEvents);

}


// Start the connection process
connectToEsl().catch(err => {
  logger.fatal({ err }, 'Failed to start ESL application');
  process.exit(1);
});

const PORT = 8080;
httpServer.listen(PORT, () => {
  logNetworkAddresses(PORT);
});

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