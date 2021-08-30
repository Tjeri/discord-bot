const { Command } = require('discord.js-commando');
const { MessageEmbed } = require('discord.js');
const winston = require('winston');

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs.log' }),
    ],
    format: winston.format.combine(
        winston.format.printf(log => `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} - [${log.level.toUpperCase()}] - ${log.message}`),
    )
});

module.exports = class Play extends Command {
    constructor(client) {
        super(client, {
            name: 'loop',
            memberName: 'loop',
            group: 'music',
            description: 'sets the current track to be looped',
            guildOnly: true,
            userPermissions: ['ADMINISTRATOR'],
            throttling: {
                usages: 1,
                duration: 3
            }
        });
    }

    run = async message => {
        try {
            if (!message.guild.music.nowPlaying) {
                const embed = new MessageEmbed()
                    .setColor('#000099')
                    .setTitle(':musical_note: Nothing is playing right now');
                return await message.say({ embed });
            }
            message.guild.music.loop = message.guild.music.nowPlaying;
            const embed = new MessageEmbed()
                .setColor('#000099')
                .setTitle(`:musical_note: ${message.guild.music.loop.title} is getting looped now`);
            return await message.say({ embed });
        } catch(err) {
            logger.log('error', err);
            const embed = new MessageEmbed().setColor('#ff0000').setTitle(`:x: Error occured: ${err.message}`);
            return message.say({ embed });
        }
    }
}