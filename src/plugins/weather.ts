import {logger} from "../util/logger";
import {BotMessageEvent, GenericMessageEvent, SayFn} from "@slack/bolt";
import OpenWeatherMap from '../libs/openweathermap-ts/app';
import {CurrentResponse} from "../libs/openweathermap-ts/types";
import {CountryCodes} from "../libs/openweathermap-ts/helpers/country-codes";

const openWeather = new OpenWeatherMap({
    apiKey: `${process.env.OPENWEATHERMAP_API_KEY}`
});

exports.name = 'weather';
exports.func = async function (message: GenericMessageEvent | BotMessageEvent, say: SayFn) {

    logger.debug(message);
    if (message.text && message.text.startsWith(`~${exports.name}`)) {
        _getWeather(message, say, (w: CurrentResponse) => {
            if (w != null) {
                say(`Weather for ${w.name}${_formatCountry(w.sys.country)} is currently ${w.weather[0].description} with a temperature of ` +
                    `${Math.round(w.main.temp)}F and a humidity of ${w.main.humidity}%. Sunrise is at ` +
                    `${_formatDate(w.sys.sunrise, w.timezone)} and Sunset is at ` +
                    `${_formatDate(w.sys.sunset, w.timezone)}`);
            }
        }).catch((reason: any) => {
            logger.error(reason.toString());
            say(`Oops! Something went wrong when I went to get the weather!`);
        });
    }

    async function _getWeather(message: GenericMessageEvent | BotMessageEvent,
                               say: SayFn,
                               callback: (w: CurrentResponse) => void) {
        if (message.text) {

            const fixMsg = message.text.substring(exports.name.length + 2);
            let words = fixMsg.split(" ").map(str => {
                return str.trim();
            });

            if (words.length >= 1) {
                //Check for a zip first
                let re = /(^\d{5}$)/;
                if (re.test(words[0])) {
                    await _getByCurrentZip(words[0], callback);
                    return;
                }

                //Split by commas
                const wxLoc = fixMsg.split(',').map(str => {
                    return str.trim();
                });

                //If no commas, pass it in and see what happens
                if (wxLoc.length === 1) {
                    await _getByCityName(callback, wxLoc[0]);
                    return;
                }

                // We have commas, so there is more specificity
                if (wxLoc.length >= 2) {
                    if (wxLoc[1].length == 2) {
                        const code = wxLoc[1].toString().toUpperCase();

                        //Maybe a state
                        re = /^((A[LKZR])|(C[AOT])|(D[EC])|(FL)|(GA)|(HI)|(I[DLNA])|(K[SY])|(LA)|(M[EDAINSOT])|(N[EVHJMYCD])|(O[HKR])|(PA)|(RI)|(S[CD])|(T[NX])|(UT)|(V[TA])|(W[AVIY]))$/;
                        if (re.test(code)) {
                            await _getByCityName(callback, wxLoc[0], 'US', code);
                            return;
                        }

                        //Maybe a Canadian state?
                        re = /^((AB)|(BC)|(MB)|(N[BLTSU])|(ON)|(PE)|(QC)|(SK)|(YT))$/;
                        if (re.test(code)) {
                            await _getByCityName(callback, wxLoc[0], 'CA', code);
                            return;
                        }

                        //This may be a country
                        if (code in CountryCodes) {
                            await _getByCityName(callback, wxLoc[0], code);
                            return;
                        }

                    }
                    return;
                }

                await say(`I can't find weather for that location, <@${message.user}>`);
            }
        }
    }

    async function _getByCurrentZip(zip: string, cb: (w: CurrentResponse) => void) {
        return openWeather
            .getCurrentWeatherByZipcode(zip)
            .then((data: CurrentResponse) => {
                logger.debug('Weather object is', data);
                if (data.cod >= 200 && data.cod < 300) {
                    cb(data);
                } else {
                    say(`Oops! ${data.message}`);
                }
            });
    }

    async function _getByCityName(cb: (w: CurrentResponse) => void, city: string, country?: string, state?: string) {
        logger.error(`${country} ${state}`);
        return openWeather
            .getCurrentWeatherByCityName({cityName: city, countryCode: country, state: state})
            .then((data: CurrentResponse) => {
                logger.debug('Weather object is', data);
                if (data.cod >= 200 && data.cod < 300) {
                    cb(data);
                } else {
                    say(`Oops! ${data.message}`);
                }
            });
    }

    function _formatCountry(countryCode: string): string {
        if (countryCode) {
            //Default is for US, so return nothing
            if (countryCode === 'US') {
                return '';
            }
            const country = CountryCodes[countryCode];
            if (country) {
                return ', ' + country.toLowerCase()
                    .split(' ')
                    .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
                    .join(' ');
            }
            logger.error(`Cannot find country code ${countryCode}`);
        }
        return '';
    }

    function _formatDate(time: number, offset: number): string {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        const correctedUnixTime = (time + offset) * 1000;
        let d = new Date(correctedUnixTime);
        return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")} ` +
            `${months[d.getUTCMonth()]}, ${d.getUTCDate()} ${d.getUTCFullYear()}`;
    }
};
