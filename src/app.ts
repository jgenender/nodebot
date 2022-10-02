import {App, LogLevel} from '@slack/bolt';

require("dotenv").config();

const glob = require('Glob');

interface PluginType {
    [name: string]: any;
}

const plugins = new Array<PluginType>();

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

app.message('~', async ({message, say}) => {
    if (message.subtype === undefined || message.subtype === 'bot_message') {
        if (message.text && message.text.startsWith("~")) {
            const re = /^[^\s]+/;
            const item = message.text.match(re);
            if (item) {
                const key: string = item[0].substring(1);
                console.log("=========>" + key);
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

console.log('Starting Nodebot...');
(async () => {
    // Start your app
    await app.start();
    console.log(`Nodebot is running!`);
})();