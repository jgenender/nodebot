import {BotMessageEvent, GenericMessageEvent, SayFn} from "@slack/bolt";

exports.name = 'hello';
exports.func = async function(message: GenericMessageEvent | BotMessageEvent, say: SayFn) {
    if (message.text && message.text.startsWith("~hello")) {
        say(`Hello, <@${message.user}>`);
    }
}