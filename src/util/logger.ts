import log4js, {Logger} from "log4js";
import log4jconfig from '../config/log4js.json'
import {PrismaClient} from "@prisma/client";

declare global {
    // allow global `var` declarations
    // eslint-disable-next-line no-var
    var logger: Logger | undefined
}

//Inititalize logger
export const logger = global.logger || log4js.configure(log4jconfig).getLogger();

if (!global.logger) global.logger = logger;