import {App, LogLevel} from '@slack/bolt';
import { karmaHandler } from './core/karma';
import {logger} from './util/logger';

require("dotenv").config();

//Set up plugins
interface PluginType {
    [name: string]: any;
}

const plugins = new Array<PluginType>();

//Load plugins
const glob = require('Glob');
glob.sync(`./plugins/*(*.ts|*.js)`, {cwd: __dirname}).map((file: string) => {
    let plugin = require(file);
    plugins[plugin.name] = plugin;
});

// Initializes your app with your bot token and signing secret
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true, // enable the following to use socket mode
    appToken: process.env.APP_TOKEN,
    logLevel: LogLevel.DEBUG,
});

// Create message handling dispatchers

//Antyhing that starts with '~'
app.message('~', async ({message, say}) => {
    if (message.subtype === undefined || message.subtype === 'bot_message') {
        if (message.text) {
            const re = /^[^\s]+/;
            const item = message.text.match(re);
            if (item) {
                const key: string = item[0].substring(1);
                if (plugins[key as any]) {
                    plugins[key as any].func(message, say);
                } else {
                    //More tests here

                    //End with I dont know
                    say(`I don't know what ${key} is, <@${message.user}>`);
                }
            }
        }
    }
});

// Core message handler for any message
app.message( async ({message, say}) => {
    if (message.subtype === undefined || message.subtype === 'bot_message') {
        if (message.text) {
            //test for karma
            if (await karmaHandler(app.client, message, say)) return;
        }
    }
});

logger.info('Starting Nodebot...');
(async () => {
    // Start your app
    await app.start();
    logger.info(`Nodebot is running!`);
})();