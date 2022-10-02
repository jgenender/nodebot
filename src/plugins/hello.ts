import {BotMessageEvent, GenericMessageEvent, SayFn} from "@slack/bolt";
import {logger} from "../app";

exports.name = 'hello';
exports.func = async function(message: GenericMessageEvent | BotMessageEvent, say: SayFn) {
    logger.debug(message);
    if (message.text && message.text.startsWith(`~${this.name}`)) {
        say(`Hello, <@${message.user}>`);
    }
}