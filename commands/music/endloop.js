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
            name: 'endloop',
            memberName: 'endloop',
            group: 'music',
            description: 'removes the active loop',
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
            if (!message.guild.music.loop) {
                const embed = new MessageEmbed()
                    .setColor('#000099')
                    .setTitle(':musical_note: Nothing is looping right now');
                return await message.say({ embed });
            }
            message.guild.music.loop = null;
            const embed = new MessageEmbed()
                .setColor('#000099')
                .setTitle(':musical_note: loop removed');
            return await message.say({ embed });
        } catch(err) {
            logger.log('error', err);
            const embed = new MessageEmbed().setColor('#ff0000').setTitle(`:x: Error occured: ${err.message}`);
            return message.say({ embed });
        }
    }
}