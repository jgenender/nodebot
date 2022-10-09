import {logger} from "../util/logger";
import {prisma} from "../util/db";
import {WebClient} from '@slack/web-api';
import {User} from '@slack/web-api/dist/response/UsersInfoResponse'
import {Karma} from ".prisma/client";
import {BotMessageEvent, GenericMessageEvent, SayFn} from "@slack/bolt";

const INCREASE = 1;
const DECREASE = -1;
const NORMAL_KARMA_SIZE = 2;

export async function karmaHandler(client: WebClient, message: GenericMessageEvent | BotMessageEvent, say: SayFn) {
    try {

        if (!message.text) {
            return false;
        }

        const matcher = /^<@(.*?)>\s?.*?(\+{2,}|-{2,}|\u2014)/.exec(message.text);
        if (matcher == null) return false;

        const slackUser = await _getUser( matcher[1] );

        if (slackUser) {

            //Don't allow the karma requester to raise their own karma
            if (slackUser.id === message.user) {
                await say(`No no bro, you can't mess with your own karma. You just lost a karma point ` +
                    `for trying to game me. Nice going there, slick!`);
                const messageUser = await _getUser(message.user);
                await _processKarma(messageUser, DECREASE, NORMAL_KARMA_SIZE);
                return true;
            }

            //Check for karma increase or decrease
            if (matcher[2].startsWith('++')) {
                //Increase
                await _processKarma(slackUser, INCREASE, matcher[2].length);
            } else {
                //Decrease
                await _processKarma(slackUser, DECREASE, matcher[2].length);
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

    async function _getUser(userId: string | undefined): Promise<User> {

        if (!userId) throw new Error("userId passed into _getUser is undefined");

        const _userInfResp =  await client.users.info({
            user: userId
        });

        if (!_userInfResp) throw new Error(`_userInfResp from UserInfoResponse is undefined for user ${userId}`);

        if (!_userInfResp.user) throw new Error(`_userInfResp.user from UserInfoResponse is undefined ` +
            `for user ${userId}`);

        return _userInfResp.user;
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

            if (karmaSize > NORMAL_KARMA_SIZE) {
                await say(`Ok there tiger, I will ${direction === INCREASE ? 'bump' : 'remove'} ` +
                    `<@${user.id}>'s karma by 1 point. <@${user.id}> has increased karma to ${karma.value}`);
            } else {
                await say(`<@${user.id}> has ${direction === INCREASE ? 'increased' : 'decreased'} i` +
                    `karma to ${karma.value}`);
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
        if (user?.id && user?.profile?.display_name) {
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

        if (user?.profile) return await prisma.karma.update({
            where: {
                user: karma.user
            },
            data: {
                displayName: user.profile.display_name,
                value: (incOrDec === INCREASE) ? { increment: 1 } : { decrement: 1 }
            }
        });

        return null;
    }
}