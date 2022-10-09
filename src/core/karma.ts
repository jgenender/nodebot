import {logger} from "../util/logger";
import {prisma} from "../util/db";
import {WebClient, UsersInfoResponse} from '@slack/web-api';
import {Karma} from ".prisma/client";
import {BotMessageEvent, GenericMessageEvent, SayFn} from "@slack/bolt";

const INCREASE = 1;
const DECREASE = -1;

//Hack: Pseudo types declared because we can't seem to import User/Profile from @slack/web-api
declare type User = {
    id?: string,
    profile?: Profile
}
declare type Profile = {
    display_name?: string
}

export async function karmaHandler(client: WebClient, message: GenericMessageEvent | BotMessageEvent, say: SayFn) {
    try {

        if (!message.text) {
            return false;
        }

        const matcher = /^<@(.*?)>\s?.*?(\+{2,}|-{2,}|\u2014)/.exec(message.text);
        if (matcher == null) return false;

        const slackUser: UsersInfoResponse = await client.users.info({
            user: matcher[1]
        });

        if (slackUser) {
            const user = slackUser.user;
            if (!user) throw new Error("slackUser.user from UserInfoResponse is undefined");

            const userId = user.id;
            if (!userId) throw new Error("slackUser.user.id from UserInfoResponse is undefined");

            //Don't allow the karma requester to raise their own karma
            if (userId === message.user) {
                await say(`No no bro, you can't mess with your own karma.`);
                return true;
            }

            //Check for karma increase or decrease
            if (matcher[2].startsWith('++')) {
                //Increase
                await _processKarma(user, INCREASE, matcher[2].length);
            } else {
                //Decrease
                await _processKarma(user, DECREASE, matcher[2].length);
            }
        } else {
            await say(`I don't know who that is, <@${message.user}>`);
        }

        return true;
    } catch (error) {
        logger.error(error);
        await say(`Oops, something bad happened with karma... I can't mess with that now!`)
            .catch(err => {
                    logger.error(err);
                }
            );
        return true;
    }

    async function _processKarma(user: User, direction: number, karmaSize: number) {
        if (user && user.id) {
            let karma = await _getKarma(user);
            if (karma == null) {
                karma = await _createKarma(user, 0);
                if (karma == null) throw new Error(`Could not create Karma for <@${user.id}>`);
            }

            karma = await _updateKarma(user, karma, direction);
            if (karma == null) throw new Error(`_processKarma returned null`);

            if (karmaSize > 2) {
                await say(`Ok there tiger, I will ${direction === INCREASE ? 'bump' : 'remove'} <@${user.id}>'s karma by 1 point. <@${user.id}> has increased karma to ${karma.value}`);
            } else {
                await say(`<@${user.id}> has ${direction === INCREASE ? 'increased' : 'decreased'} karma to ${karma.value}`);
            }
        }

        return null;

    }

    async function _getKarma(user: User) {
        return await prisma.karma.findFirst({
                where: {
                    user: user.id
                }
            }
        );
    }

    async function _createKarma(user: User, karmaValue: number) {
        if (user && user.id && user.profile && user.profile.display_name) {
            return await prisma.karma.create({
                    data: {
                        user: user.id,
                        value: karmaValue,
                        displayName: user.profile.display_name
                    }
                }
            );
        }

        return null;
    }

    async function _updateKarma(user: User, karma: Karma, incOrDec: number) {
        let val;
        if(incOrDec === INCREASE){
           val = { increment: 1 }
        } else {
            val = { decrement: 1 }
        }
        if (user && user.profile) return await prisma.karma.update({
            where: {
                user: karma.user
            },
            data: {
                displayName: user.profile.display_name,
                value: val
            }
        });

        return null;
    }
}